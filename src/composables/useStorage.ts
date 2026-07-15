/**
 * useStorage — Supabase Storage Composable (SIMAKSI Documents)
 * ─────────────────────────────────────────────────────────────
 * Handles upload/download of hiking permit documents:
 *   - KTP (identity card)
 *   - Surat Sehat (health certificate)
 *   - Materai (stamp if required by tenant)
 *
 * Storage path: {mountain_id}/simaksi/{booking_id}/{doc_type}.{ext}
 * Bucket name: 'simaksi-documents' (must be created in Supabase dashboard)
 */
import { ref, readonly } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { DocumentType } from '../types/database.types'

const BUCKET_NAME = 'simaksi-documents'

export interface UploadedDocument {
  docType: DocumentType
  storagePath: string
  publicUrl: string
  fileName: string
  sizeBytes: number
  uploadedAt: string
}

export function useStorage(mountainId: string | null) {
  const uploads = ref<Map<DocumentType, UploadedDocument>>(new Map())
  const isUploading = ref<Map<DocumentType, boolean>>(new Map())
  const uploadProgress = ref<Map<DocumentType, number>>(new Map())
  const error = ref<string | null>(null)

  // ── Upload Document ───────────────────────────────────────

  async function uploadDocument(
    bookingId: string,
    docType: DocumentType,
    file: File
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!isSupabaseConfigured || !mountainId) {
      // Dev mode: simulate upload with object URL
      const fakeUrl = URL.createObjectURL(file)
      uploads.value.set(docType, {
        docType,
        storagePath: `local/${docType}`,
        publicUrl: fakeUrl,
        fileName: file.name,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString()
      })
      return { success: true, url: fakeUrl }
    }

    error.value = null
    isUploading.value.set(docType, true)
    uploadProgress.value.set(docType, 0)

    try {
      // Validate file
      const MAX_SIZE_MB = 5
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Ukuran file maksimal ${MAX_SIZE_MB}MB.`)
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Format file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.')
      }

      // Construct storage path
      const ext = file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${mountainId}/simaksi/${bookingId}/${docType}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadErr) {
        throw new Error(uploadErr.message)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath)

      const publicUrl = urlData.publicUrl

      uploads.value.set(docType, {
        docType,
        storagePath,
        publicUrl,
        fileName: file.name,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString()
      })

      uploadProgress.value.set(docType, 100)
      return { success: true, url: publicUrl }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload gagal.'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isUploading.value.set(docType, false)
    }
  }

  // ── Remove Document ───────────────────────────────────────

  async function removeDocument(docType: DocumentType): Promise<void> {
    const doc = uploads.value.get(docType)
    if (!doc) return

    if (isSupabaseConfigured && mountainId && !doc.storagePath.startsWith('local/')) {
      await supabase.storage.from(BUCKET_NAME).remove([doc.storagePath])
    }

    uploads.value.delete(docType)
    uploadProgress.value.delete(docType)
  }

  // ── Get signed URL (temporary access for private buckets) ─

  async function getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
    if (!isSupabaseConfigured) return null

    const { data, error: signErr } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds)

    if (signErr || !data) return null
    return data.signedUrl
  }

  // ── Helpers ───────────────────────────────────────────────

  function isDocUploaded(docType: DocumentType): boolean {
    return uploads.value.has(docType)
  }

  function getDocUrl(docType: DocumentType): string | null {
    return uploads.value.get(docType)?.publicUrl ?? null
  }

  function isDocUploading(docType: DocumentType): boolean {
    return isUploading.value.get(docType) ?? false
  }

  function getDocProgress(docType: DocumentType): number {
    return uploadProgress.value.get(docType) ?? 0
  }

  return {
    uploads: readonly(uploads),
    error: readonly(error),
    uploadDocument,
    removeDocument,
    getSignedUrl,
    isDocUploaded,
    getDocUrl,
    isDocUploading,
    getDocProgress
  }
}
