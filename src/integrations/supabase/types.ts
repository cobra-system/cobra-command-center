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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      center_contacts: {
        Row: {
          center_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "center_contacts_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      center_inventory: {
        Row: {
          center_id: string
          id: string
          min_stock: number
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          center_id: string
          id?: string
          min_stock?: number
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          center_id?: string
          id?: string
          min_stock?: number
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_inventory_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_items: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          name: string
          notes: string | null
          product_id: string | null
          renewal_contact: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          name: string
          notes?: string | null
          product_id?: string | null
          renewal_contact?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_id?: string | null
          renewal_contact?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_product_links: {
        Row: {
          compliance_item_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          compliance_item_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          compliance_item_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_product_links_compliance_item_id_fkey"
            columns: ["compliance_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          action_items: Json | null
          cobra_updates: Json | null
          created_at: string
          day_name: string | null
          generated_by: string | null
          id: string
          mail_drafts: Json | null
          meetings: Json | null
          new_files: Json | null
          notes: string | null
          pending_clarifications: Json | null
          report_date: string
          total_action_items: number | null
          total_cobra_updates: number | null
          total_mail_drafts: number | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          cobra_updates?: Json | null
          created_at?: string
          day_name?: string | null
          generated_by?: string | null
          id?: string
          mail_drafts?: Json | null
          meetings?: Json | null
          new_files?: Json | null
          notes?: string | null
          pending_clarifications?: Json | null
          report_date: string
          total_action_items?: number | null
          total_cobra_updates?: number | null
          total_mail_drafts?: number | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          cobra_updates?: Json | null
          created_at?: string
          day_name?: string | null
          generated_by?: string | null
          id?: string
          mail_drafts?: Json | null
          meetings?: Json | null
          new_files?: Json | null
          notes?: string | null
          pending_clarifications?: Json | null
          report_date?: string
          total_action_items?: number | null
          total_cobra_updates?: number | null
          total_mail_drafts?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      distribution_centers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_main: boolean
          name: string
          sap_code: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_main?: boolean
          name: string
          sap_code?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_main?: boolean
          name?: string
          sap_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      division_contacts: {
        Row: {
          created_at: string | null
          division: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          division: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          division?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      division_product_consumption: {
        Row: {
          created_at: string | null
          division: string
          id: string
          month: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          division: string
          id?: string
          month: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string | null
          division?: string
          id?: string
          month?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "division_product_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "division_product_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      division_product_items: {
        Row: {
          component_id: string
          created_at: string | null
          division: string
          division_stock: number
          division_stock_updated_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          component_id: string
          created_at?: string | null
          division: string
          division_stock?: number
          division_stock_updated_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          component_id?: string
          created_at?: string | null
          division?: string
          division_stock?: number
          division_stock_updated_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "division_product_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "division_product_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      division_products: {
        Row: {
          created_at: string | null
          division: string
          division_stock: number
          division_stock_updated_at: string | null
          id: string
          monthly_avg: number | null
          monthly_avg_updated_at: string | null
          notes: string | null
          product_id: string
          quarterly_demand: number | null
          quarterly_demand_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          division: string
          division_stock?: number
          division_stock_updated_at?: string | null
          id?: string
          monthly_avg?: number | null
          monthly_avg_updated_at?: string | null
          notes?: string | null
          product_id: string
          quarterly_demand?: number | null
          quarterly_demand_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          division?: string
          division_stock?: number
          division_stock_updated_at?: string | null
          id?: string
          monthly_avg?: number | null
          monthly_avg_updated_at?: string | null
          notes?: string | null
          product_id?: string
          quarterly_demand?: number | null
          quarterly_demand_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "division_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "division_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_products: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_products_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_pickup_items: {
        Row: {
          created_at: string | null
          id: string
          pickup_id: string
          product_id: string
          quantity: number
          serial_numbers: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pickup_id: string
          product_id: string
          quantity?: number
          serial_numbers?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pickup_id?: string
          product_id?: string
          quantity?: number
          serial_numbers?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_pickup_items_pickup_id_fkey"
            columns: ["pickup_id"]
            isOneToOne: false
            referencedRelation: "equipment_pickups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pickup_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pickup_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_pickups: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          installer_id: string
          notes: string | null
          pickup_date: string
          source_email_subject: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          installer_id: string
          notes?: string | null
          pickup_date: string
          source_email_subject?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          installer_id?: string
          notes?: string | null
          pickup_date?: string
          source_email_subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_pickups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pickups_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_return_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string | null
          id: string
          is_actually_faulty: boolean | null
          photo_url: string | null
          product_id: string
          quantity: number
          reason: string
          reason_detail: string | null
          return_id: string
          serial_numbers: string[] | null
          sticker_label: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          id?: string
          is_actually_faulty?: boolean | null
          photo_url?: string | null
          product_id: string
          quantity?: number
          reason?: string
          reason_detail?: string | null
          return_id: string
          serial_numbers?: string[] | null
          sticker_label?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          id?: string
          is_actually_faulty?: boolean | null
          photo_url?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          reason_detail?: string | null
          return_id?: string
          serial_numbers?: string[] | null
          sticker_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_return_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "equipment_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_returns: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          installer_id: string
          logged_by: string | null
          notes: string | null
          return_date: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          installer_id: string
          logged_by?: string | null
          notes?: string | null
          return_date: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          installer_id?: string
          logged_by?: string | null
          notes?: string | null
          return_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_returns_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frisbee_inspection_equipment: {
        Row: {
          base44_equipment_id: string
          base44_inspection_id: string
          checked: boolean
          equipment_name: string | null
          id: string
        }
        Insert: {
          base44_equipment_id: string
          base44_inspection_id: string
          checked?: boolean
          equipment_name?: string | null
          id?: string
        }
        Update: {
          base44_equipment_id?: string
          base44_inspection_id?: string
          checked?: boolean
          equipment_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "frisbee_inspection_equipment_base44_inspection_id_fkey"
            columns: ["base44_inspection_id"]
            isOneToOne: false
            referencedRelation: "frisbee_inspections"
            referencedColumns: ["base44_id"]
          },
        ]
      }
      frisbee_inspections: {
        Row: {
          base44_branch_id: string | null
          base44_created_date: string | null
          base44_id: string
          chassis_color: string | null
          detailing_nano_coating: boolean | null
          detailing_ppf_glossy: boolean | null
          detailing_ppf_interior: boolean | null
          detailing_ppf_matte: boolean | null
          detailing_uv_roof: boolean | null
          detailing_window_tint: boolean | null
          diagnostics_code: string | null
          diagnostics_report_url: string | null
          fault_count: number
          faults: Json | null
          id: string
          inspection_date: string | null
          inspector_name: string | null
          installer_names: string[] | null
          is_all_ok: boolean | null
          manufacturer: string | null
          model: string | null
          owner_name: string | null
          preliminary_faults: string | null
          protection_code: string | null
          protection_provider: string | null
          requires_detailing: boolean
          status: string | null
          synced_at: string
          vehicle_number: string | null
        }
        Insert: {
          base44_branch_id?: string | null
          base44_created_date?: string | null
          base44_id: string
          chassis_color?: string | null
          detailing_nano_coating?: boolean | null
          detailing_ppf_glossy?: boolean | null
          detailing_ppf_interior?: boolean | null
          detailing_ppf_matte?: boolean | null
          detailing_uv_roof?: boolean | null
          detailing_window_tint?: boolean | null
          diagnostics_code?: string | null
          diagnostics_report_url?: string | null
          fault_count?: number
          faults?: Json | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          installer_names?: string[] | null
          is_all_ok?: boolean | null
          manufacturer?: string | null
          model?: string | null
          owner_name?: string | null
          preliminary_faults?: string | null
          protection_code?: string | null
          protection_provider?: string | null
          requires_detailing?: boolean
          status?: string | null
          synced_at?: string
          vehicle_number?: string | null
        }
        Update: {
          base44_branch_id?: string | null
          base44_created_date?: string | null
          base44_id?: string
          chassis_color?: string | null
          detailing_nano_coating?: boolean | null
          detailing_ppf_glossy?: boolean | null
          detailing_ppf_interior?: boolean | null
          detailing_ppf_matte?: boolean | null
          detailing_uv_roof?: boolean | null
          detailing_window_tint?: boolean | null
          diagnostics_code?: string | null
          diagnostics_report_url?: string | null
          fault_count?: number
          faults?: Json | null
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          installer_names?: string[] | null
          is_all_ok?: boolean | null
          manufacturer?: string | null
          model?: string | null
          owner_name?: string | null
          preliminary_faults?: string | null
          protection_code?: string | null
          protection_provider?: string | null
          requires_detailing?: boolean
          status?: string | null
          synced_at?: string
          vehicle_number?: string | null
        }
        Relationships: []
      }
      frisbee_product_mapping: {
        Row: {
          base44_equipment_id: string
          base44_equipment_name: string
          created_at: string
          display_name: string | null
          id: string
          product_id: string | null
        }
        Insert: {
          base44_equipment_id: string
          base44_equipment_name: string
          created_at?: string
          display_name?: string | null
          id?: string
          product_id?: string | null
        }
        Update: {
          base44_equipment_id?: string
          base44_equipment_name?: string
          created_at?: string
          display_name?: string | null
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frisbee_product_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frisbee_product_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      frisbee_sync_config: {
        Row: {
          app_id: string
          branch_name: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          token: string
          updated_at: string
        }
        Insert: {
          app_id: string
          branch_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          branch_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      installers: {
        Row: {
          center_id: string | null
          coordinator: string | null
          created_at: string | null
          deleted_at: string | null
          division: string
          entity_type: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string | null
          warehouse_number: number | null
        }
        Insert: {
          center_id?: string | null
          coordinator?: string | null
          created_at?: string | null
          deleted_at?: string | null
          division?: string
          entity_type?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
          warehouse_number?: number | null
        }
        Update: {
          center_id?: string | null
          coordinator?: string | null
          created_at?: string | null
          deleted_at?: string | null
          division?: string
          entity_type?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string | null
          warehouse_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "installers_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          created_at: string
          from_center_id: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          to_center_id: string | null
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          from_center_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          to_center_id?: string | null
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          from_center_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          to_center_id?: string | null
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_center_id_fkey"
            columns: ["from_center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_center_id_fkey"
            columns: ["to_center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_attachments: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string | null
          file_type: string
          file_url: string
          id: string
          issue_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_type: string
          file_url: string
          id?: string
          issue_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          file_type?: string
          file_url?: string
          id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "product_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_updates: {
        Row: {
          author_name: string
          content: string
          created_at: string | null
          id: string
          issue_id: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string | null
          id?: string
          issue_id: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string | null
          id?: string
          issue_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_updates_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "product_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_journal: {
        Row: {
          content: string
          created_at: string
          created_by: string
          date: string
          id: string
          linked_id: string | null
          linked_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          date?: string
          id?: string
          linked_id?: string | null
          linked_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          linked_id?: string | null
          linked_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          assignee_id: string | null
          content: string
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          status: string
        }
        Insert: {
          assignee_id?: string | null
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          status?: string
        }
        Update: {
          assignee_id?: string | null
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_name: string
          file_url: string
          id: string
          meeting_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_name: string
          file_url: string
          id?: string
          meeting_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_name?: string
          file_url?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          participant_id: string
          participant_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          participant_id: string
          participant_type: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          participant_id?: string
          participant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          meeting_date: string
          notes: string | null
          status: string
          summary: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meeting_date?: string
          notes?: string | null
          status?: string
          summary?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meeting_date?: string
          notes?: string | null
          status?: string
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          recipient_division: string | null
          recipient_role: string | null
          recipient_user_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          recipient_division?: string | null
          recipient_role?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          recipient_division?: string | null
          recipient_role?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          channel: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          channel: string
          config: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          name: string
          order_id: string
          price: number | null
          product_id: string | null
          qty: number
        }
        Insert: {
          id?: string
          name: string
          order_id: string
          price?: number | null
          product_id?: string | null
          qty: number
        }
        Update: {
          id?: string
          name?: string
          order_id?: string
          price?: number | null
          product_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          note_text: string | null
          order_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note_text?: string | null
          order_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note_text?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_id: string
          paid_date: string | null
          payment_type: string
          percentage: number | null
          status: string | null
          swift_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id: string
          paid_date?: string | null
          payment_type: string
          percentage?: number | null
          status?: string | null
          swift_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          paid_date?: string | null
          payment_type?: string
          percentage?: number | null
          status?: string | null
          swift_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          request_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          created_by_role: string | null
          id: string
          request_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          request_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          field_name: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          request_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          request_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_snapshots: {
        Row: {
          captured_at: string
          captured_by: string | null
          captured_by_name: string | null
          division: string | null
          id: string
          label: string
          notes: string | null
          payload: Json
          total_estimated_value: number | null
          total_requests: number
          total_required_qty: number | null
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          captured_by_name?: string | null
          division?: string | null
          id?: string
          label: string
          notes?: string | null
          payload: Json
          total_estimated_value?: number | null
          total_requests?: number
          total_required_qty?: number | null
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          captured_by_name?: string | null
          division?: string | null
          id?: string
          label?: string
          notes?: string | null
          payload?: Json
          total_estimated_value?: number | null
          total_requests?: number
          total_required_qty?: number | null
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          actual_ordered_qty: number | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          current_consumption: string | null
          deleted_at: string | null
          division: string
          division_stock_at_request: number | null
          estimated_arrival_date: string | null
          estimated_unit_price: number | null
          id: string
          incoming_arrival_date: string | null
          incoming_orders: number | null
          main_warehouse_stock: number | null
          notes: string | null
          order_execution_date: string | null
          order_id: string | null
          order_type: string
          ordered_at: string | null
          ordered_by: string | null
          ordered_by_name: string | null
          payment_status: string | null
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number | null
          quarterly_forecast: number | null
          reason: string | null
          reject_reason: string | null
          required_to_order: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          shipping_type: string | null
          smoothed_required: number | null
          status: string
          supplier: string | null
          supplier_id: string | null
          updated_at: string
          urgency: string
          utilization_pct: number | null
        }
        Insert: {
          actual_ordered_qty?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          current_consumption?: string | null
          deleted_at?: string | null
          division: string
          division_stock_at_request?: number | null
          estimated_arrival_date?: string | null
          estimated_unit_price?: number | null
          id?: string
          incoming_arrival_date?: string | null
          incoming_orders?: number | null
          main_warehouse_stock?: number | null
          notes?: string | null
          order_execution_date?: string | null
          order_id?: string | null
          order_type?: string
          ordered_at?: string | null
          ordered_by?: string | null
          ordered_by_name?: string | null
          payment_status?: string | null
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number | null
          quarterly_forecast?: number | null
          reason?: string | null
          reject_reason?: string | null
          required_to_order?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          shipping_type?: string | null
          smoothed_required?: number | null
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          urgency?: string
          utilization_pct?: number | null
        }
        Update: {
          actual_ordered_qty?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          current_consumption?: string | null
          deleted_at?: string | null
          division?: string
          division_stock_at_request?: number | null
          estimated_arrival_date?: string | null
          estimated_unit_price?: number | null
          id?: string
          incoming_arrival_date?: string | null
          incoming_orders?: number | null
          main_warehouse_stock?: number | null
          notes?: string | null
          order_execution_date?: string | null
          order_id?: string | null
          order_type?: string
          ordered_at?: string | null
          ordered_by?: string | null
          ordered_by_name?: string | null
          payment_status?: string | null
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number | null
          quarterly_forecast?: number | null
          reason?: string | null
          reject_reason?: string | null
          required_to_order?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          shipping_type?: string | null
          smoothed_required?: number | null
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          urgency?: string
          utilization_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booking_number: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          division: string | null
          eta: string | null
          etd: string | null
          id: string
          notes: string | null
          order_date: string | null
          pi_number: string | null
          priority: string
          sap_doc_entry: string | null
          shipment_group_id: string | null
          shipping: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          tclog_reference: string | null
          total_price: number | null
          tracking_carrier: string | null
          tracking_description: string | null
          tracking_destination: string | null
          tracking_eta: string | null
          tracking_events: Json | null
          tracking_last_event: string | null
          tracking_last_location: string | null
          tracking_last_synced_at: string | null
          tracking_number: string | null
          tracking_origin: string | null
          tracking_raw_status: string | null
          tracking_status: string | null
          tracking_status_code: string | null
          tracking_sync_error: string | null
          tracking_updated_at: string | null
          updated_at: string
          vessel_name: string | null
        }
        Insert: {
          booking_number?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          division?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          pi_number?: string | null
          priority?: string
          sap_doc_entry?: string | null
          shipment_group_id?: string | null
          shipping?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          tclog_reference?: string | null
          total_price?: number | null
          tracking_carrier?: string | null
          tracking_description?: string | null
          tracking_destination?: string | null
          tracking_eta?: string | null
          tracking_events?: Json | null
          tracking_last_event?: string | null
          tracking_last_location?: string | null
          tracking_last_synced_at?: string | null
          tracking_number?: string | null
          tracking_origin?: string | null
          tracking_raw_status?: string | null
          tracking_status?: string | null
          tracking_status_code?: string | null
          tracking_sync_error?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          vessel_name?: string | null
        }
        Update: {
          booking_number?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          division?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          pi_number?: string | null
          priority?: string
          sap_doc_entry?: string | null
          shipment_group_id?: string | null
          shipping?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          tclog_reference?: string | null
          total_price?: number | null
          tracking_carrier?: string | null
          tracking_description?: string | null
          tracking_destination?: string | null
          tracking_eta?: string | null
          tracking_events?: Json | null
          tracking_last_event?: string | null
          tracking_last_location?: string | null
          tracking_last_synced_at?: string | null
          tracking_number?: string | null
          tracking_origin?: string | null
          tracking_raw_status?: string | null
          tracking_status?: string | null
          tracking_status_code?: string | null
          tracking_sync_error?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipment_group_id_fkey"
            columns: ["shipment_group_id"]
            isOneToOne: false
            referencedRelation: "shipment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_meeting_orders: {
        Row: {
          approved_amount: number | null
          created_at: string
          decision: string
          id: string
          meeting_id: string
          notes: string | null
          order_id: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          decision?: string
          id?: string
          meeting_id: string
          notes?: string | null
          order_id: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          decision?: string
          id?: string
          meeting_id?: string
          notes?: string | null
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_meeting_orders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_meeting_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_components: {
        Row: {
          id: string
          image_url: string | null
          name: string
          notes: string | null
          origin: string | null
          price: number | null
          product_id: string
          sku: string | null
          stock_qty: number | null
          supplier: string | null
        }
        Insert: {
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          price?: number | null
          product_id: string
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
        }
        Update: {
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          price?: number | null
          product_id?: string
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      product_issues: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string
          diagnostic_source: string | null
          diagnostic_steps: Json | null
          id: string
          image_url: string | null
          product_id: string
          reported_date: string
          reporter: string
          resolution: string | null
          resolved_date: string | null
          severity: string
          status: string
          ticket_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          diagnostic_source?: string | null
          diagnostic_steps?: Json | null
          id?: string
          image_url?: string | null
          product_id: string
          reported_date?: string
          reporter?: string
          resolution?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          ticket_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          diagnostic_source?: string | null
          diagnostic_steps?: Json | null
          id?: string
          image_url?: string | null
          product_id?: string
          reported_date?: string
          reporter?: string
          resolution?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          ticket_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      product_model_mappings: {
        Row: {
          created_at: string
          division: string
          id: string
          model_family: string
          notes: string | null
          product_id: string
          updated_at: string
          utilization_pct: number
        }
        Insert: {
          created_at?: string
          division: string
          id?: string
          model_family: string
          notes?: string | null
          product_id: string
          updated_at?: string
          utilization_pct?: number
        }
        Update: {
          created_at?: string
          division?: string
          id?: string
          model_family?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
          utilization_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_model_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_model_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          division: string | null
          end_product_image: string | null
          end_product_url: string | null
          id: string
          incoming_qty: number
          lead_time_days: number | null
          monthly_order: number | null
          monthly_sales: number | null
          monthly_sales_avg: number | null
          name: string
          notes: string | null
          product_type: string
          purchase_price: number | null
          reorder_point: number | null
          sale_price: number | null
          sap_code: string | null
          shipping: string | null
          sku: string
          stock_qty: number
          supplier: string | null
          supplier_origin: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          division?: string | null
          end_product_image?: string | null
          end_product_url?: string | null
          id?: string
          incoming_qty?: number
          lead_time_days?: number | null
          monthly_order?: number | null
          monthly_sales?: number | null
          monthly_sales_avg?: number | null
          name: string
          notes?: string | null
          product_type: string
          purchase_price?: number | null
          reorder_point?: number | null
          sale_price?: number | null
          sap_code?: string | null
          shipping?: string | null
          sku: string
          stock_qty?: number
          supplier?: string | null
          supplier_origin?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          division?: string | null
          end_product_image?: string | null
          end_product_url?: string | null
          id?: string
          incoming_qty?: number
          lead_time_days?: number | null
          monthly_order?: number | null
          monthly_sales?: number | null
          monthly_sales_avg?: number | null
          name?: string
          notes?: string | null
          product_type?: string
          purchase_price?: number | null
          reorder_point?: number | null
          sale_price?: number | null
          sap_code?: string | null
          shipping?: string | null
          sku?: string
          stock_qty?: number
          supplier?: string | null
          supplier_origin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_product_ids: string[] | null
          created_at: string
          division: string | null
          id: string
          name: string
          pin: string | null
          role: Database["public"]["Enums"]["app_role"]
          role_definition_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_product_ids?: string[] | null
          created_at?: string
          division?: string | null
          id: string
          name: string
          pin?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          role_definition_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_product_ids?: string[] | null
          created_at?: string
          division?: string | null
          id?: string
          name?: string
          pin?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          role_definition_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_documents: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          document_name: string | null
          document_number: string | null
          expiry_date: string | null
          file_url: string | null
          folder_id: string | null
          id: string
          is_starred: boolean
          notes: string | null
          order_id: string | null
          product_id: string | null
          quantity: number
          status: string
          supplier_id: string | null
          total_price: number | null
          type: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_name?: string | null
          document_number?: string | null
          expiry_date?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          supplier_id?: string | null
          total_price?: number | null
          type: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_name?: string | null
          document_number?: string | null
          expiry_date?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          supplier_id?: string | null
          total_price?: number | null
          type?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_plan_snapshots: {
        Row: {
          captured_at: string
          captured_by: string | null
          captured_by_name: string | null
          division: string
          id: string
          label: string
          notes: string | null
          payload: Json
          quarter: number
          total_products: number | null
          total_required: number | null
          year: number
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          captured_by_name?: string | null
          division: string
          id?: string
          label: string
          notes?: string | null
          payload: Json
          quarter: number
          total_products?: number | null
          total_required?: number | null
          year: number
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          captured_by_name?: string | null
          division?: string
          id?: string
          label?: string
          notes?: string | null
          payload?: Json
          quarter?: number
          total_products?: number | null
          total_required?: number | null
          year?: number
        }
        Relationships: []
      }
      quarterly_procurement_plans: {
        Row: {
          actual_ordered_qty: number | null
          computed_forecast: number | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          division: string
          estimated_arrival_date: string | null
          id: string
          incoming_arrival_date: string | null
          incoming_orders: number | null
          manual_forecast_override: number | null
          month1_demand: number | null
          month2_demand: number | null
          month3_demand: number | null
          notes: string | null
          order_execution_date: string | null
          payment_status: string | null
          product_id: string
          quarter: number
          required_to_order: number | null
          safety_buffer: number | null
          shipping_type: string | null
          smoothed_required: number | null
          updated_at: string
          utilization_pct: number | null
          year: number
        }
        Insert: {
          actual_ordered_qty?: number | null
          computed_forecast?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          division: string
          estimated_arrival_date?: string | null
          id?: string
          incoming_arrival_date?: string | null
          incoming_orders?: number | null
          manual_forecast_override?: number | null
          month1_demand?: number | null
          month2_demand?: number | null
          month3_demand?: number | null
          notes?: string | null
          order_execution_date?: string | null
          payment_status?: string | null
          product_id: string
          quarter: number
          required_to_order?: number | null
          safety_buffer?: number | null
          shipping_type?: string | null
          smoothed_required?: number | null
          updated_at?: string
          utilization_pct?: number | null
          year: number
        }
        Update: {
          actual_ordered_qty?: number | null
          computed_forecast?: number | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          division?: string
          estimated_arrival_date?: string | null
          id?: string
          incoming_arrival_date?: string | null
          incoming_orders?: number | null
          manual_forecast_override?: number | null
          month1_demand?: number | null
          month2_demand?: number | null
          month3_demand?: number | null
          notes?: string | null
          order_execution_date?: string | null
          payment_status?: string | null
          product_id?: string
          quarter?: number
          required_to_order?: number | null
          safety_buffer?: number | null
          shipping_type?: string | null
          smoothed_required?: number | null
          updated_at?: string
          utilization_pct?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_procurement_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_procurement_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_vehicle_forecasts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month1_qty: number
          month2_qty: number
          month3_qty: number
          notes: string | null
          quarter: number
          total_qty: number | null
          updated_at: string
          vehicle_model_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month1_qty?: number
          month2_qty?: number
          month3_qty?: number
          notes?: string | null
          quarter: number
          total_qty?: number | null
          updated_at?: string
          vehicle_model_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month1_qty?: number
          month2_qty?: number
          month3_qty?: number
          notes?: string | null
          quarter?: number
          total_qty?: number | null
          updated_at?: string
          vehicle_model_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_vehicle_forecasts_vehicle_model_id_fkey"
            columns: ["vehicle_model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          created_at: string
          id: string
          name: string
          system_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          system_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          system_key?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          module_key: string
          permission_level: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          permission_level?: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          permission_level?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sap_sync_log: {
        Row: {
          created_at: string
          details: string | null
          direction: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          sap_code: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          direction?: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          sap_code?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          direction?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          sap_code?: string | null
          status?: string
        }
        Relationships: []
      }
      shipment_groups: {
        Row: {
          arrival_date: string | null
          booking_number: string | null
          created_at: string | null
          deleted_at: string | null
          departure_date: string | null
          id: string
          name: string
          notes: string | null
          tclog_reference: string | null
          updated_at: string | null
          vessel_name: string | null
        }
        Insert: {
          arrival_date?: string | null
          booking_number?: string | null
          created_at?: string | null
          deleted_at?: string | null
          departure_date?: string | null
          id?: string
          name: string
          notes?: string | null
          tclog_reference?: string | null
          updated_at?: string | null
          vessel_name?: string | null
        }
        Update: {
          arrival_date?: string | null
          booking_number?: string | null
          created_at?: string | null
          deleted_at?: string | null
          departure_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          tclog_reference?: string | null
          updated_at?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      signup_requests: {
        Row: {
          admin_notes: string | null
          approved_user_id: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          provider: string
          reject_reason: string | null
          requested_role: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          provider?: string
          reject_reason?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          provider?: string
          reject_reason?: string | null
          requested_role?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deleted_at: string | null
          document_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_id: string | null
          paid_date: string | null
          payment_type: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_date?: string | null
          payment_type?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_date?: string | null
          payment_type?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_quotes: {
        Row: {
          component_name: string
          created_at: string
          currency: string
          id: string
          is_primary: boolean
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          product_id: string | null
          supplier_id: string
          unit_price: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          component_name: string
          created_at?: string
          currency?: string
          id?: string
          is_primary?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          product_id?: string | null
          supplier_id: string
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          component_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_primary?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          product_id?: string | null
          supplier_id?: string
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_returns: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          photo_url: string | null
          received_at: string | null
          resolution_notes: string | null
          resolution_type: string | null
          return_reason: string | null
          settled_at: string | null
          shipped_at: string | null
          status: string
          supplier_id: string
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          received_at?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          return_reason?: string | null
          settled_at?: string | null
          shipped_at?: string | null
          status?: string
          supplier_id: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          received_at?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          return_reason?: string | null
          settled_at?: string | null
          shipped_at?: string | null
          status?: string
          supplier_id?: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          backup_supplier_id: string | null
          company: string
          contact_name: string
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          lead_time_days: number | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          products: string | null
          risk_level: string | null
          role: string | null
          sap_code: string | null
          supplier_number: string | null
          website: string | null
        }
        Insert: {
          backup_supplier_id?: string | null
          company: string
          contact_name: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products?: string | null
          risk_level?: string | null
          role?: string | null
          sap_code?: string | null
          supplier_number?: string | null
          website?: string | null
        }
        Update: {
          backup_supplier_id?: string | null
          company?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products?: string | null
          risk_level?: string | null
          role?: string | null
          sap_code?: string | null
          supplier_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_backup_supplier_id_fkey"
            columns: ["backup_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_advancement_log: {
        Row: {
          advanced_at: string | null
          advanced_by: string | null
          created_at: string | null
          id: string
          new_due_date: string
          notes: string | null
          old_due_date: string | null
          task_id: string
        }
        Insert: {
          advanced_at?: string | null
          advanced_by?: string | null
          created_at?: string | null
          id?: string
          new_due_date: string
          notes?: string | null
          old_due_date?: string | null
          task_id: string
        }
        Update: {
          advanced_at?: string | null
          advanced_by?: string | null
          created_at?: string | null
          id?: string
          new_due_date?: string
          notes?: string | null
          old_due_date?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_advancement_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          days_before: number | null
          deleted_at: string | null
          deliverable: string | null
          depends_on: string[] | null
          description: string | null
          due_date: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          is_daily: boolean
          last_generated: string | null
          milestone: string | null
          notes: string | null
          priority: string
          recurring_task_id: string | null
          start_date: string | null
          status: string
          time_of_day: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          days_before?: number | null
          deleted_at?: string | null
          deliverable?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          is_daily?: boolean
          last_generated?: string | null
          milestone?: string | null
          notes?: string | null
          priority?: string
          recurring_task_id?: string | null
          start_date?: string | null
          status?: string
          time_of_day?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          days_before?: number | null
          deleted_at?: string | null
          deliverable?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          is_daily?: boolean
          last_generated?: string | null
          milestone?: string | null
          notes?: string | null
          priority?: string
          recurring_task_id?: string | null
          start_date?: string | null
          status?: string
          time_of_day?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_models: {
        Row: {
          brand: string
          created_at: string
          division: string
          id: string
          is_active: boolean
          model_code: string | null
          model_family: string | null
          model_name: string
          segment: string | null
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          division: string
          id?: string
          is_active?: boolean
          model_code?: string | null
          model_family?: string | null
          model_name: string
          segment?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          division?: string
          id?: string
          is_active?: boolean
          model_code?: string | null
          model_family?: string | null
          model_name?: string
          segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_lock_scans: {
        Row: {
          action: string
          barcode_value: string
          id: string
          lock_id: number
          method: string
          scanned_at: string
          scanned_by: string | null
        }
        Insert: {
          action: string
          barcode_value: string
          id?: string
          lock_id: number
          method?: string
          scanned_at?: string
          scanned_by?: string | null
        }
        Update: {
          action?: string
          barcode_value?: string
          id?: string
          lock_id?: number
          method?: string
          scanned_at?: string
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_lock_scans_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locks: {
        Row: {
          active: boolean
          barcode_value: string
          created_at: string
          current_status: string
          id: number
          last_scan_at: string | null
          last_scan_by: string | null
          name: string
          site: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode_value: string
          created_at?: string
          current_status?: string
          id: number
          last_scan_at?: string | null
          last_scan_by?: string | null
          name: string
          site?: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode_value?: string
          created_at?: string
          current_status?: string
          id?: number
          last_scan_at?: string | null
          last_scan_by?: string | null
          name?: string
          site?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_zone_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          details: Json | null
          id: string
          zone_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          zone_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          zone_id?: string
        }
        Relationships: []
      }
      warehouse_zone_products: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          zone_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_zone_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_zone_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wzp_zone_fk"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "warehouse_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_zones: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          deleted_at: string | null
          grid_col: string
          grid_row: string
          icon: string | null
          id: string
          is_non_product: boolean
          name: string
          notes: string | null
          sort_order: number
          text_color: string
          updated_at: string
          zone_type: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          grid_col: string
          grid_row: string
          icon?: string | null
          id: string
          is_non_product?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          text_color?: string
          updated_at?: string
          zone_type?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          grid_col?: string
          grid_row?: string
          icon?: string | null
          id?: string
          is_non_product?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          text_color?: string
          updated_at?: string
          zone_type?: string
        }
        Relationships: []
      }
      waste_items: {
        Row: {
          component_id: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          disposition_date: string | null
          disposition_type: string | null
          id: string
          in_use: boolean
          photo_url: string | null
          product_id: string | null
          product_name: string
          quantity: number
          recommendations: string | null
          sale_buyer_name: string | null
          sale_price: number | null
          sku: string
          supplier_id: string | null
          supplier_return_id: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          disposition_date?: string | null
          disposition_type?: string | null
          id?: string
          in_use?: boolean
          photo_url?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          recommendations?: string | null
          sale_buyer_name?: string | null
          sale_price?: number | null
          sku?: string
          supplier_id?: string | null
          supplier_return_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          component_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          disposition_date?: string | null
          disposition_type?: string | null
          id?: string
          in_use?: boolean
          photo_url?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          recommendations?: string | null
          sale_buyer_name?: string | null
          sale_price?: number | null
          sku?: string
          supplier_id?: string | null
          supplier_return_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "product_components_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_items_supplier_return_id_fkey"
            columns: ["supplier_return_id"]
            isOneToOne: false
            referencedRelation: "supplier_returns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      frisbee_equipment_consumption: {
        Row: {
          base44_branch_id: string | null
          base44_equipment_id: string | null
          equipment_name: string | null
          inspections_with_faults: number | null
          installed_count: number | null
          last_synced_at: string | null
          total_inspections: number | null
        }
        Relationships: []
      }
      product_components_safe: {
        Row: {
          id: string | null
          image_url: string | null
          name: string | null
          notes: string | null
          origin: string | null
          price: number | null
          product_id: string | null
          sku: string | null
          stock_qty: number | null
          supplier: string | null
        }
        Insert: {
          id?: string | null
          image_url?: string | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          price?: never
          product_id?: string | null
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
        }
        Update: {
          id?: string | null
          image_url?: string | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          price?: never
          product_id?: string | null
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      products_safe: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          division: string | null
          end_product_image: string | null
          end_product_url: string | null
          id: string | null
          incoming_qty: number | null
          lead_time_days: number | null
          monthly_order: number | null
          monthly_sales: number | null
          monthly_sales_avg: number | null
          name: string | null
          notes: string | null
          product_type: string | null
          purchase_price: number | null
          reorder_point: number | null
          sale_price: number | null
          sap_code: string | null
          shipping: string | null
          sku: string | null
          stock_qty: number | null
          supplier: string | null
          supplier_origin: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          division?: string | null
          end_product_image?: string | null
          end_product_url?: string | null
          id?: string | null
          incoming_qty?: number | null
          lead_time_days?: number | null
          monthly_order?: number | null
          monthly_sales?: number | null
          monthly_sales_avg?: number | null
          name?: string | null
          notes?: string | null
          product_type?: string | null
          purchase_price?: never
          reorder_point?: number | null
          sale_price?: never
          sap_code?: string | null
          shipping?: string | null
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
          supplier_origin?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          division?: string | null
          end_product_image?: string | null
          end_product_url?: string | null
          id?: string | null
          incoming_qty?: number | null
          lead_time_days?: number | null
          monthly_order?: number | null
          monthly_sales?: number | null
          monthly_sales_avg?: number | null
          name?: string | null
          notes?: string | null
          product_type?: string | null
          purchase_price?: never
          reorder_point?: number | null
          sale_price?: never
          sap_code?: string | null
          shipping?: string | null
          sku?: string | null
          stock_qty?: number | null
          supplier?: string | null
          supplier_origin?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      capture_order_request_snapshot: {
        Args: { p_division?: string; p_label: string; p_notes?: string }
        Returns: string
      }
      cleanup_expired_soft_deletes: { Args: never; Returns: undefined }
      current_user_division: { Args: never; Returns: string }
      derive_order_division: { Args: { p_order_id: string }; Returns: string }
      get_deleted_items: {
        Args: never
        Returns: {
          deleted_at: string
          expires_at: string
          item_id: string
          label: string
          sub_label: string
          table_name: string
        }[]
      }
      get_frisbee_model_stats: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          avg_per_vehicle: number
          inspection_count: number
          manufacturer: string
          model: string
          top_accessories: Json
          total_accessories: number
        }[]
      }
      get_frisbee_monthly_stats: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          equipment_name: string
          inspection_count: number
          installed_count: number
          month: string
        }[]
      }
      hard_delete_item: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      has_module_edit: { Args: { module_key: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_division_manager: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      restore_item: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER"
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
      app_role: ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"],
    },
  },
} as const
