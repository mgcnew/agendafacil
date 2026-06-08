export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
      appointment_segments: {
        Row: {
          id: string
          salon_id: string
          appointment_id: string
          member_id: string
          starts_at: string
          ends_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          appointment_id: string
          member_id: string
          starts_at: string
          ends_at: string
        }
        Update: Partial<Database["public"]["Tables"]["appointment_segments"]["Insert"]>
        Relationships: []
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
          client_id: string
          salon_id: string
          is_pregnant: boolean
          is_breastfeeding: boolean
          has_diabetes: boolean
          has_hypertension: boolean
          has_heart_condition: boolean
          has_epilepsy: boolean
          has_thyroid: boolean
          has_coagulation_issue: boolean
          has_cancer_treatment: boolean
          allergies: string | null
          medications: string | null
          recent_procedures: string | null
          skin_hair_notes: string | null
          general_notes: string | null
          consent_given: boolean
          consent_name: string | null
          consent_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          salon_id: string
          is_pregnant?: boolean
          is_breastfeeding?: boolean
          has_diabetes?: boolean
          has_hypertension?: boolean
          has_heart_condition?: boolean
          has_epilepsy?: boolean
          has_thyroid?: boolean
          has_coagulation_issue?: boolean
          has_cancer_treatment?: boolean
          allergies?: string | null
          medications?: string | null
          recent_procedures?: string | null
          skin_hair_notes?: string | null
          general_notes?: string | null
          consent_given?: boolean
          consent_name?: string | null
          consent_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["client_anamnesis"]["Insert"]>
        Relationships: []
      }
      clients: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          referral_source: string | null
          alert_summary: string | null
          salon_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          referral_source?: string | null
          alert_summary?: string | null
          salon_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          referral_source?: string | null
          alert_summary?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_salon_id_fkey"
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
            foreignKeyName: "commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "salon_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: { allowed: boolean; member_id: string; permission_key: string }
        Insert: { allowed: boolean; member_id: string; permission_key: string }
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
        Relationships: []
      }
      permissions: {
        Row: { category: string; key: string; label: string }
        Insert: { category: string; key: string; label: string }
        Update: { category?: string; key?: string; label?: string }
        Relationships: []
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          is_active: boolean
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
          min_quantity?: number
          name?: string
          quantity?: number
          sale_price?: number
          salon_id?: string
          sku?: string | null
          unit?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
      salons: {
        Row: {
          address: string | null
          color_theme: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          niche: Database["public"]["Enums"]["salon_niche"]
          owner_id: string
          allow_simultaneous: boolean
          phone: string | null
          slug: string
          theme: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          color_theme?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          niche?: Database["public"]["Enums"]["salon_niche"]
          owner_id: string
          allow_simultaneous?: boolean
          phone?: string | null
          slug: string
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          color_theme?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          niche?: Database["public"]["Enums"]["salon_niche"]
          owner_id?: string
          allow_simultaneous?: boolean
          phone?: string | null
          slug?: string
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      service_categories: {
        Row: { created_at: string; id: string; name: string; salon_id: string; sort_order: number }
        Insert: { created_at?: string; id?: string; name: string; salon_id: string; sort_order?: number }
        Update: { created_at?: string; id?: string; name?: string; salon_id?: string; sort_order?: number }
        Relationships: []
      }
      service_products: {
        Row: { id: string; product_id: string; quantity: number; salon_id: string; service_id: string }
        Insert: { id?: string; product_id: string; quantity?: number; salon_id: string; service_id: string }
        Update: { id?: string; product_id?: string; quantity?: number; salon_id?: string; service_id?: string }
        Relationships: [
          {
            foreignKeyName: "service_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          processing_time_min: number
          finish_time_min: number
          id: string
          is_active: boolean
          name: string
          price: number
          price_type: string
          salon_id: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          commission_percent?: number | null
          created_at?: string
          description?: string | null
          duration_min?: number
          processing_time_min?: number
          finish_time_min?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          price_type?: string
          salon_id: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          commission_percent?: number | null
          created_at?: string
          description?: string | null
          duration_min?: number
          processing_time_min?: number
          finish_time_min?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          price_type?: string
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
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      add_member_by_email: {
        Args: {
          p_display_name?: string
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_salon: string
        }
        Returns: Database["public"]["Tables"]["salon_members"]["Row"]
      }
      create_invite: {
        Args: {
          p_salon: string
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_commission?: number
          p_display_name?: string
        }
        Returns: Database["public"]["Tables"]["salon_invites"]["Row"]
      }
      finalize_appointment: {
        Args: { p_appointment: string; p_payment_method?: string }
        Returns: Json
      }
      get_invite: {
        Args: { p_token: string }
        Returns: {
          salon_name: string
          salon_slug: string
          email: string
          role: Database["public"]["Enums"]["member_role"]
          display_name: string | null
          status: string
          expired: boolean
        }[]
      }
      accept_invite: {
        Args: {
          p_token: string
          p_full_name?: string
          p_phone?: string
          p_display_name?: string
          p_bio?: string
        }
        Returns: string
      }
      revoke_invite: {
        Args: { p_id: string }
        Returns: undefined
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
        Returns: Database["public"]["Tables"]["appointments"]["Row"]
      }
      create_salon: {
        Args: {
          p_name: string
          p_niche?: Database["public"]["Enums"]["salon_niche"]
          p_slug: string
          p_theme?: Json
        }
        Returns: Database["public"]["Tables"]["salons"]["Row"]
      }
      create_staff_appointment: {
        Args: {
          p_salon: string
          p_member: string
          p_client: string | null
          p_service_ids: string[]
          p_starts_at: string
          p_status?: Database["public"]["Enums"]["appointment_status"]
          p_force?: boolean
        }
        Returns: Database["public"]["Tables"]["appointments"]["Row"]
      }
      get_availability: {
        Args: { p_date: string; p_duration: number; p_member: string; p_salon: string }
        Returns: string[]
      }
      has_permission: { Args: { p_perm: string; p_salon: string }; Returns: boolean }
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
      public_professionals: {
        Args: { p_salon: string; p_service?: string }
        Returns: { bio: string; color: string; display_name: string; id: string }[]
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
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
