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
      distribution_centers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
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
          id?: string
          is_main?: boolean
          name?: string
          sap_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      orders: {
        Row: {
          contact_name: string | null
          created_at: string
          eta: string | null
          etd: string | null
          id: string
          notes: string | null
          order_date: string | null
          payment_date: string | null
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
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          payment_date?: string | null
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
          eta?: string | null
          etd?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          payment_date?: string | null
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
          id: string
          product_id: string
          reported_date: string
          reporter: string
          resolution: string | null
          resolved_date: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          product_id: string
          reported_date?: string
          reporter?: string
          resolution?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string
          reported_date?: string
          reporter?: string
          resolution?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
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
          pin: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          pin?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pin?: string | null
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
          file_url: string | null
          id: string
          notes: string | null
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
          file_url?: string | null
          id?: string
          notes?: string | null
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
          file_url?: string | null
          id?: string
          notes?: string | null
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
          created_at: string
          deliverable: string | null
          description: string | null
          due_date: string | null
          id: string
          is_daily: boolean
          milestone: string | null
          notes: string | null
          priority: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          created_at?: string
          deliverable?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_daily?: boolean
          milestone?: string | null
          notes?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          created_at?: string
          deliverable?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_daily?: boolean
          milestone?: string | null
          notes?: string | null
          priority?: string
          start_date?: string | null
          status?: string
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
