export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          batch_number: string | null
          condition_on_return: string | null
          created_at: string | null
          credit_note_id: string | null
          credit_quantity: number
          discount: number | null
          expiry_date: string | null
          id: string
          original_quantity: number | null
          product_id: string
          quality_notes: string | null
          return_to_stock: boolean | null
          returned_quantity: number | null
          sales_order_item_id: string | null
          storage_location: string | null
          tax: number | null
          total: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          condition_on_return?: string | null
          created_at?: string | null
          credit_note_id?: string | null
          credit_quantity: number
          discount?: number | null
          expiry_date?: string | null
          id?: string
          original_quantity?: number | null
          product_id: string
          quality_notes?: string | null
          return_to_stock?: boolean | null
          returned_quantity?: number | null
          sales_order_item_id?: string | null
          storage_location?: string | null
          tax?: number | null
          total?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          condition_on_return?: string | null
          created_at?: string | null
          credit_note_id?: string | null
          credit_quantity?: number
          discount?: number | null
          expiry_date?: string | null
          id?: string
          original_quantity?: number | null
          product_id?: string
          quality_notes?: string | null
          return_to_stock?: boolean | null
          returned_quantity?: number | null
          sales_order_item_id?: string | null
          storage_location?: string | null
          tax?: number | null
          total?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          affects_inventory: boolean | null
          approval_required: boolean | null
          approved_by: string | null
          approved_date: string | null
          created_at: string | null
          created_by: string
          credit_date: string
          credit_note_number: string
          customer_id: string
          discount_amount: number | null
          id: string
          internal_notes: string | null
          inventory_processed: boolean | null
          notes: string | null
          reason: string
          reason_description: string | null
          refund_date: string | null
          refund_method: string | null
          refund_processed: boolean | null
          refund_reference: string | null
          sales_order_id: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          affects_inventory?: boolean | null
          approval_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string | null
          created_by: string
          credit_date?: string
          credit_note_number: string
          customer_id: string
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          inventory_processed?: boolean | null
          notes?: string | null
          reason: string
          reason_description?: string | null
          refund_date?: string | null
          refund_method?: string | null
          refund_processed?: boolean | null
          refund_reference?: string | null
          sales_order_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          affects_inventory?: boolean | null
          approval_required?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string | null
          created_by?: string
          credit_date?: string
          credit_note_number?: string
          customer_id?: string
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          inventory_processed?: boolean | null
          notes?: string | null
          reason?: string
          reason_description?: string | null
          refund_date?: string | null
          refund_method?: string | null
          refund_processed?: boolean | null
          refund_reference?: string | null
          sales_order_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          created_by: string | null
          credit_note_id: string | null
          customer_id: string
          description: string | null
          expiry_date: string | null
          id: string
          reference_number: string | null
          sales_order_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          created_by?: string | null
          credit_note_id?: string | null
          customer_id: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          reference_number?: string | null
          sales_order_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          created_by?: string | null
          credit_note_id?: string | null
          customer_id?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          reference_number?: string | null
          sales_order_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balances: {
        Row: {
          available_credit: number | null
          created_at: string | null
          customer_id: string
          id: string
          last_updated: string | null
          total_credit_balance: number | null
          used_credit: number | null
        }
        Insert: {
          available_credit?: number | null
          created_at?: string | null
          customer_id: string
          id?: string
          last_updated?: string | null
          total_credit_balance?: number | null
          used_credit?: number | null
        }
        Update: {
          available_credit?: number | null
          created_at?: string | null
          customer_id?: string
          id?: string
          last_updated?: string | null
          total_credit_balance?: number | null
          used_credit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: Json | null
          created_at: string | null
          credit_limit: number | null
          current_credit: number | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          shipping_address: Json | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string | null
          credit_limit?: number | null
          current_credit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          shipping_address?: Json | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string | null
          credit_limit?: number | null
          current_credit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          shipping_address?: Json | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      good_receive_note_items: {
        Row: {
          accepted_quantity: number | null
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          grn_id: string | null
          id: string
          manufacturing_date: string | null
          ordered_quantity: number
          product_id: string
          purchase_order_item_id: string | null
          quality_notes: string | null
          received_quantity: number
          rejected_quantity: number | null
          storage_location: string | null
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_id?: string | null
          id?: string
          manufacturing_date?: string | null
          ordered_quantity: number
          product_id: string
          purchase_order_item_id?: string | null
          quality_notes?: string | null
          received_quantity: number
          rejected_quantity?: number | null
          storage_location?: string | null
          unit_cost: number
          updated_at?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_id?: string | null
          id?: string
          manufacturing_date?: string | null
          ordered_quantity?: number
          product_id?: string
          purchase_order_item_id?: string | null
          quality_notes?: string | null
          received_quantity?: number
          rejected_quantity?: number | null
          storage_location?: string | null
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "good_receive_note_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "good_receive_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "good_receive_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "good_receive_note_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      good_receive_notes: {
        Row: {
          created_at: string | null
          grn_number: string
          id: string
          notes: string | null
          purchase_order_id: string
          quality_check_status: string | null
          received_by: string
          received_date: string
          status: string | null
          supplier_id: string
          total_received_items: number | null
          updated_at: string | null
          warehouse_location: string | null
        }
        Insert: {
          created_at?: string | null
          grn_number: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          quality_check_status?: string | null
          received_by: string
          received_date?: string
          status?: string | null
          supplier_id: string
          total_received_items?: number | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Update: {
          created_at?: string | null
          grn_number?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          quality_check_status?: string | null
          received_by?: string
          received_date?: string
          status?: string | null
          supplier_id?: string
          total_received_items?: number | null
          updated_at?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "good_receive_notes_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "good_receive_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "good_receive_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity_change: number
          reference_id: string | null
          reference_type: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_change: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity_change?: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          maximum_stock: number | null
          minimum_stock: number | null
          name: string
          reorder_point: number | null
          selling_price: number | null
          sku_code: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          name: string
          reorder_point?: number | null
          selling_price?: number | null
          sku_code: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          name?: string
          reorder_point?: number | null
          selling_price?: number | null
          sku_code?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          cost_price: number
          created_at: string | null
          discount: number | null
          id: string
          product_id: string | null
          purchase_order_id: string | null
          quantity: number
          tax: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          cost_price: number
          created_at?: string | null
          discount?: number | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity: number
          tax?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          tax?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          product_id: string | null
          quantity: number
          sales_order_id: string | null
          tax: number | null
          total: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity: number
          sales_order_id?: string | null
          tax?: number | null
          total?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          sales_order_id?: string | null
          tax?: number | null
          total?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          discount_amount: number | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          id: string
          last_updated: string | null
          product_id: string | null
          quantity_available: number | null
          quantity_on_hand: number | null
          quantity_reserved: number | null
        }
        Insert: {
          id?: string
          last_updated?: string | null
          product_id?: string | null
          quantity_available?: number | null
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
        }
        Update: {
          id?: string
          last_updated?: string | null
          product_id?: string | null
          quantity_available?: number | null
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key?: string
          setting_type?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          applied_to: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          applied_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          applied_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          abbreviation: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_create_grn: boolean | null
          auto_generate_sku: boolean | null
          created_at: string | null
          currency: string | null
          currency_symbol: string | null
          custom_settings: Json | null
          daily_report_email: boolean | null
          dashboard_layout: Json | null
          date_format: string | null
          default_dashboard_widgets: string[] | null
          default_payment_terms: string | null
          default_report_period: string | null
          default_tax_rate: string | null
          default_warehouse_location: string | null
          email_notifications: boolean | null
          enable_barcode_scanning: boolean | null
          id: string
          include_tax_in_reports: boolean | null
          language: string | null
          low_stock_alerts: boolean | null
          low_stock_threshold_percentage: number | null
          order_status_notifications: boolean | null
          require_password_change_days: number | null
          require_po_approval: boolean | null
          session_timeout_minutes: number | null
          sku_prefix: string | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_create_grn?: boolean | null
          auto_generate_sku?: boolean | null
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          custom_settings?: Json | null
          daily_report_email?: boolean | null
          dashboard_layout?: Json | null
          date_format?: string | null
          default_dashboard_widgets?: string[] | null
          default_payment_terms?: string | null
          default_report_period?: string | null
          default_tax_rate?: string | null
          default_warehouse_location?: string | null
          email_notifications?: boolean | null
          enable_barcode_scanning?: boolean | null
          id?: string
          include_tax_in_reports?: boolean | null
          language?: string | null
          low_stock_alerts?: boolean | null
          low_stock_threshold_percentage?: number | null
          order_status_notifications?: boolean | null
          require_password_change_days?: number | null
          require_po_approval?: boolean | null
          session_timeout_minutes?: number | null
          sku_prefix?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_create_grn?: boolean | null
          auto_generate_sku?: boolean | null
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          custom_settings?: Json | null
          daily_report_email?: boolean | null
          dashboard_layout?: Json | null
          date_format?: string | null
          default_dashboard_widgets?: string[] | null
          default_payment_terms?: string | null
          default_report_period?: string | null
          default_tax_rate?: string | null
          default_warehouse_location?: string | null
          email_notifications?: boolean | null
          enable_barcode_scanning?: boolean | null
          id?: string
          include_tax_in_reports?: boolean | null
          language?: string | null
          low_stock_alerts?: boolean | null
          low_stock_threshold_percentage?: number | null
          order_status_notifications?: boolean | null
          require_password_change_days?: number | null
          require_po_approval?: boolean | null
          session_timeout_minutes?: number | null
          sku_prefix?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_tax_rate_fkey"
            columns: ["default_tax_rate"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      customer_type: "retail" | "wholesale" | "distributor"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      order_status: "draft" | "pending" | "approved" | "received" | "cancelled"
      transaction_type: "purchase" | "sale" | "adjustment" | "transfer"
      user_role: "admin" | "manager" | "staff"
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
      customer_type: ["retail", "wholesale", "distributor"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      order_status: ["draft", "pending", "approved", "received", "cancelled"],
      transaction_type: ["purchase", "sale", "adjustment", "transfer"],
      user_role: ["admin", "manager", "staff"],
    },
  },
} as const
