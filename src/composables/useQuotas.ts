/**
 * useQuotas — Real-time Quota Composable
 * ─────────────────────────────────────────────────────────────
 * Subscribes to Supabase Realtime for live quota updates.
 * Falls back to useDatabaseStore (localStorage) in offline mode.
 *
 * PRD requirement: "cek kuota real-time < 500ms"
 */
import { ref, computed, readonly } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useDatabaseStore } from '../stores/database'
import type { Quota } from '../types/database.types'

// ─── In-memory quota cache keyed by `${trail_id}:${date}` ──
const quotaCache = ref<Map<string, Quota>>(new Map())
const isLoading = ref(false)
const error = ref<string | null>(null)
let realtimeChannel: RealtimeChannel | null = null

export function useQuotas(mountainId: string | null) {
  const db = useDatabaseStore()

  function cacheKey(trailId: string, date: string): string {
    return `${trailId}:${date}`
  }

  // ── Fetch quota for a specific trail + date ───────────────

  async function fetchQuota(trailId: string, date: string): Promise<Quota | null> {
    const key = cacheKey(trailId, date)

    // Offline fallback
    if (!isSupabaseConfigured || !mountainId) {
      const localQuota = db.getKuotaHarian(trailId, date)
      const mapped: Quota = {
        id: localQuota.id,
        trail_id: localQuota.jalur_id,
        mountain_id: mountainId ?? 'local',
        date: localQuota.tanggal,
        quota_total: localQuota.kuota_total,
        quota_used: localQuota.kuota_terpakai,
        is_closed: false,
        close_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      quotaCache.value.set(key, mapped)
      return mapped
    }

    // Try cache first
    if (quotaCache.value.has(key)) {
      return quotaCache.value.get(key)!
    }

    isLoading.value = true
    const { data, error: err } = await supabase
      .from('quotas')
      .select('*')
      .eq('trail_id', trailId)
      .eq('mountain_id', mountainId)
      .eq('date', date)
      .single()

    isLoading.value = false

    if (err || !data) {
      // Quota row doesn't exist yet — return a virtual one based on trail default
      return null
    }

    quotaCache.value.set(key, data)
    return data
  }

  // ── Computed: available slots ─────────────────────────────

  function getAvailableSlots(trailId: string, date: string): number {
    const key = cacheKey(trailId, date)
    const q = quotaCache.value.get(key)
    if (!q) return 0
    return Math.max(0, q.quota_total - q.quota_used)
  }

  function isTrailAvailable(trailId: string, date: string): boolean {
    const key = cacheKey(trailId, date)
    const q = quotaCache.value.get(key)
    if (!q) return true // assume available if not loaded yet
    return !q.is_closed && q.quota_used < q.quota_total
  }

  // ── Supabase Realtime subscription ───────────────────────

  function subscribeToQuotas(): void {
    if (!isSupabaseConfigured || !mountainId || realtimeChannel) return

    realtimeChannel = supabase
      .channel(`quotas:mountain_id=eq.${mountainId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotas',
          filter: `mountain_id=eq.${mountainId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as Quota
            const key = cacheKey(updated.trail_id, updated.date)
            quotaCache.value.set(key, updated)
            // Force reactivity update
            quotaCache.value = new Map(quotaCache.value)
          }
        }
      )
      .subscribe()
  }

  function unsubscribeFromQuotas(): void {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // ── Atomic quota reservation via RPC ─────────────────────

  async function reserveQuota(
    trailId: string,
    date: string,
    headcount: number
  ): Promise<{ success: boolean; available: number; error?: string }> {
    if (!isSupabaseConfigured) {
      // Offline: delegate to Pinia
      const quota = db.getKuotaHarian(trailId, date)
      const available = quota.kuota_total - quota.kuota_terpakai
      if (headcount > available) {
        return { success: false, available, error: `Kuota tidak cukup. Tersisa ${available} slot.` }
      }
      quota.kuota_terpakai += headcount
      db.saveAll()
      return { success: true, available: available - headcount }
    }

    const { data, error: rpcErr } = await supabase.rpc('reserve_quota', {
      p_trail_id: trailId,
      p_date: date,
      p_headcount: headcount
    })

    if (rpcErr || !data) {
      return { success: false, available: 0, error: rpcErr?.message ?? 'Gagal memesan slot kuota.' }
    }

    return data
  }

  async function releaseQuota(
    trailId: string,
    date: string,
    headcount: number
  ): Promise<boolean> {
    if (!isSupabaseConfigured) {
      const quota = db.getKuotaHarian(trailId, date)
      quota.kuota_terpakai = Math.max(0, quota.kuota_terpakai - headcount)
      db.saveAll()
      return true
    }

    const { data } = await supabase.rpc('release_quota', {
      p_trail_id: trailId,
      p_date: date,
      p_headcount: headcount
    })
    return !!data
  }

  return {
    quotaCache: readonly(quotaCache),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchQuota,
    getAvailableSlots,
    isTrailAvailable,
    subscribeToQuotas,
    unsubscribeFromQuotas,
    reserveQuota,
    releaseQuota
  }
}
