// Domain types for the SS Maintenance API
// https://Solarsector.net/api/maintenance/engineers-ap/proc.php

export type RequestStatus =
  | 'pending'
  | 'price_offered'
  | 'accepted'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | string

export type AdminRole = 'admin' | 'super_admin'

export interface AdminAccount {
  id: number
  name: string
  email: string
  role: AdminRole
  is_active?: 0 | 1 | boolean
  created_at?: string
}

export interface EngineerAccount {
  id: number
  full_name: string
  phone: string
  geo_zone_id: number
  geo_zone_name?: string
  experience_level?: ExperienceLevel | null
  id_card_url?: string | null
  bio?: string | null
  is_active?: 0 | 1 | boolean
  created_at?: string
  active_requests?: number
  completed_requests?: number
}

export interface GeoZone {
  id: number
  name: string
  description?: string | null
  created_at?: string
}

export interface RequestFile {
  id: number
  request_id: number
  file_type: string
  url: string
  created_at?: string
}

export interface RequestActivity {
  id: number
  request_id: number
  actor_type: 'admin' | 'engineer' | 'system'
  actor_id?: number | null
  actor_name?: string | null
  action: string
  comment?: string | null
  created_at: string
}

export interface MaintenanceRequest {
  id: number
  customer_name: string
  customer_phone: string
  full_address: string
  geo_zone_id: number
  zone_name?: string | null
  summary: string
  full_description?: string | null
  status: RequestStatus
  price_range_from?: number | null
  price_range_to?: number | null
  final_price?: number | null
  admin_notes?: string | null
  engineer_notes?: string | null
  engineer_id?: number | null
  engineer_name?: string | null
  engineer_phone?: string | null
  created_at: string
  updated_at?: string
}

export interface MaintenanceRequestDetails extends MaintenanceRequest {
  activities?: RequestActivity[]
  files?: RequestFile[]
}

export interface AdminDashboardData {
  requests: Record<RequestStatus | 'total', number>
  engineers: { total: number; active: number }
  revenue: { total_revenue: number; completed_count: number }
  recent: Array<{
    id: number
    customer_name: string
    status: RequestStatus
    created_at: string
    zone_name?: string | null
  }>
}

export interface EngineerDashboardData {
  engineer: EngineerAccount
  counts: {
    new_assigned: number
    in_progress: number
    on_hold: number
    completed: number
    total: number
  }
  revenue: { total_revenue: number }
  recent: Array<{
    id: number
    customer_name: string
    status: RequestStatus
    created_at: string
    summary: string
  }>
}

export interface AuditLogEntry {
  id: number
  actor_id?: number | null
  actor_name?: string | null
  action: string
  target_type?: string | null
  target_id?: number | null
  details?: string | null
  created_at: string
}
