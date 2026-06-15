// types/database.ts

export type UserRole = 'employee' | 'manager' | 'admin'
export type BillingType = 'billable' | 'internal'
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type AbsenceType =
  | 'sick' | 'vacation' | 'military'
  | 'spouse_sick' | 'parent_sick' | 'child_sick' | 'pregnancy_test'
export type VacationRequestType = 'periodic' | 'continuous'
export type VacationRequestStatus = 'pending' | 'approved' | 'rejected'
export type DocumentType = 'client_report' | 'absence_note'

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: { id: string; name_he: string; name_en: string; manager_id: string | null }
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['departments']['Row']>
        Relationships: []
      }
      users: {
        Row: {
          id: string; email: string
          full_name_he: string; full_name_en: string
          employee_number: string | null
          role: UserRole
          department_id: string | null; manager_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
        Relationships: []
      }
      projects: {
        Row: {
          id: string; name_he: string; name_en: string
          code: string; billing_type: BillingType
          is_active: boolean; created_by: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
        Relationships: []
      }
      user_projects: {
        Row: { user_id: string; project_id: string; assigned_at: string; assigned_by: string | null }
        Insert: Omit<Database['public']['Tables']['user_projects']['Row'], 'assigned_at'>
        Update: Partial<Database['public']['Tables']['user_projects']['Row']>
        Relationships: []
      }
      timesheets: {
        Row: {
          id: string; employee_id: string
          period_start: string; period_end: string
          status: TimesheetStatus
          approved_by: string | null; approved_at: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['timesheets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['timesheets']['Row']>
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          id: string; timesheet_id: string; project_id: string
          work_date: string; hours: number
          employee_notes: string | null; manager_notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['timesheet_entries']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['timesheet_entries']['Row']>
        Relationships: []
      }
      absences: {
        Row: {
          id: string; employee_id: string; type: AbsenceType
          date_start: string; date_end: string; hours: number
          notes: string | null; document_url: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['absences']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['absences']['Row']>
        Relationships: []
      }
      vacation_requests: {
        Row: {
          id: string; employee_id: string
          date_start: string; date_end: string
          type: VacationRequestType; status: VacationRequestStatus
          employee_notes: string | null; manager_notes: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vacation_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['vacation_requests']['Row']>
        Relationships: []
      }
      documents: {
        Row: {
          id: string; employee_id: string; type: DocumentType
          file_url: string; file_name: string
          absence_id: string | null; uploaded_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'uploaded_at'>
        Update: Partial<Database['public']['Tables']['documents']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: UserRole }
      is_my_direct_report: { Args: { employee_uuid: string }; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
