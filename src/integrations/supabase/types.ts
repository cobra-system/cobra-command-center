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
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          division: string | null
          id: string
          incoming_qty: number
          monthly_order: number | null
          monthly_sales: number | null
          name: string
          notes: string | null
          product_type: string
          purchase_price: number | null
          sale_price: number | null
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
          id?: string
          incoming_qty?: number
          monthly_order?: number | null
          monthly_sales?: number | null
          name: string
          notes?: string | null
          product_type: string
          purchase_price?: number | null
          sale_price?: number | null
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
          id?: string
          incoming_qty?: number
          monthly_order?: number | null
          monthly_sales?: number | null
          name?: string
          notes?: string | null
          product_type?: string
          purchase_price?: number | null
          sale_price?: number | null
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
      suppliers: {
        Row: {
          company: string
          contact_name: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          products: string | null
          role: string | null
        }
        Insert: {
          company: string
          contact_name: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          products?: string | null
          role?: string | null
        }
        Update: {
          company?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          products?: string | null
          role?: string | null
        }
        Relationships: []
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
