/**
 * useTenant — Multi-Tenant Composable
 * ─────────────────────────────────────────────────────────────
 * Resolves tenant identity from:
 * 1. Subdomain (production): merapi.emount.id → slug = 'merapi'
 * 2. VITE_DEFAULT_TENANT_SLUG (development fallback)
 *
 * Then fetches MountainSettings and injects CSS variables
 * for dynamic theming per tenant.
 */
import { ref, computed, readonly } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Mountain, MountainSettings, TenantSettings } from '../types/database.types'

// ─── Default theme fallback (matches current CSS) ────────────
const DEFAULT_SETTINGS: TenantSettings = {
  theme: {
    primary_color: '#137333',
    accent_color: '#f5952c',
    logo_url: null,
    hero_image_url: null,
    font_family: 'Geist, Inter, sans-serif'
  },
  features: {
    simaksi_module: true,
    insurance_addon: false,
    guide_porter_module: false,
    weather_forecast: true,
    realtime_quota: true,
    whatsapp_notifications: false,
    email_notifications: false
  },
  price_per_person: 25000,
  max_group_size: 10,
  booking_advance_days: 30,
  checkout_grace_hours: 12,
  contact_email: null,
  contact_phone: null,
  location_address: null
}

// ─── Singleton state (shared across all components) ──────────
const mountain = ref<Mountain | null>(null)
const settings = ref<TenantSettings>(DEFAULT_SETTINGS)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Menyimpan thread promise pencarian data agar tidak terjadi duplikasi request (Race Condition Fix)
let initPromise: Promise<void> | null = null

/**
 * Resolve tenant slug from current URL's subdomain.
 * Falls back to env var, then to 'slamet' as default.
 */
function resolveTenantSlug(): string {
  const hostname = window.location.hostname
  
  // Jika berjalan di localhost atau IP lokal, langsung gunakan fallback development env
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'slamet'
  }

  // Production: merapi.emount.id → parts = ['merapi', 'emount', 'id']
  const parts = hostname.split('.')
  if (parts.length >= 3 && parts[0] && parts[0] !== 'www') {
    return parts[0]
  }
  
  return import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'slamet'
}

/**
 * Apply tenant theme as CSS custom properties on :root
 */
function applyTheme(theme: TenantSettings['theme']): void {
  const root = document.documentElement
  root.style.setProperty('--primary-green', theme.primary_color)
  root.style.setProperty('--primary-green-hover', darkenColor(theme.primary_color, 20))
  root.style.setProperty('--accent-orange', theme.accent_color)
  root.style.setProperty('--accent-orange-hover', darkenColor(theme.accent_color, 15))
  root.style.setProperty('--tenant-primary', theme.primary_color)
  root.style.setProperty('--tenant-accent', theme.accent_color)
  if (theme.font_family) {
    root.style.setProperty('--font-family', theme.font_family)
  }
}

/**
 * Simple hex color darkening utility
 */
function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function useTenant() {
  const tenantSlug = computed(() => mountain.value?.slug ?? resolveTenantSlug())
  const mountainId = computed(() => mountain.value?.id ?? null)
  const mountainName = computed(() => mountain.value?.name ?? 'Gunung Slamet')
  const tenantTheme = computed(() => settings.value.theme)
  const features = computed(() => settings.value.features)
  const pricePerPerson = computed(() => settings.value.price_per_person)

  function initTenant(): Promise<void> {
    // Jika proses inisialisasi sudah berjalan atau selesai, kembalikan promise yang sama
    if (initPromise) return initPromise

    // Caching proses asinkronus ke dalam variabel global singleton
    initPromise = (async () => {
      isLoading.value = true
      error.value = null

      const slug = resolveTenantSlug()

      // Jika Supabase tidak dikonfigurasi, gunakan nilai bawaan (offline/dev mode)
      if (!isSupabaseConfigured) {
        console.warn('[useTenant] Running in offline mode — using default tenant config.')
        applyTheme(DEFAULT_SETTINGS.theme)
        isLoading.value = false
        return
      }

      try {
        // 1. Ambil data spesifikasi gunung berdasarkan slug domain aktif
        const { data: mtData, error: mtErr } = await supabase
          .from('mountains')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single()

        if (mtErr || !mtData) {
          throw new Error(`Tenant '${slug}' tidak ditemukan atau status dinonaktifkan.`)
        }
        mountain.value = mtData

        // 2. Ambil kustomisasi pengaturan layout dan modul gunung terkait
        const { data: settingsData, error: stErr } = await supabase
          .from('mountain_settings')
          .select('*')
          .eq('mountain_id', mtData.id)
          .maybeSingle() // Menggunakan maybeSingle agar tidak melempar error keras jika baris kosong

        if (!stErr && settingsData) {
          const rawSettings = settingsData as MountainSettings
          settings.value = { ...DEFAULT_SETTINGS, ...rawSettings.settings }
        }

        // 3. Injeksi variabel CSS warna ke dalam dokumen HTML root secara dinamis
        applyTheme(settings.value.theme)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal memuat konfigurasi tenant.'
        error.value = msg
        console.error('[useTenant]', msg)
        // Fallback ke skema warna default apabila server mengalami kendala jaringan
        applyTheme(DEFAULT_SETTINGS.theme)
      } finally {
        isLoading.value = false
      }
    })()

    return initPromise
  }

  return {
    mountain: readonly(mountain),
    settings: readonly(settings),
    tenantSlug,
    mountainId,
    mountainName,
    tenantTheme,
    features,
    pricePerPerson,
    isLoading: readonly(isLoading),
    error: readonly(error),
    initTenant
  }
}