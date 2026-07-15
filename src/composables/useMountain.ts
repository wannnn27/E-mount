/**
 * useMountain — Mountain & Trail Data Composable
 * ─────────────────────────────────────────────────────────────
 * Fetches mountain and trail data scoped to the active tenant
 * (mountain_id). Falls back to useDatabaseStore in offline mode.
 */
import { ref, readonly } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useDatabaseStore } from '../stores/database'
import type { Mountain, Trail } from '../types/database.types'

export function useMountain(mountainId: string | null) {
  const db = useDatabaseStore()

  const mountain = ref<Mountain | null>(null)
  const trails = ref<Trail[]>([])
  const isLoadingMountain = ref(false)
  const isLoadingTrails = ref(false)
  const error = ref<string | null>(null)

  // ── Fetch mountain detail ─────────────────────────────────

  async function fetchMountain(id?: string): Promise<Mountain | null> {
    const targetId = id ?? mountainId
    if (!targetId) return null

    if (!isSupabaseConfigured) return null

    isLoadingMountain.value = true
    const { data, error: err } = await supabase
      .from('mountains')
      .select('*')
      .eq('id', targetId)
      .eq('is_active', true)
      .single()

    isLoadingMountain.value = false
    if (err || !data) {
      error.value = err?.message ?? 'Gunung tidak ditemukan.'
      return null
    }
    mountain.value = data
    return data
  }

  // ── Fetch trails for this mountain ───────────────────────

  async function fetchTrails(): Promise<Trail[]> {
    // Offline mode: use Pinia store and map to Trail type
    if (!isSupabaseConfigured || !mountainId) {
      const localTrails: Trail[] = db.jalur.map(j => ({
        id: j.id,
        mountain_id: mountainId ?? 'local',
        name: j.nama_jalur,
        description: j.deskripsi,
        difficulty: 'moderate',
        estimated_duration_hours: null,
        default_daily_quota: j.kuota_harian_default,
        status: mapLocalStatus(j.status_jalur),
        latitude: j.latitude,
        longitude: j.longitude,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
      trails.value = localTrails
      return localTrails
    }

    isLoadingTrails.value = true
    const { data, error: err } = await supabase
      .from('trails')
      .select('*')
      .eq('mountain_id', mountainId)
      .eq('is_active', true)
      .order('name')

    isLoadingTrails.value = false
    if (err || !data) {
      error.value = err?.message ?? 'Gagal memuat jalur pendakian.'
      return []
    }
    trails.value = data
    return data
  }

  // ── Get single trail ──────────────────────────────────────

  async function fetchTrail(trailId: string): Promise<Trail | null> {
    // Check cache
    const cached = trails.value.find(t => t.id === trailId)
    if (cached) return cached

    if (!isSupabaseConfigured) {
      const j = db.jalur.find(j => j.id === trailId)
      if (!j) return null
      return {
        id: j.id,
        mountain_id: mountainId ?? 'local',
        name: j.nama_jalur,
        description: j.deskripsi,
        difficulty: 'moderate',
        estimated_duration_hours: null,
        default_daily_quota: j.kuota_harian_default,
        status: mapLocalStatus(j.status_jalur),
        latitude: j.latitude,
        longitude: j.longitude,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    const { data } = await supabase
      .from('trails')
      .select('*')
      .eq('id', trailId)
      .single()

    return data ?? null
  }

  function mapLocalStatus(s: 'Buka' | 'Waspada' | 'Tutup'): Trail['status'] {
    if (s === 'Buka') return 'open'
    if (s === 'Waspada') return 'caution'
    return 'closed'
  }

  function getStatusLabel(status: Trail['status']): string {
    return { open: 'Dibuka', caution: 'Waspada', closed: 'Ditutup' }[status]
  }

  function getStatusBadgeClass(status: Trail['status']): string {
    return { open: 'badge-success', caution: 'badge-warning', closed: 'badge-danger' }[status]
  }

  return {
    mountain: readonly(mountain),
    trails: readonly(trails),
    isLoadingMountain: readonly(isLoadingMountain),
    isLoadingTrails: readonly(isLoadingTrails),
    error: readonly(error),
    fetchMountain,
    fetchTrails,
    fetchTrail,
    getStatusLabel,
    getStatusBadgeClass
  }
}
