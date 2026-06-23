export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_segments: {
        Row: {
          appointment_id: string
          ends_at: string
          id: string
          member_id: string
          salon_id: string
          starts_at: string
        }
        Insert: {
          appointment_id: string
          ends_at: string
          id?: string
          member_id: string
          salon_id: string
          starts_at: string
        }
        Update: {
          appointment_id?: string
          ends_at?: string
          id?: string
          member_id?: string
          salon_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_segments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_segments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_segments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          commission_amount: number
          commission_percent: number
          duration_min: number
          id: string
          name: string
          price: number
          salon_id: string
          service_id: string | null
        }
        Insert: {
          appointment_id: string
          commission_amount?: number
          commission_percent?: number
          duration_min: number
          id?: string
          name: string
          price: number
          salon_id: string
          service_id?: string | null
        }
        Update: {
          appointment_id?: string
          commission_amount?: number
          commission_percent?: number
          duration_min?: number
          id?: string
          name?: string
          price?: number
          salon_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          member_id: string
          notes: string | null
          payment_method: string | null
          salon_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          member_id: string
          notes?: string | null
          payment_method?: string | null
          salon_id: string
          source?: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          payment_method?: string | null
          salon_id?: string
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_services: {
        Row: {
          campaign_id: string
          salon_id: string
          service_id: string
        }
        Insert: {
          campaign_id: string
          salon_id: string
          service_id: string
        }
        Update: {
          campaign_id?: string
          salon_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_services_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          discount_percent: number
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          salon_id: string
          scope: string
          starts_on: string | null
        }
        Insert: {
          created_at?: string
          discount_percent: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          salon_id: string
          scope?: string
          starts_on?: string | null
        }
        Update: {
          created_at?: string
          discount_percent?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          salon_id?: string
          scope?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_amount: number
          salon_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          salon_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_id: string | null
          payment_method: string | null
          salon_id: string
          session_id: string | null
          type: Database["public"]["Enums"]["cash_tx_type"]
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string | null
          payment_method?: string | null
          salon_id: string
          session_id?: string | null
          type: Database["public"]["Enums"]["cash_tx_type"]
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string | null
          payment_method?: string | null
          salon_id?: string
          session_id?: string | null
          type?: Database["public"]["Enums"]["cash_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_anamnesis: {
        Row: {
          allergies: string | null
          client_id: string
          consent_at: string | null
          consent_given: boolean
          consent_name: string | null
          general_notes: string | null
          has_cancer_treatment: boolean
          has_coagulation_issue: boolean
          has_diabetes: boolean
          has_epilepsy: boolean
          has_heart_condition: boolean
          has_hypertension: boolean
          has_thyroid: boolean
          is_breastfeeding: boolean
          is_pregnant: boolean
          medications: string | null
          recent_procedures: string | null
          salon_id: string
          skin_hair_notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allergies?: string | null
          client_id: string
          consent_at?: string | null
          consent_given?: boolean
          consent_name?: string | null
          general_notes?: string | null
          has_cancer_treatment?: boolean
          has_coagulation_issue?: boolean
          has_diabetes?: boolean
          has_epilepsy?: boolean
          has_heart_condition?: boolean
          has_hypertension?: boolean
          has_thyroid?: boolean
          is_breastfeeding?: boolean
          is_pregnant?: boolean
          medications?: string | null
          recent_procedures?: string | null
          salon_id: string
          skin_hair_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allergies?: string | null
          client_id?: string
          consent_at?: string | null
          consent_given?: boolean
          consent_name?: string | null
          general_notes?: string | null
          has_cancer_treatment?: boolean
          has_coagulation_issue?: boolean
          has_diabetes?: boolean
          has_epilepsy?: boolean
          has_heart_condition?: boolean
          has_hypertension?: boolean
          has_thyroid?: boolean
          is_breastfeeding?: boolean
          is_pregnant?: boolean
          medications?: string | null
          recent_procedures?: string | null
          salon_id?: string
          skin_hair_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_anamnesis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_anamnesis_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_anamnesis_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_package_items: {
        Row: {
          client_package_id: string
          id: string
          name: string
          salon_id: string
          service_id: string | null
          total: number
          unit_price: number
          used: number
        }
        Insert: {
          client_package_id: string
          id?: string
          name: string
          salon_id: string
          service_id?: string | null
          total?: number
          unit_price?: number
          used?: number
        }
        Update: {
          client_package_id?: string
          id?: string
          name?: string
          salon_id?: string
          service_id?: string | null
          total?: number
          unit_price?: number
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_package_items_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          name: string
          price: number
          purchased_at: string
          salon_id: string
          sold_by: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          name: string
          price?: number
          purchased_at?: string
          salon_id: string
          sold_by?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          name?: string
          price?: number
          purchased_at?: string
          salon_id?: string
          sold_by?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_packages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "package_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          alert_summary: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          referral_source: string | null
          salon_id: string
        }
        Insert: {
          alert_summary?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          referral_source?: string | null
          salon_id: string
        }
        Update: {
          alert_summary?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          referral_source?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount: number
          cash_transaction_id: string | null
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          notes: string | null
          period_end: string
          period_start: string
          salon_id: string
        }
        Insert: {
          amount: number
          cash_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          notes?: string | null
          period_end: string
          period_start: string
          salon_id: string
        }
        Update: {
          amount?: number
          cash_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_cash_transaction_id_fkey"
            columns: ["cash_transaction_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          appointment_id: string | null
          appointment_service_id: string | null
          base_amount: number
          created_at: string
          id: string
          is_paid: boolean
          member_id: string
          paid_at: string | null
          percent: number
          salon_id: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          appointment_service_id?: string | null
          base_amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id: string
          paid_at?: string | null
          percent?: number
          salon_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          appointment_service_id?: string | null
          base_amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id?: string
          paid_at?: string | null
          percent?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_appointment_service_id_fkey"
            columns: ["appointment_service_id"]
            isOneToOne: false
            referencedRelation: "appointment_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          amount: number
          created_at: string
          due_day: number | null
          id: string
          is_active: boolean
          name: string
          salon_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_day?: number | null
          id?: string
          is_active?: boolean
          name: string
          salon_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_day?: number | null
          id?: string
          is_active?: boolean
          name?: string
          salon_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          allowed: boolean
          member_id: string
          permission_key: string
        }
        Insert: {
          allowed: boolean
          member_id: string
          permission_key: string
        }
        Update: {
          allowed?: boolean
          member_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          recipient_id: string
          salon_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_id: string
          salon_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_id?: string
          salon_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      package_redemptions: {
        Row: {
          appointment_id: string | null
          client_package_id: string
          commission_amount: number
          created_by: string | null
          id: string
          item_id: string
          member_id: string | null
          salon_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_package_id: string
          commission_amount?: number
          created_by?: string | null
          id?: string
          item_id: string
          member_id?: string | null
          salon_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_package_id?: string
          commission_amount?: number
          created_by?: string | null
          id?: string
          item_id?: string
          member_id?: string | null
          salon_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "client_package_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      package_template_items: {
        Row: {
          id: string
          quantity: number
          salon_id: string
          service_id: string
          template_id: string
        }
        Insert: {
          id?: string
          quantity?: number
          salon_id: string
          service_id: string
          template_id: string
        }
        Update: {
          id?: string
          quantity?: number
          salon_id?: string
          service_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_template_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_template_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "package_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      package_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          salon_id: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          salon_id: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          salon_id?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          key: string
          label: string
        }
        Insert: {
          category: string
          key: string
          label: string
        }
        Update: {
          category?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          is_active: boolean
          is_resale: boolean
          min_quantity: number
          name: string
          quantity: number
          sale_price: number
          salon_id: string
          sku: string | null
          unit: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_resale?: boolean
          min_quantity?: number
          name: string
          quantity?: number
          sale_price?: number
          salon_id: string
          sku?: string | null
          unit?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_resale?: boolean
          min_quantity?: number
          name?: string
          quantity?: number
          sale_price?: number
          salon_id?: string
          sku?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          commission_percent: number | null
          custom_duration_min: number | null
          custom_price: number | null
          id: string
          member_id: string
          salon_id: string
          service_id: string
        }
        Insert: {
          commission_percent?: number | null
          custom_duration_min?: number | null
          custom_price?: number | null
          id?: string
          member_id: string
          salon_id: string
          service_id: string
        }
        Update: {
          commission_percent?: number | null
          custom_duration_min?: number | null
          custom_price?: number | null
          id?: string
          member_id?: string
          salon_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          permission_key: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          allowed?: boolean
          permission_key: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          allowed?: boolean
          permission_key?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      salon_invites: {
        Row: {
          accepted_at: string | null
          commission_percent: number
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          salon_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          salon_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_invites_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_member_details: {
        Row: {
          birth_date: string | null
          chair_rent_amount: number | null
          chair_rent_due_day: number | null
          city: string | null
          complement: string | null
          contract_signed: boolean
          contract_signed_at: string | null
          cpf: string | null
          employment_type: string | null
          member_id: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          personal_phone: string | null
          rg: string | null
          salon_id: string
          state: string | null
          street: string | null
          updated_at: string
          updated_by: string | null
          zip: string | null
        }
        Insert: {
          birth_date?: string | null
          chair_rent_amount?: number | null
          chair_rent_due_day?: number | null
          city?: string | null
          complement?: string | null
          contract_signed?: boolean
          contract_signed_at?: string | null
          cpf?: string | null
          employment_type?: string | null
          member_id: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          personal_phone?: string | null
          rg?: string | null
          salon_id: string
          state?: string | null
          street?: string | null
          updated_at?: string
          updated_by?: string | null
          zip?: string | null
        }
        Update: {
          birth_date?: string | null
          chair_rent_amount?: number | null
          chair_rent_due_day?: number | null
          city?: string | null
          complement?: string | null
          contract_signed?: boolean
          contract_signed_at?: string | null
          cpf?: string | null
          employment_type?: string | null
          member_id?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          personal_phone?: string | null
          rg?: string | null
          salon_id?: string
          state?: string | null
          street?: string | null
          updated_at?: string
          updated_by?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_member_details_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_member_details_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_member_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_gallery: {
        Row: {
          id: string
          salon_id: string
          url: string
          caption: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          url: string
          caption?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          url?: string
          caption?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_members: {
        Row: {
          bio: string | null
          color: string | null
          commission_percent: number
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
        }
        Insert: {
          bio?: string | null
          color?: string | null
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["member_role"]
          salon_id: string
        }
        Update: {
          bio?: string | null
          color?: string | null
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_role_permissions: {
        Row: {
          allowed: boolean
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
        }
        Insert: {
          allowed?: boolean
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
        }
        Update: {
          allowed?: boolean
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["member_role"]
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "salon_role_permissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          current_period_end: string | null
          pending_plan: string | null
          plan: string
          salon_id: string
          status: string
          trial_ends_at: string
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          current_period_end?: string | null
          pending_plan?: string | null
          plan?: string
          salon_id: string
          status?: string
          trial_ends_at?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          current_period_end?: string | null
          pending_plan?: string | null
          plan?: string
          salon_id?: string
          status?: string
          trial_ends_at?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          agenda_color_mode: string
          allow_simultaneous: boolean
          color_theme: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          niche: Database["public"]["Enums"]["salon_niche"]
          owner_id: string
          phone: string | null
          slug: string
          theme: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          agenda_color_mode?: string
          allow_simultaneous?: boolean
          color_theme?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          niche?: Database["public"]["Enums"]["salon_niche"]
          owner_id: string
          phone?: string | null
          slug: string
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          agenda_color_mode?: string
          allow_simultaneous?: boolean
          color_theme?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          niche?: Database["public"]["Enums"]["salon_niche"]
          owner_id?: string
          phone?: string | null
          slug?: string
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          member_id: string | null
          reason: string | null
          salon_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          member_id?: string | null
          reason?: string | null
          salon_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          member_id?: string | null
          reason?: string | null
          salon_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          salon_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          salon_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_products: {
        Row: {
          id: string
          product_id: string
          quantity: number
          salon_id: string
          service_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          salon_id: string
          service_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          salon_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string | null
          color: string | null
          commission_percent: number | null
          created_at: string
          description: string | null
          duration_min: number
          finish_time_min: number
          id: string
          is_active: boolean
          name: string
          price: number
          price_type: string
          processing_time_min: number
          salon_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          commission_percent?: number | null
          created_at?: string
          description?: string | null
          duration_min?: number
          finish_time_min?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          price_type?: string
          processing_time_min?: number
          salon_id: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          commission_percent?: number | null
          created_at?: string
          description?: string | null
          duration_min?: number
          finish_time_min?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          price_type?: string
          processing_time_min?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          salon_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          salon_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          salon_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          created_at: string
          end_time: string
          id: string
          member_id: string | null
          salon_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          member_id?: string | null
          salon_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          member_id?: string | null
          salon_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _appt_check_conflicts: {
        Args: { p_member: string; p_service_ids: string[]; p_starts_at: string }
        Returns: undefined
      }
      _appt_fill: {
        Args: {
          p_appt: string
          p_member: string
          p_member_commission: number
          p_salon: string
          p_service_ids: string[]
          p_starts_at: string
        }
        Returns: string
      }
      _appt_total_span: {
        Args: { p_salon: string; p_service_ids: string[] }
        Returns: number
      }
      accept_invite: {
        Args: {
          p_bio?: string
          p_display_name?: string
          p_full_name?: string
          p_phone?: string
          p_token: string
        }
        Returns: string
      }
      add_member_by_email: {
        Args: {
          p_display_name?: string
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_salon: string
        }
        Returns: {
          bio: string | null
          color: string | null
          commission_percent: number
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
        }
        SetofOptions: {
          from: "*"
          to: "salon_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_appointment: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_member: string
          p_notes?: string
          p_salon: string
          p_service_ids: string[]
          p_starts_at: string
        }
        Returns: {
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          member_id: string
          notes: string | null
          payment_method: string | null
          salon_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      campaign_discount: {
        Args: { p_on: string; p_salon: string; p_service: string }
        Returns: number
      }
      client_has_overlap: {
        Args: { p_client: string; p_end: string; p_start: string }
        Returns: boolean
      }
      create_invite: {
        Args: {
          p_commission?: number
          p_display_name?: string
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_salon: string
        }
        Returns: {
          accepted_at: string | null
          commission_percent: number
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          salon_id: string
          status: string
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "salon_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_salon: {
        Args: {
          p_name: string
          p_niche?: Database["public"]["Enums"]["salon_niche"]
          p_slug: string
          p_theme?: Json
        }
        Returns: {
          address: string | null
          allow_simultaneous: boolean
          color_theme: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          niche: Database["public"]["Enums"]["salon_niche"]
          owner_id: string
          phone: string | null
          slug: string
          theme: Json
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "salons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_appointment: {
        Args: {
          p_client: string
          p_force?: boolean
          p_member: string
          p_salon: string
          p_service_ids: string[]
          p_starts_at: string
          p_status?: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: {
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          member_id: string
          notes: string | null
          payment_method: string | null
          salon_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clients_overview: {
        Args: { p_salon: string }
        Returns: {
          client_id: string
          visits: number
          total_spent: number
          last_visit: string
        }[]
      }
      effective_price: {
        Args: {
          p_base: number
          p_on: string
          p_price_type: string
          p_salon: string
          p_service: string
        }
        Returns: number
      }
      finalize_appointment: {
        Args: { p_appointment: string; p_payment_method?: string }
        Returns: Json
      }
      get_availability: {
        Args: {
          p_date: string
          p_duration: number
          p_member: string
          p_salon: string
        }
        Returns: string[]
      }
      get_invite: {
        Args: { p_token: string }
        Returns: {
          display_name: string
          email: string
          expired: boolean
          role: Database["public"]["Enums"]["member_role"]
          salon_name: string
          salon_slug: string
          status: string
        }[]
      }
      has_permission: {
        Args: { p_perm: string; p_salon: string }
        Returns: boolean
      }
      is_salon_member: { Args: { p_salon: string }; Returns: boolean }
      my_appointments: {
        Args: { p_salon?: string }
        Returns: {
          ends_at: string
          id: string
          member_name: string
          salon_id: string
          salon_name: string
          services: string[]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
        }[]
      }
      my_member_id: { Args: { p_salon: string }; Returns: string }
      pay_commission: {
        Args: {
          p_amount: number
          p_member: string
          p_period_end: string
          p_period_start: string
          p_salon: string
        }
        Returns: Json
      }
      public_appointments_by_phone: {
        Args: { p_phone: string; p_salon: string }
        Returns: {
          ends_at: string
          id: string
          member_name: string
          salon_id: string
          salon_name: string
          services: string[]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
        }[]
      }
      public_campaign_discounts: {
        Args: { p_salon: string }
        Returns: {
          discount_percent: number
          service_id: string
        }[]
      }
      public_professional_services: {
        Args: { p_salon: string }
        Returns: {
          member_id: string
          service_id: string
        }[]
      }
      public_professionals: {
        Args: { p_salon: string; p_service?: string }
        Returns: {
          bio: string
          color: string
          display_name: string
          id: string
          photo_url: string
        }[]
      }
      public_salon: {
        Args: { p_slug: string }
        Returns: {
          address: string
          color_theme: string
          id: string
          logo_url: string
          name: string
          niche: Database["public"]["Enums"]["salon_niche"]
          phone: string
          slug: string
          theme: Json
        }[]
      }
      public_service_categories: {
        Args: { p_salon: string }
        Returns: {
          id: string
          name: string
          sort_order: number
        }[]
      }
      public_services: {
        Args: { p_salon: string }
        Returns: {
          category_id: string
          color: string
          description: string
          duration_min: number
          id: string
          name: string
          price: number
          price_type: string
        }[]
      }
      receivable_today: { Args: { p_salon: string }; Returns: Json }
      redeem_package: {
        Args: { p_item: string; p_member?: string }
        Returns: Json
      }
      report_heatmap: {
        Args: { p_from: string; p_salon: string; p_to: string }
        Returns: Json
      }
      report_overview: {
        Args: { p_from: string; p_salon: string; p_to: string }
        Returns: Json
      }
      report_reactivation: {
        Args: { p_min_days?: number; p_salon: string }
        Returns: Json
      }
      revoke_invite: { Args: { p_id: string }; Returns: undefined }
      salon_access_status: {
        Args: { p_slug: string }
        Returns: {
          current_period_end: string
          effective_plan: string
          has_access: boolean
          pending_plan: string
          plan: string
          status: string
          trial_ends_at: string
        }[]
      }
      segments_conflict: {
        Args: { p_end: string; p_member: string; p_start: string }
        Returns: boolean
      }
      sell_package: {
        Args: {
          p_client: string
          p_payment_method?: string
          p_salon: string
          p_template: string
        }
        Returns: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          name: string
          price: number
          purchased_at: string
          salon_id: string
          sold_by: string | null
          status: string
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_packages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upcoming_birthdays: {
        Args: { p_days?: number; p_salon: string }
        Returns: Json
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      cash_tx_type: "income" | "expense"
      member_role: "owner" | "manager" | "professional" | "receptionist"
      salon_niche: "feminino" | "barbearia" | "estetica" | "neutro"
      stock_movement_type: "in" | "out" | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      cash_tx_type: ["income", "expense"],
      member_role: ["owner", "manager", "professional", "receptionist"],
      salon_niche: ["feminino", "barbearia", "estetica", "neutro"],
      stock_movement_type: ["in", "out", "adjustment"],
    },
  },
} as const
