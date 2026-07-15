/**
 * useAuth — Authentication Composable
 * ─────────────────────────────────────────────────────────────
 * Wraps Supabase Auth with offline fallback to the existing
 * Pinia localStorage store (useDatabaseStore).
 *
 * In OFFLINE mode (no Supabase configured), all operations
 * delegate to useDatabaseStore for backward compatibility.
 */
import { ref, computed, readonly, onMounted, onUnmounted } from 'vue'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useDatabaseStore } from '../stores/database'
import type { Profile, UserRole } from '../types/database.types'

// ─── Reactive state (singleton) ─────────────────────────────
const supabaseUser = ref<User | null>(null)
const profile = ref<Profile | null>(null)
const session = ref<Session | null>(null)
const isLoading = ref(false)
const authError = ref<string | null>(null)

export function useAuth() {
  const db = useDatabaseStore()

  // ── Computed helpers ──────────────────────────────────────

  /** Currently authenticated user (Supabase or localStorage) */
  const currentUser = computed(() => {
    if (isSupabaseConfigured) {
      return profile.value
    }
    // Offline fallback: map Pinia user to Profile shape
    const u = db.currentUser
    if (!u) return null
    return {
      id: u.id,
      mountain_id: null,
      full_name: u.nama,
      email: u.email,
      phone: u.no_hp,
      role: u.role as UserRole,
      is_active: true,
      created_at: u.created_at,
      updated_at: u.created_at
    } satisfies Profile
  })

  const isAuthenticated = computed(() => !!currentUser.value)
  const isAdmin = computed(() =>
    currentUser.value?.role === 'admin' || currentUser.value?.role === 'superadmin'
  )
  const isRanger = computed(() => currentUser.value?.role === 'ranger')

  // ── Supabase Auth Listener ────────────────────────────────

  let authSubscription: { unsubscribe: () => void } | null = null

  function startAuthListener(): void {
    if (!isSupabaseConfigured) return

    const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      supabaseUser.value = newSession?.user ?? null

      if (newSession?.user) {
        await fetchProfile(newSession.user.id)
      } else {
        profile.value = null
      }
    })
    authSubscription = data.subscription
  }

  function stopAuthListener(): void {
    authSubscription?.unsubscribe()
    authSubscription = null
  }

  // ── Profile Fetching ──────────────────────────────────────

  async function fetchProfile(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      profile.value = data
    }
  }

  // ── Session Initialization ────────────────────────────────

  async function initAuth(): Promise<void> {
    if (!isSupabaseConfigured) return
    isLoading.value = true
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    supabaseUser.value = data.session?.user ?? null
    if (data.session?.user) {
      await fetchProfile(data.session.user.id)
    }
    startAuthListener()
    isLoading.value = false
  }

  // ── Auth Operations ───────────────────────────────────────

  async function login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    authError.value = null
    isLoading.value = true

    if (!isSupabaseConfigured) {
      // Offline mode: use Pinia store
      const ok = db.login(email, password)
      isLoading.value = false
      if (!ok) return { success: false, error: 'Email atau password salah.' }
      return { success: true }
    }

    const { error }: { error: AuthError | null } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    isLoading.value = false

    if (error) {
      const msg = error.message.includes('Invalid login credentials')
        ? 'Email atau password salah.'
        : error.message
      authError.value = msg
      return { success: false, error: msg }
    }
    return { success: true }
  }

  async function register(
    email: string,
    password: string,
    fullName: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> {
    authError.value = null
    isLoading.value = true

    if (!isSupabaseConfigured) {
      const ok = db.register(fullName, email, phone, password)
      isLoading.value = false
      if (!ok) return { success: false, error: 'Email sudah terdaftar.' }
      return { success: true }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone
        }
      }
    })
    isLoading.value = false

    if (error) {
      authError.value = error.message
      return { success: false, error: error.message }
    }
    return { success: true }
  }

  async function logout(): Promise<void> {
    if (!isSupabaseConfigured) {
      db.logout()
      return
    }
    await supabase.auth.signOut()
    profile.value = null
    session.value = null
    supabaseUser.value = null
  }

  return {
    currentUser,
    isAuthenticated,
    isAdmin,
    isRanger,
    isLoading: readonly(isLoading),
    authError: readonly(authError),
    session: readonly(session),
    login,
    register,
    logout,
    initAuth,
    startAuthListener,
    stopAuthListener
  }
}
