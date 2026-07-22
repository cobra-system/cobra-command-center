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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
        ]
      }
      compliance_items: {
        Row: {
          category: string
          created_at: string
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
        ]
      }
      distribution_centers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          division: string | null
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
          division?: string | null
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
          division?: string | null
          id?: string
          is_main?: boolean
          name?: string
          sap_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_change_log: {
        Row: {
          center_id: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_quantity: number | null
          old_quantity: number | null
          product_id: string | null
          reason: string | null
        }
        Insert: {
          center_id?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          center_id?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_quantity?: number | null
          old_quantity?: number | null
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_change_log_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_change_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
            foreignKeyName: "inventory_transfers_to_center_id_fkey"
            columns: ["to_center_id"]
            isOneToOne: false
            referencedRelation: "distribution_centers"
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
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string
          success?: boolean
        }
        Relationships: []
      }
      order_items: {
        Row: {
          currency: string
          id: string
          name: string
          order_id: string
          price: number | null
          product_id: string | null
          qty: number
        }
        Insert: {
          currency?: string
          id?: string
          name: string
          order_id: string
          price?: number | null
          product_id?: string | null
          qty: number
        }
        Update: {
          currency?: string
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
        ]
      }
      orders: {
        Row: {
          contact_name: string | null
          created_at: string
          destination_supplier_id: string | null
          destination_supplier_name: string | null
          eta: string | null
          etd: string | null
          id: string
          notes: string | null
          order_date: string | null
          order_image: string | null
          payment_date: string | null
          payment_status: string
          priority: string
          sap_doc_entry: string | null
          shipping: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          destination_supplier_id?: string | null
          destination_supplier_name?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_image?: string | null
          payment_date?: string | null
          payment_status?: string
          priority?: string
          sap_doc_entry?: string | null
          shipping?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          destination_supplier_id?: string | null
          destination_supplier_name?: string | null
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_image?: string | null
          payment_date?: string | null
          payment_status?: string
          priority?: string
          sap_doc_entry?: string | null
          shipping?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_destination_supplier_id_fkey"
            columns: ["destination_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          id: string
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
        ]
      }
      product_issues: {
        Row: {
          created_at: string
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
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
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
          price_currency: string
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
          price_currency?: string
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
          price_currency?: string
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
          created_at: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_documents: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          created_at: string
          currency: string
          document_name: string | null
          document_number: string | null
          document_subtype: string | null
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
          document_name?: string | null
          document_number?: string | null
          document_subtype?: string | null
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
          document_name?: string | null
          document_number?: string | null
          document_subtype?: string | null
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
            foreignKeyName: "purchase_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      /* recurring_tasks table removed — merged into tasks */
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
            foreignKeyName: "supplier_price_quotes_supplier_id_fkey"
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
          website: string | null
        }
        Insert: {
          backup_supplier_id?: string | null
          company: string
          contact_name: string
          country?: string | null
          created_at?: string
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
          website?: string | null
        }
        Update: {
          backup_supplier_id?: string | null
          company?: string
          contact_name?: string
          country?: string | null
          created_at?: string
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
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          days_before: number | null
          deliverable: string | null
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
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          days_before?: number | null
          deliverable?: string | null
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
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          days_before?: number | null
          deliverable?: string | null
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
        Relationships: [
          {
            foreignKeyName: "tasks_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      workflow_instances: {
        Row: {
          created_at: string
          created_by: string | null
          current_step: number
          id: string
          order_id: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          order_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          order_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_logs: {
        Row: {
          action_data: Json | null
          completed_at: string
          completed_by: string | null
          id: string
          instance_id: string
          notes: string | null
          step_index: number
        }
        Insert: {
          action_data?: Json | null
          completed_at?: string
          completed_by?: string | null
          id?: string
          instance_id: string
          notes?: string | null
          step_index: number
        }
        Update: {
          action_data?: Json | null
          completed_at?: string
          completed_by?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          steps: Json
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          steps?: Json
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          steps?: Json
        }
        Relationships: []
      }
      installers: {
        Row: {
          id: string
          name: string
          warehouse_number: number | null
          division: string
          phone: string | null
          coordinator: string | null
          status: string
          notes: string | null
          entity_type: string
          center_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          warehouse_number?: number | null
          division?: string
          phone?: string | null
          coordinator?: string | null
          status?: string
          notes?: string | null
          entity_type?: string
          center_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          warehouse_number?: number | null
          division?: string
          phone?: string | null
          coordinator?: string | null
          status?: string
          notes?: string | null
          entity_type?: string
          center_id?: string | null
          created_at?: string
          updated_at?: string
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
      equipment_pickups: {
        Row: {
          id: string
          installer_id: string
          pickup_date: string
          created_by: string | null
          notes: string | null
          source_email_subject: string | null
          created_at: string
        }
        Insert: {
          id?: string
          installer_id: string
          pickup_date: string
          created_by?: string | null
          notes?: string | null
          source_email_subject?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          installer_id?: string
          pickup_date?: string
          created_by?: string | null
          notes?: string | null
          source_email_subject?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_pickups_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_pickups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_pickup_items: {
        Row: {
          id: string
          pickup_id: string
          product_id: string
          quantity: number
          serial_numbers: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          pickup_id: string
          product_id: string
          quantity?: number
          serial_numbers?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          pickup_id?: string
          product_id?: string
          quantity?: number
          serial_numbers?: string[] | null
          created_at?: string
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
        ]
      }
      equipment_returns: {
        Row: {
          id: string
          installer_id: string
          return_date: string
          logged_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          installer_id: string
          return_date: string
          logged_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          installer_id?: string
          return_date?: string
          logged_by?: string | null
          notes?: string | null
          created_at?: string
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
      equipment_return_items: {
        Row: {
          id: string
          return_id: string
          product_id: string
          quantity: number
          reason: string
          reason_detail: string | null
          sticker_label: string | null
          serial_numbers: string[] | null
          is_actually_faulty: boolean | null
          checked_at: string | null
          checked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          product_id: string
          quantity?: number
          reason?: string
          reason_detail?: string | null
          sticker_label?: string | null
          serial_numbers?: string[] | null
          is_actually_faulty?: boolean | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          product_id?: string
          quantity?: number
          reason?: string
          reason_detail?: string | null
          sticker_label?: string | null
          serial_numbers?: string[] | null
          is_actually_faulty?: boolean | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "equipment_returns"
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
            foreignKeyName: "equipment_return_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_zone_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
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
        ]
      }
      warehouse_locks: {
        Row: {
          id: number
          name: string
          barcode_value: string
          site: string
          sort_order: number
          active: boolean
          current_status: "open" | "closed" | "unknown"
          last_scan_at: string | null
          last_scan_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: number
          name: string
          barcode_value: string
          site?: string
          sort_order: number
          active?: boolean
          current_status?: "open" | "closed" | "unknown"
          last_scan_at?: string | null
          last_scan_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          barcode_value?: string
          site?: string
          sort_order?: number
          active?: boolean
          current_status?: "open" | "closed" | "unknown"
          last_scan_at?: string | null
          last_scan_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_lock_scans: {
        Row: {
          id: string
          lock_id: number
          action: "open" | "close"
          scanned_by: string | null
          barcode_value: string
          method: "camera" | "manual"
          scanned_at: string
        }
        Insert: {
          id?: string
          lock_id: number
          action: "open" | "close"
          scanned_by?: string | null
          barcode_value: string
          method?: "camera" | "manual"
          scanned_at?: string
        }
        Update: {
          id?: string
          lock_id?: number
          action?: "open" | "close"
          scanned_by?: string | null
          barcode_value?: string
          method?: "camera" | "manual"
          scanned_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: never; Returns: boolean }
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
