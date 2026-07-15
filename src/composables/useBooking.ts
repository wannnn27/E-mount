/**
 * useBooking — Booking Flow Composable
 * ─────────────────────────────────────────────────────────────
 * Manages the full booking state machine per PRD Bab 4:
 *
 *   DRAFT → WAITING_PAYMENT → PAID → VERIFIED
 *        → CHECKED_IN → CHECKED_OUT
 *        → CANCELLED (at any point before CHECKED_IN)
 *        → OVERDUE (auto-flagged by Ranger module)
 *
 * Falls back to useDatabaseStore (localStorage) in offline mode.
 */
import { ref, computed, readonly } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useDatabaseStore } from '../stores/database'
import { useQuotas } from './useQuotas'
import type { Booking, BookingMember, BookingStatus } from '../types/database.types'

// ─── Wizard step state (shared within session) ────────────────
export interface BookingFormData {
  trailId: string
  trailName: string
  date: string               // YYYY-MM-DD
  headcount: number
  leaderName: string
  leaderNik: string
  leaderPhone: string
  emergencyContact: string
  members: string[]          // Names of additional members
  // Document uploads (SIMAKSI)
  ktpFile: File | null
  healthCertFile: File | null
  // Computed
  totalAmount: number
}

const INITIAL_FORM: BookingFormData = {
  trailId: '',
  trailName: '',
  date: '',
  headcount: 1,
  leaderName: '',
  leaderNik: '',
  leaderPhone: '',
  emergencyContact: '',
  members: [],
  ktpFile: null,
  healthCertFile: null,
  totalAmount: 0
}

export function useBooking(mountainId: string | null, pricePerPerson: number = 25000) {
  const db = useDatabaseStore()
  const { reserveQuota, releaseQuota } = useQuotas(mountainId)

  const formData = ref<BookingFormData>({ ...INITIAL_FORM })
  const currentBookingId = ref<string | null>(null)
  const currentBooking = ref<Booking | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Wizard step management
  const currentStep = ref(1)
  const TOTAL_STEPS = 5

  const totalAmount = computed(() => formData.value.headcount * pricePerPerson)
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1: return !!formData.value.trailId && !!formData.value.date
      case 2: return (
        !!formData.value.leaderName &&
        formData.value.leaderNik.length >= 16 &&
        !!formData.value.leaderPhone &&
        !!formData.value.emergencyContact
      )
      case 3: return formData.value.members.every(m => m.trim().length > 0)
      case 4: return true // Documents optional in v1
      case 5: return true
      default: return false
    }
  })

  // ── Wizard Navigation ─────────────────────────────────────

  function nextStep(): void {
    if (currentStep.value < TOTAL_STEPS) currentStep.value++
  }

  function prevStep(): void {
    if (currentStep.value > 1) currentStep.value--
  }

  function goToStep(step: number): void {
    if (step >= 1 && step <= TOTAL_STEPS) currentStep.value = step
  }

  function resetWizard(): void {
    formData.value = { ...INITIAL_FORM }
    currentStep.value = 1
    currentBookingId.value = null
    currentBooking.value = null
    error.value = null
  }

  // Update members array reactively when headcount changes
  function syncMembersToHeadcount(): void {
    const targetLen = formData.value.headcount - 1 // leader not in members array
    if (targetLen < 0) return
    if (formData.value.members.length < targetLen) {
      while (formData.value.members.length < targetLen) formData.value.members.push('')
    } else if (formData.value.members.length > targetLen) {
      formData.value.members = formData.value.members.slice(0, targetLen)
    }
  }

  // ── Create Booking ────────────────────────────────────────

  async function createBooking(): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    error.value = null
    isLoading.value = true

    // ── Offline mode ──────────────────────────────────────
    if (!isSupabaseConfigured) {
      const res = db.createBooking(
        formData.value.trailId,
        formData.value.date,
        formData.value.headcount,
        {
          nama: formData.value.leaderName,
          no_hp: formData.value.leaderPhone,
          nik: formData.value.leaderNik,
          kontak_darurat: formData.value.emergencyContact
        },
        formData.value.members
      )
      isLoading.value = false
      if (res.success && res.bookingId) {
        currentBookingId.value = res.bookingId
      }
      return res
    }

    // ── Online mode (Supabase) ────────────────────────────
    try {
      // 1. Atomic quota reservation
      const quotaResult = await reserveQuota(
        formData.value.trailId,
        formData.value.date,
        formData.value.headcount
      )
      if (!quotaResult.success) {
        isLoading.value = false
        return { success: false, error: quotaResult.error }
      }

      // 2. Create booking record
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          mountain_id: mountainId!,
          trail_id: formData.value.trailId,
          user_id: (await supabase.auth.getUser()).data.user?.id!,
          booking_date: formData.value.date,
          headcount: formData.value.headcount,
          leader_name: formData.value.leaderName,
          leader_nik: formData.value.leaderNik,
          leader_phone: formData.value.leaderPhone,
          emergency_contact: formData.value.emergencyContact,
          status: 'WAITING_PAYMENT' as BookingStatus
        })
        .select()
        .single()

      if (bookingErr || !booking) {
        // Rollback quota
        await releaseQuota(formData.value.trailId, formData.value.date, formData.value.headcount)
        throw new Error(bookingErr?.message ?? 'Gagal membuat booking.')
      }

      currentBookingId.value = booking.id
      currentBooking.value = booking

      // 3. Insert booking members
      if (formData.value.members.length > 0) {
        const memberRows: Array<{ booking_id: string; mountain_id: string; full_name: string }> =
          formData.value.members.map(name => ({
            booking_id: booking.id,
            mountain_id: mountainId!,
            full_name: name
          }))

        await supabase.from('booking_members').insert(memberRows)
      }

      isLoading.value = false
      return { success: true, bookingId: booking.id }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan.'
      error.value = msg
      isLoading.value = false
      return { success: false, error: msg }
    }
  }

  // ── Fetch Booking Detail ──────────────────────────────────

  async function fetchBooking(bookingId: string): Promise<Booking | null> {
    if (!isSupabaseConfigured) {
      const b = db.bookings.find(b => b.id === bookingId)
      if (!b) return null
      // Map to Booking type
      return {
        id: b.id,
        mountain_id: 'local',
        trail_id: b.jalur_id,
        user_id: b.user_id,
        booking_date: b.tanggal_naik,
        headcount: b.jumlah_pendaki,
        leader_name: b.nama_pemimpin,
        leader_nik: b.nik_pemimpin,
        leader_phone: b.no_hp_pemimpin,
        emergency_contact: b.kontak_darurat,
        status: mapLocalStatus(b.status_booking),
        notes: null,
        simaksi_number: null,
        overdue_flagged_at: null,
        checked_in_at: null,
        checked_out_at: null,
        created_at: b.created_at,
        updated_at: b.created_at
      }
    }

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (data) currentBooking.value = data
    return data ?? null
  }

  // ── Cancel Booking ────────────────────────────────────────

  async function cancelBooking(bookingId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      return db.cancelBooking(bookingId)
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'CANCELLED' as BookingStatus })
      .eq('id', bookingId)

    return !updateErr
  }

  // ── Status Label Helpers ──────────────────────────────────

  function getStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      DRAFT: 'Draft',
      WAITING_PAYMENT: 'Menunggu Pembayaran',
      PAID: 'Lunas',
      VERIFIED: 'Terverifikasi',
      CHECKED_IN: 'Sedang Mendaki',
      CHECKED_OUT: 'Selesai',
      CANCELLED: 'Dibatalkan',
      OVERDUE: '⚠️ Potensi SAR'
    }
    return labels[status] ?? status
  }

  function getStatusBadgeClass(status: BookingStatus): string {
    const classes: Record<BookingStatus, string> = {
      DRAFT: 'badge-secondary',
      WAITING_PAYMENT: 'badge-warning',
      PAID: 'badge-info',
      VERIFIED: 'badge-success',
      CHECKED_IN: 'badge-primary',
      CHECKED_OUT: 'badge-secondary',
      CANCELLED: 'badge-danger',
      OVERDUE: 'badge-overdue'
    }
    return classes[status] ?? 'badge-secondary'
  }

  // ── Private helpers ───────────────────────────────────────

  function mapLocalStatus(localStatus: string): BookingStatus {
    const map: Record<string, BookingStatus> = {
      'Menunggu Pembayaran': 'WAITING_PAYMENT',
      'Menunggu Verifikasi': 'PAID',
      'Lunas': 'VERIFIED',
      'Dibatalkan': 'CANCELLED'
    }
    return map[localStatus] ?? 'DRAFT'
  }

  return {
    formData,
    currentStep,
    TOTAL_STEPS,
    currentBookingId: readonly(currentBookingId),
    currentBooking: readonly(currentBooking),
    totalAmount,
    canProceed,
    isLoading: readonly(isLoading),
    error: readonly(error),
    nextStep,
    prevStep,
    goToStep,
    resetWizard,
    syncMembersToHeadcount,
    createBooking,
    fetchBooking,
    cancelBooking,
    getStatusLabel,
    getStatusBadgeClass
  }
}
