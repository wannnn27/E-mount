/**
 * Database Types — E-Mount
 * ─────────────────────────────────────────────────────────────
 * Type-safe schema definitions sesuai PRD Bab 6 (Desain Basis Data).
 * Digunakan oleh Supabase client dan semua composables.
 *
 * State Machine Booking (PRD Bab 4):
 *   DRAFT → WAITING_PAYMENT → PAID → VERIFIED → CHECKED_IN → CHECKED_OUT
 *                                              ↘ CANCELLED
 *                                              ↘ OVERDUE (potensi SAR)
 */

// ─── Enums ────────────────────────────────────────────────────

export type TrailStatus = 'open' | 'caution' | 'closed'

export type BookingStatus =
  | 'DRAFT'
  | 'WAITING_PAYMENT'
  | 'PAID'
  | 'VERIFIED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'OVERDUE'

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'

export type UserRole = 'climber' | 'ranger' | 'admin' | 'superadmin'

export type DocumentType = 'ktp' | 'health_certificate' | 'materai' | 'other'

export type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'revision_required'

export type WeatherCondition = 'clear' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'storm'

// ─── Core Tables ────────────────────────────────────────────

export type Mountain = {
  id: string
  slug: string                     // e.g. 'slamet', 'rinjani' — used as tenant identifier
  name: string
  description: string | null
  province: string | null
  elevation_m: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MountainSettings = {
  id: string
  mountain_id: string
  // JSONB flexible config — sesuai PRD Bab 3.1
  settings: TenantSettings
  created_at: string
  updated_at: string
}

export type Trail = {
  id: string
  mountain_id: string              // Tenant isolation key
  name: string
  description: string | null
  difficulty: 'easy' | 'moderate' | 'hard' | 'extreme'
  estimated_duration_hours: number | null
  default_daily_quota: number
  status: TrailStatus
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Quota = {
  id: string
  trail_id: string
  mountain_id: string              // Denormalized for RLS + performance
  date: string                     // YYYY-MM-DD
  quota_total: number
  quota_used: number
  is_closed: boolean               // Manual override (erupsi/cuaca ekstrem)
  close_reason: string | null
  created_at: string
  updated_at: string
}

// ─── User & Auth ─────────────────────────────────────────────

export type Profile = {
  id: string                       // Matches auth.users.id (UUID)
  mountain_id: string | null       // null = platform-level user, non-null = tenant staff
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Booking Flow ────────────────────────────────────────────

export type Booking = {
  id: string
  mountain_id: string              // Tenant isolation key
  trail_id: string
  user_id: string
  booking_date: string             // YYYY-MM-DD (tanggal naik)
  headcount: number
  leader_name: string
  leader_nik: string               // Encrypted in production
  leader_phone: string
  emergency_contact: string
  status: BookingStatus
  notes: string | null
  simaksi_number: string | null    // Auto-generated upon VERIFIED
  overdue_flagged_at: string | null
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  updated_at: string
}

export type BookingMember = {
  id: string
  booking_id: string
  mountain_id: string              // Denormalized for RLS
  full_name: string
  nik: string | null
  created_at: string
}

export type Payment = {
  id: string
  booking_id: string
  mountain_id: string              // Denormalized for RLS
  amount: number
  method: string                   // 'bank_transfer' | 'midtrans' | 'xendit' | 'qris'
  proof_url: string | null         // Supabase Storage URL
  gateway_ref: string | null       // Midtrans/Xendit transaction ID
  status: PaymentStatus
  verified_by: string | null       // Profile.id of admin who verified
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type Ticket = {
  id: string
  booking_id: string
  mountain_id: string              // Denormalized for RLS
  qr_code: string                  // Unique QR payload (UUID or encoded string)
  is_used: boolean
  created_at: string
}

// ─── SIMAKSI Documents ───────────────────────────────────────

export type SimaksiDocument = {
  id: string
  booking_id: string
  mountain_id: string
  document_type: DocumentType
  storage_path: string             // Supabase Storage path
  public_url: string | null
  status: DocumentStatus
  reviewer_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// ─── Notifications ───────────────────────────────────────────

export type Notification = {
  id: string
  user_id: string
  mountain_id: string | null
  booking_id: string | null
  type: 'booking' | 'payment' | 'ticket' | 'trail_status' | 'weather' | 'overdue'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

// ─── Tenant Configuration JSONB ─────────────────────────────

export type TenantTheme = {
  primary_color: string            // e.g. '#137333'
  accent_color: string             // e.g. '#f5952c'
  logo_url: string | null
  hero_image_url: string | null
  font_family: string | null
}

export type TenantFeatureFlags = {
  simaksi_module: boolean
  insurance_addon: boolean
  guide_porter_module: boolean
  weather_forecast: boolean
  realtime_quota: boolean
  whatsapp_notifications: boolean
  email_notifications: boolean
}

export type TenantSettings = {
  theme: TenantTheme
  features: TenantFeatureFlags
  price_per_person: number         // In IDR
  max_group_size: number
  booking_advance_days: number     // How many days ahead can you book
  checkout_grace_hours: number     // Hours before flagging as OVERDUE
  contact_email: string | null
  contact_phone: string | null
  location_address: string | null
}

// ─── Insert/Update Helpers ───────────────────────────────────

/**
 * Maps a row type T to its valid Insert input type.
 * - AutoGeneratedKeys (e.g. 'id', 'created_at', 'updated_at') are made optional.
 * - Any keys whose types accept null or undefined are made optional.
 */
type InsertOf<T, AutoGeneratedKeys extends string = 'id' | 'created_at' | 'updated_at'> = 
  Omit<T, (AutoGeneratedKeys & keyof T) | {
    [K in keyof T]: null extends T[K] ? K : never
  }[keyof T]> & {
    [K in keyof T as null extends T[K] ? K : never]?: T[K]
  } & {
    [K in AutoGeneratedKeys & keyof T]?: T[K]
  };

// ─── Supabase Database Generic Type ─────────────────────────

export type Database = {
  public: {
    Tables: {
      mountains: {
        Row: Mountain
        Insert: InsertOf<Mountain>
        Update: Partial<InsertOf<Mountain>>
        Relationships: []
      }
      mountain_settings: {
        Row: MountainSettings
        Insert: InsertOf<MountainSettings>
        Update: Partial<InsertOf<MountainSettings>>
        Relationships: []
      }
      trails: {
        Row: Trail
        Insert: InsertOf<Trail>
        Update: Partial<InsertOf<Trail>>
        Relationships: []
      }
      quotas: {
        Row: Quota
        Insert: InsertOf<Quota>
        Update: Partial<InsertOf<Quota>>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: InsertOf<Profile>
        Update: Partial<InsertOf<Profile>>
        Relationships: []
      }
      bookings: {
        Row: Booking
        Insert: InsertOf<Booking>
        Update: Partial<InsertOf<Booking>>
        Relationships: []
      }
      booking_members: {
        Row: BookingMember
        Insert: InsertOf<BookingMember>
        Update: Partial<InsertOf<BookingMember>>
        Relationships: []
      }
      payments: {
        Row: Payment
        Insert: InsertOf<Payment>
        Update: Partial<InsertOf<Payment>>
        Relationships: []
      }
      tickets: {
        Row: Ticket
        Insert: InsertOf<Ticket>
        Update: Partial<InsertOf<Ticket>>
        Relationships: []
      }
      simaksi_documents: {
        Row: SimaksiDocument
        Insert: InsertOf<SimaksiDocument>
        Update: Partial<InsertOf<SimaksiDocument>>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: InsertOf<Notification>
        Update: Partial<InsertOf<Notification>>
        Relationships: []
      }
    }
    Views: {
      [key: string]: never
    }
    Functions: {
      reserve_quota: {
        Args: { p_trail_id: string; p_date: string; p_headcount: number }
        Returns: { success: boolean; available: number; error?: string }
      }
      release_quota: {
        Args: { p_trail_id: string; p_date: string; p_headcount: number }
        Returns: boolean
      }
      flag_overdue_bookings: {
        Args: { p_mountain_id: string }
        Returns: number
      }
    }
    Enums: {
      [key: string]: never
    }
  }
}
