-- ==========================================
-- Versal Database Initialization Script
-- Generated from Supabase project: bmyaefeddtcbnmpzvxmf
-- Extracted on: Thu Nov 27 00:00:45 +04 2025
-- ==========================================

-- ==========================================
-- Database Schema (public)
-- ==========================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."credit_note_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'processed',
    'cancelled'
);


ALTER TYPE "public"."credit_note_status" OWNER TO "postgres";


CREATE TYPE "public"."credit_note_type" AS ENUM (
    'invoice_linked',
    'standalone'
);


ALTER TYPE "public"."credit_note_type" OWNER TO "postgres";


CREATE TYPE "public"."customer_type" AS ENUM (
    'retail',
    'wholesale',
    'distributor'
);


ALTER TYPE "public"."customer_type" OWNER TO "postgres";


CREATE TYPE "public"."grn_status" AS ENUM (
    'draft',
    'partial',
    'completed',
    'rejected'
);


ALTER TYPE "public"."grn_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'partial',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."invoice_status" IS 'Invoice status: draft, sent, partial, paid, overdue, cancelled';



CREATE TYPE "public"."order_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'received',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."so_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'sent',
    'paid',
    'overdue',
    'cancelled',
    'partial',
    'fulfilled'
);


ALTER TYPE "public"."so_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'purchase',
    'sale',
    'adjustment',
    'transfer',
    'invoice_credit_used',
    'invoice_credit_adjusted'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_serialized_delta"("p_product" "uuid", "p_loc" "uuid", "p_status" "text", "p_delta" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_product IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_stock_level_row(p_product, p_loc);
  
  IF p_status = 'available' THEN
    UPDATE public.stock_levels SET serialized_available = serialized_available + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'reserved' THEN
    UPDATE public.stock_levels SET serialized_reserved = serialized_reserved + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'sold' THEN
    UPDATE public.stock_levels SET serialized_sold = serialized_sold + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'returned' THEN
    UPDATE public.stock_levels SET serialized_returned = serialized_returned + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'scrapped' THEN
    UPDATE public.stock_levels SET serialized_scrapped = serialized_scrapped + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  END IF;
END;
$$;


ALTER FUNCTION "public"."apply_serialized_delta"("p_product" "uuid", "p_loc" "uuid", "p_status" "text", "p_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_customer_credit_limit"("p_customer_id" "uuid", "p_invoice_amount" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_credit_balance numeric := 0;
    v_current_credit_usage numeric := 0;
    v_available_credit numeric := 0;
BEGIN
    -- Get the customer's total credit balance
    SELECT COALESCE(total_credit_balance, 0)
    INTO v_total_credit_balance
    FROM public.customer_credit_balances
    WHERE customer_id = p_customer_id;
    
    -- Calculate current credit usage from outstanding invoices
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_current_credit_usage
    FROM public.sale_invoices
    WHERE customer_id = p_customer_id
      AND payment_method = 'credit'
      AND status NOT IN ('paid', 'cancelled', 'draft');
    
    -- Calculate available credit
    v_available_credit := v_total_credit_balance - v_current_credit_usage;
    
    -- Check if there's enough credit for the new invoice
    RETURN v_available_credit >= p_invoice_amount;
END;
$$;


ALTER FUNCTION "public"."check_customer_credit_limit"("p_customer_id" "uuid", "p_invoice_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_user_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_user_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_stock_level_row"("p_product_id" "uuid", "p_location_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.stock_levels (product_id, location_id)
  VALUES (p_product_id, p_location_id)
  ON CONFLICT (product_id, location_id) DO NOTHING;

  SELECT id INTO v_id FROM public.stock_levels
  WHERE product_id = p_product_id AND (location_id IS NOT DISTINCT FROM p_location_id)
  LIMIT 1;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."ensure_stock_level_row"("p_product_id" "uuid", "p_location_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid") RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    CASE 
      WHEN LOWER(r.name) = 'administrator' THEN 'admin'::user_role
      WHEN LOWER(r.name) = 'manager' THEN 'manager'::user_role
      WHEN LOWER(r.name) = 'staff' THEN 'staff'::user_role
      ELSE 'staff'::user_role  -- Default fallback
    END
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_credit_note_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only process when status changes to approved and refund method is store credit
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.refund_method = 'store_credit' THEN
    -- Create credit transaction for credit issued
    INSERT INTO public.credit_transactions (
      customer_id,
      credit_note_id,
      transaction_type,
      amount,
      balance_after,
      description,
      reference_number,
      created_by
    )
    SELECT 
      NEW.customer_id,
      NEW.id,
      'credit_issued',
      NEW.total_amount,
      COALESCE((SELECT available_credit FROM public.customer_credit_balances WHERE customer_id = NEW.customer_id), 0) + NEW.total_amount,
      CASE 
        WHEN NEW.credit_note_type = 'invoice_linked' THEN 
          'Store credit issued via Credit Note: ' || NEW.credit_note_number || ' (Invoice: ' || 
          (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id) || ')'
        ELSE 
          'Store credit issued via Credit Note: ' || NEW.credit_note_number
      END,
      NEW.credit_note_number,
      NEW.approved_by;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_credit_note_approval"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_credit_note_approval"() IS 'Creates credit transactions when credit notes are approved and sets refund method to store_credit';



CREATE OR REPLACE FUNCTION "public"."handle_credit_note_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  credit_note_record RECORD;
BEGIN
  -- Get credit note details
  SELECT * INTO credit_note_record 
  FROM public.credit_notes 
  WHERE id = NEW.credit_note_id;
  
  -- Only process if credit note affects inventory and is approved
  IF credit_note_record.affects_inventory AND credit_note_record.status = 'approved' AND NEW.return_to_stock THEN
    -- Create inventory transaction for returned goods
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.product_id,
      'adjustment', -- Returns are adjustments
      NEW.returned_quantity,
      'credit_note',
      NEW.credit_note_id,
      'Goods returned via Credit Note: ' || credit_note_record.credit_note_number || 
      ' - Condition: ' || COALESCE(NEW.condition_on_return, 'good'),
      credit_note_record.created_by
    );
    
    -- Mark inventory as processed
    UPDATE public.credit_notes 
    SET inventory_processed = true 
    WHERE id = NEW.credit_note_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_credit_note_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_customer_credit_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert or update customer credit balance
  INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance, available_credit, used_credit)
  VALUES (
    NEW.customer_id, 
    CASE 
      WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
      ELSE 0
    END,
    CASE 
      WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
      ELSE 0
    END,
    CASE 
      WHEN NEW.transaction_type = 'credit_used' THEN NEW.amount
      ELSE 0
    END
  )
  ON CONFLICT (customer_id)
  DO UPDATE SET
    total_credit_balance = customer_credit_balances.total_credit_balance + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        ELSE 0 
      END,
    available_credit = customer_credit_balances.available_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        WHEN NEW.transaction_type = 'credit_used' THEN -NEW.amount
        ELSE 0 
      END,
    used_credit = customer_credit_balances.used_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_used' THEN NEW.amount
        ELSE 0 
      END,
    last_updated = now();
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_customer_credit_balance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_customer_credit_balance"() IS 'Updates customer credit balances based on credit transactions';



CREATE OR REPLACE FUNCTION "public"."handle_grn_inventory_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only process if accepted_quantity changed and GRN is completed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.accepted_quantity != NEW.accepted_quantity) THEN
    -- Check if the parent GRN is completed
    IF EXISTS (
      SELECT 1 FROM public.good_receive_notes 
      WHERE id = NEW.grn_id AND status = 'completed'
    ) THEN
      -- Create inventory transaction for received goods
      INSERT INTO public.inventory_transactions (
        product_id,
        transaction_type,
        quantity_change,
        reference_type,
        reference_id,
        notes,
        created_by
      )
      SELECT 
        NEW.product_id,
        'purchase',
        CASE 
          WHEN TG_OP = 'INSERT' THEN NEW.accepted_quantity
          ELSE NEW.accepted_quantity - OLD.accepted_quantity
        END,
        'grn',
        NEW.grn_id,
        'Goods received via GRN: ' || (SELECT grn_number FROM public.good_receive_notes WHERE id = NEW.grn_id),
        (SELECT received_by FROM public.good_receive_notes WHERE id = NEW.grn_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_grn_inventory_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_product_initial_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a new product is created, create initial stock level if initial_quantity is provided
  IF NEW.initial_quantity IS NOT NULL AND NEW.initial_quantity > 0 THEN
    -- Insert initial stock level
    INSERT INTO public.stock_levels (
      product_id,
      quantity_on_hand,
      quantity_reserved,
      quantity_available,
      created_by
    ) VALUES (
      NEW.id,
      NEW.initial_quantity,
      0,
      NEW.initial_quantity,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
    
    -- Create inventory transaction for initial stock
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.id,
      'adjustment',
      NEW.initial_quantity,
      'product_creation',
      NEW.id,
      'Initial stock quantity set on product creation: ' || NEW.name,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_product_initial_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    role_uuid UUID;
BEGIN
    -- Try to find the role_id based on the role name from user metadata
    IF NEW.raw_user_meta_data ? 'role' THEN
        SELECT id INTO role_uuid 
        FROM public.roles 
        WHERE name = NEW.raw_user_meta_data->>'role';
    END IF;

    -- Insert into profiles table with correct column names
    INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        is_active,
        role_id
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        true,
        role_uuid
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_purchase_order_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When purchase order status changes to 'approved' (instead of 'confirmed')
  IF NEW.status IN ('approved') AND 
     OLD.status NOT IN ('approved') THEN
    
    -- Create inventory transaction for each item (reserved inventory)
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      poi.product_id,
      'purchase',
      poi.quantity, -- Positive for purchases (increases inventory)
      'purchase_order',
      NEW.id,
      'Purchase via Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
    
  -- When purchase order is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      poi.product_id,
      'adjustment',
      -poi.quantity, -- Negative to reverse the purchase
      'purchase_order',
      NEW.id,
      'Order Cancelled - Inventory Reversed: ' || NEW.order_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_purchase_order_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sale_invoice_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When sale invoice status changes to 'paid' or 'processing'
  IF NEW.status IN ('paid', 'processing') AND 
     OLD.status NOT IN ('paid', 'processing') THEN
    
    -- Create inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      sii.product_id,
      'sale',
      -sii.quantity, -- Negative for sales (reduces inventory)
      'sale_invoice',
      NEW.id,
      'Sale via Invoice: ' || NEW.invoice_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sale_invoice_items sii
    WHERE sii.invoice_id = NEW.id;
    
  -- When sale invoice is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      sii.product_id,
      'adjustment',
      sii.quantity, -- Positive to restore inventory
      'sale_invoice',
      NEW.id,
      'Invoice Cancelled - Inventory Restored: ' || NEW.invoice_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sale_invoice_items sii
    WHERE sii.invoice_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sale_invoice_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sales_order_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When sales order status changes to 'approved' or 'sent'
  IF NEW.status IN ('approved', 'sent') AND OLD.status NOT IN ('approved', 'sent') THEN
    
    -- Create inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      soi.product_id,
      'sale',
      -soi.quantity, -- Negative for sales (reduces inventory)
      'sales_order',
      NEW.id,
      'Sales Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE username = 'admin' LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
    
  -- When sales order is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      soi.product_id,
      'sale',
      soi.quantity, -- Positive to reverse the negative sale
      'sales_order',
      NEW.id,
      'Sales Order Cancelled: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE username = 'admin' LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sales_order_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_stock_level_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  quantity_change INTEGER;
BEGIN
  -- Only handle UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Calculate the quantity change
    quantity_change := NEW.quantity_on_hand - OLD.quantity_on_hand;
    
    -- Only create audit record if there's an actual change
    IF quantity_change != 0 THEN
      BEGIN
        INSERT INTO public.inventory_transactions (
          product_id,
          transaction_type,
          quantity_change,
          reference_type,
          reference_id,
          notes,
          created_by
        ) VALUES (
          NEW.product_id,
          'adjustment',
          quantity_change,
          'stock_level',
          NEW.id,
          CASE 
            WHEN quantity_change > 0 THEN 'Stock level increased'
            ELSE 'Stock level decreased'
          END,
          COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
        );
      EXCEPTION
        WHEN OTHERS THEN
          -- Silently ignore errors to prevent update failures
          NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_stock_level_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_store_credit_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_credit_amount DECIMAL(12,2);
  v_available_credit DECIMAL(12,2);
  v_balance_after DECIMAL(12,2);
BEGIN
  -- Only process when payment method is store credit
  IF NEW.payment_method = 'store_credit' THEN
    -- Get available credit for the customer
    SELECT available_credit INTO v_available_credit
    FROM public.customer_credit_balances
    WHERE customer_id = NEW.customer_id;
    
    -- Check if customer has sufficient credit
    IF v_available_credit < NEW.payment_amount THEN
      RAISE EXCEPTION 'Insufficient store credit. Available: %, Required: %', v_available_credit, NEW.payment_amount;
    END IF;
    
    -- Calculate credit amount to use
    v_credit_amount := LEAST(NEW.payment_amount, v_available_credit);
    v_balance_after := v_available_credit - v_credit_amount;
    
    -- Create credit transaction for credit used
    INSERT INTO public.credit_transactions (
      customer_id,
      credit_note_id,
      transaction_type,
      amount,
      balance_after,
      description,
      reference_number,
      created_by
    )
    VALUES (
      NEW.customer_id,
      NULL, -- No specific credit note for usage
      'credit_used',
      v_credit_amount,
      v_balance_after,
      'Store credit used for payment: Invoice #' || 
      (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id),
      'PAY-' || NEW.id,
      NEW.created_by
    );
    
    -- Update customer credit balance
    UPDATE public.customer_credit_balances
    SET 
      available_credit = v_balance_after,
      used_credit = used_credit + v_credit_amount,
      last_updated = now()
    WHERE customer_id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_store_credit_usage"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_store_credit_usage"() IS 'Handles store credit usage when payments are made using store credit method';



CREATE OR REPLACE FUNCTION "public"."product_serials_sync_stock_levels"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_loc UUID;
  v_new_loc UUID;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_loc := NEW.location_id;
    v_new_status := NEW.status;
    PERFORM public.apply_serialized_delta(NEW.product_id, v_new_loc, v_new_status, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_loc := OLD.location_id; 
    v_new_loc := NEW.location_id;
    v_old_status := OLD.status; 
    v_new_status := NEW.status;
    -- Reverse old state
    PERFORM public.apply_serialized_delta(OLD.product_id, v_old_loc, v_old_status, -1);
    -- Apply new state
    PERFORM public.apply_serialized_delta(NEW.product_id, v_new_loc, v_new_status, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_loc := OLD.location_id;
    v_old_status := OLD.status;
    PERFORM public.apply_serialized_delta(OLD.product_id, v_old_loc, v_old_status, -1);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."product_serials_sync_stock_levels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_amount" numeric, "p_type" "text", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Insert or update the customer's credit balance
    INSERT INTO public.customer_credit_balances (customer_id, balance)
    VALUES (p_customer_id, CASE WHEN p_type = 'add' THEN p_amount ELSE -p_amount END)
    ON CONFLICT (customer_id) DO UPDATE
    SET balance = public.customer_credit_balances.balance + EXCLUDED.balance;

    -- Log the transaction for audit purposes
    INSERT INTO public.credit_transactions (customer_id, transaction_type, amount, new_balance, notes)
    SELECT p_customer_id,
           CASE WHEN p_type = 'add' THEN 'credit_added' ELSE 'credit_used' END,
           p_amount,
           balance,
           p_notes
    FROM public.customer_credit_balances
    WHERE customer_id = p_customer_id;
END;
$$;


ALTER FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_amount" numeric, "p_type" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_type" "text", "p_amount" numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Insert or update the customer's credit balance
    INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance)
    VALUES (p_customer_id, CASE WHEN p_type = 'add' THEN p_amount ELSE -p_amount END)
    ON CONFLICT (customer_id) DO UPDATE
    SET total_credit_balance = public.customer_credit_balances.total_credit_balance + EXCLUDED.total_credit_balance;
    
    -- Log the transaction for audit purposes
    INSERT INTO public.credit_transactions (customer_id, transaction_type, amount, new_balance, notes)
    SELECT p_customer_id,
           CASE WHEN p_type = 'add' THEN 'credit_added' ELSE 'credit_used' END,
           p_amount,
           total_credit_balance,
           p_notes
    FROM public.customer_credit_balances
    WHERE customer_id = p_customer_id;
END;
$$;


ALTER FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_type" "text", "p_amount" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_current_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_customer_id    uuid;
    v_current_credit numeric(12,2);
BEGIN
    -- Which customer are we dealing with?
    IF TG_OP = 'INSERT' THEN
        v_customer_id := NEW.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := NEW.customer_id;
    ELSE  -- DELETE
        v_customer_id := OLD.customer_id;
    END IF;

    /* Re-calculate the customer’s outstanding credit invoices.
       “Credit” invoices are those with payment_method = 'credit' and
       not already settled / cancelled / still draft. */
    SELECT COALESCE(SUM(amount_due), 0)
      INTO v_current_credit
      FROM public.sale_invoices
     WHERE customer_id   = v_customer_id
       AND payment_method = 'credit'
       AND status NOT IN ('paid','cancelled','draft');

    UPDATE public.customers
       SET current_credit = v_current_credit,
           updated_at     = NOW()
     WHERE id = v_customer_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_customer_current_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_invoice_payment_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total_paid DECIMAL(12,2);
    v_total_amount DECIMAL(12,2);
    v_new_status invoice_status;  -- Changed from TEXT to invoice_status
    v_invoice_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    -- Calculate total paid for the invoice
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_total_paid
    FROM public.customer_payments
    WHERE invoice_id = v_invoice_id;

    -- Get the total amount of the invoice
    SELECT total_amount
    INTO v_total_amount
    FROM public.sale_invoices
    WHERE id = v_invoice_id;

    -- Determine new status
    IF v_total_paid >= v_total_amount THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'sent'; -- Or 'draft' if it was never sent
    END IF;

    -- Update the sale_invoice
    UPDATE public.sale_invoices
    SET
        amount_paid = v_total_paid,
        amount_due = v_total_amount - v_total_paid,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_invoice_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_invoice_payment_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_serials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_serials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_order_status_from_invoice"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sales_order_id UUID;
    v_invoice_status invoice_status;
    v_new_so_status so_status;
BEGIN
    -- Get the sales order ID from the invoice
    v_sales_order_id := NEW.sales_order_id;
    v_invoice_status := NEW.status;
    
    -- Only process if there's a linked sales order
    IF v_sales_order_id IS NOT NULL THEN
        -- Map invoice status to sales order status
        CASE v_invoice_status
            WHEN 'partial' THEN
                v_new_so_status := 'partial'::so_status;
            WHEN 'paid' THEN
                v_new_so_status := 'fulfilled'::so_status;
            WHEN 'overdue' THEN
                v_new_so_status := 'overdue'::so_status;
            WHEN 'cancelled' THEN
                v_new_so_status := 'cancelled'::so_status;
            ELSE
                -- For other statuses, don't change sales order status
                RETURN NEW;
        END CASE;
        
        -- Update sales order status
        UPDATE sales_orders 
        SET status = v_new_so_status,
            updated_at = NOW()
        WHERE id = v_sales_order_id;
        
        RAISE NOTICE 'Updated sales order % status to % based on invoice status %', 
                    v_sales_order_id, v_new_so_status, v_invoice_status;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sales_order_status_from_invoice"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "credit_note_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "sales_order_item_id" "uuid",
    "original_quantity" integer,
    "credit_quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) GENERATED ALWAYS AS ((((("credit_quantity")::numeric * "unit_price") - "discount") + "tax")) STORED,
    "returned_quantity" integer DEFAULT 0,
    "condition_on_return" "text" DEFAULT 'good'::"text",
    "return_to_stock" boolean DEFAULT true,
    "batch_number" "text",
    "expiry_date" "date",
    "storage_location" "text",
    "quality_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_name" "text",
    "sku_code" "text",
    "hsn_code" "text",
    "sale_tax_type" "text" DEFAULT 'exclusive'::"text",
    "unit_abbreviation" "text",
    "created_by" "uuid",
    CONSTRAINT "credit_note_items_condition_on_return_check" CHECK (("condition_on_return" = ANY (ARRAY['good'::"text", 'damaged'::"text", 'defective'::"text", 'expired'::"text", 'incomplete'::"text"]))),
    CONSTRAINT "credit_note_items_credit_quantity_check" CHECK (("credit_quantity" > 0)),
    CONSTRAINT "credit_note_items_sale_tax_type_check" CHECK (("sale_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "valid_credit_quantity" CHECK ((("sales_order_item_id" IS NULL) OR ("credit_quantity" <= COALESCE("original_quantity", "credit_quantity"))))
);


ALTER TABLE "public"."credit_note_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."credit_note_items"."product_name" IS 'Product name at time of credit note (for historical accuracy)';



COMMENT ON COLUMN "public"."credit_note_items"."sku_code" IS 'Product SKU at time of credit note (for historical accuracy)';



COMMENT ON COLUMN "public"."credit_note_items"."hsn_code" IS 'Product HSN code at time of credit note (for historical accuracy)';



COMMENT ON COLUMN "public"."credit_note_items"."sale_tax_type" IS 'Tax type (inclusive/exclusive) at time of credit note';



COMMENT ON COLUMN "public"."credit_note_items"."unit_abbreviation" IS 'Unit abbreviation at time of credit note';



COMMENT ON COLUMN "public"."credit_note_items"."created_by" IS 'User who created the credit note item';



CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "credit_note_number" "text" NOT NULL,
    "sales_order_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "credit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "reason" "text" NOT NULL,
    "reason_description" "text",
    "status" "public"."credit_note_status" DEFAULT 'draft'::"public"."credit_note_status",
    "approval_required" boolean DEFAULT true,
    "approved_by" "uuid",
    "approved_date" timestamp with time zone,
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "refund_method" "text" DEFAULT 'credit_account'::"text",
    "refund_processed" boolean DEFAULT false,
    "refund_date" "date",
    "refund_reference" "text",
    "affects_inventory" boolean DEFAULT true,
    "inventory_processed" boolean DEFAULT false,
    "notes" "text",
    "internal_notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rounding_adjustment" numeric(12,2) DEFAULT 0,
    "invoice_id" "uuid",
    "credit_note_type" "public"."credit_note_type" DEFAULT 'invoice_linked'::"public"."credit_note_type" NOT NULL,
    CONSTRAINT "check_invoice_linked_has_invoice" CHECK (((("credit_note_type" = 'invoice_linked'::"public"."credit_note_type") AND ("invoice_id" IS NOT NULL)) OR (("credit_note_type" = 'standalone'::"public"."credit_note_type") AND ("invoice_id" IS NULL)))),
    CONSTRAINT "credit_notes_reason_check" CHECK (("reason" = ANY (ARRAY['return'::"text", 'damage'::"text", 'billing_error'::"text", 'discount'::"text", 'cancellation'::"text", 'price_adjustment'::"text", 'other'::"text"]))),
    CONSTRAINT "credit_notes_refund_method_check" CHECK (("refund_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'credit_account'::"text", 'store_credit'::"text", 'exchange'::"text"])))
);


ALTER TABLE "public"."credit_notes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."credit_notes"."rounding_adjustment" IS 'Rounding adjustment applied to the total amount for credit note';



COMMENT ON COLUMN "public"."credit_notes"."invoice_id" IS 'Reference to the sale invoice this credit note relates to. Required for invoice_linked credit notes.';



COMMENT ON COLUMN "public"."credit_notes"."credit_note_type" IS 'Type of credit note: invoice_linked (must have invoice_id) or standalone (no invoice reference).';



COMMENT ON CONSTRAINT "check_invoice_linked_has_invoice" ON "public"."credit_notes" IS 'Ensures invoice_linked credit notes have invoice_id and standalone credit notes do not.';



CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "credit_note_id" "uuid",
    "transaction_type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "description" "text",
    "reference_number" "text",
    "expiry_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sale_invoice_id" "uuid",
    CONSTRAINT "credit_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['credit_issued'::"text", 'credit_used'::"text", 'credit_expired'::"text", 'credit_adjusted'::"text"]))),
    CONSTRAINT "valid_credit_transaction_reference" CHECK ((("credit_note_id" IS NOT NULL) OR ("sale_invoice_id" IS NOT NULL)))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_transactions" IS 'Tracks all credit-related transactions including store credit issuance (credit notes) and usage (invoice payments)';



COMMENT ON COLUMN "public"."credit_transactions"."credit_note_id" IS 'Reference to credit note when store credit is issued';



COMMENT ON COLUMN "public"."credit_transactions"."transaction_type" IS 'Type of credit transaction: credit_issued, credit_used, credit_expired, credit_adjusted, invoice_credit_used, invoice_credit_adjusted';



COMMENT ON COLUMN "public"."credit_transactions"."sale_invoice_id" IS 'Reference to sale invoice when store credit is used for payment';



CREATE TABLE IF NOT EXISTS "public"."customer_credit_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_credit_balance" numeric(12,2) DEFAULT 0,
    "available_credit" numeric(12,2) DEFAULT 0,
    "used_credit" numeric(12,2) DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_credit_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "payment_amount" numeric(12,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_reference" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_payments_payment_amount_check" CHECK (("payment_amount" > (0)::numeric)),
    CONSTRAINT "customer_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'cheque'::"text", 'credit_card'::"text", 'online'::"text", 'credit'::"text", 'credit_note'::"text"])))
);


ALTER TABLE "public"."customer_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "billing_address" "jsonb",
    "shipping_address" "jsonb",
    "tax_id" "text",
    "notes" "text",
    "credit_limit" numeric(12,2),
    "current_credit" numeric(12,2) DEFAULT 0,
    "customer_type" "public"."customer_type" DEFAULT 'retail'::"public"."customer_type",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."is_active" IS 'Whether the customer is active or inactive';



CREATE TABLE IF NOT EXISTS "public"."good_receive_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_id" "uuid",
    "purchase_order_item_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "ordered_quantity" integer NOT NULL,
    "received_quantity" integer NOT NULL,
    "rejected_quantity" integer DEFAULT 0,
    "accepted_quantity" integer GENERATED ALWAYS AS (("received_quantity" - "rejected_quantity")) STORED,
    "unit_cost" numeric(12,2) NOT NULL,
    "batch_number" "text",
    "expiry_date" "date",
    "manufacturing_date" "date",
    "quality_notes" "text",
    "storage_location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_name" "text",
    "sku_code" "text",
    "hsn_code" "text",
    "purchase_tax_type" "text" DEFAULT 'exclusive'::"text",
    "unit_abbreviation" "text",
    "discount" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) GENERATED ALWAYS AS (((((("received_quantity" - "rejected_quantity"))::numeric * "unit_cost") - "discount") + "tax")) STORED,
    "created_by" "uuid",
    "ean_code" "text",
    CONSTRAINT "good_receive_note_items_purchase_tax_type_check" CHECK (("purchase_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "good_receive_note_items_received_quantity_check" CHECK (("received_quantity" >= 0)),
    CONSTRAINT "good_receive_note_items_rejected_quantity_check" CHECK (("rejected_quantity" >= 0)),
    CONSTRAINT "valid_quantities" CHECK (("received_quantity" >= "rejected_quantity"))
);


ALTER TABLE "public"."good_receive_note_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."good_receive_note_items"."product_name" IS 'Product name at time of receipt (for historical accuracy)';



COMMENT ON COLUMN "public"."good_receive_note_items"."sku_code" IS 'Product SKU at time of receipt (for historical accuracy)';



COMMENT ON COLUMN "public"."good_receive_note_items"."hsn_code" IS 'Product HSN code at time of receipt (for historical accuracy)';



COMMENT ON COLUMN "public"."good_receive_note_items"."purchase_tax_type" IS 'Tax type (inclusive/exclusive) at time of receipt';



COMMENT ON COLUMN "public"."good_receive_note_items"."unit_abbreviation" IS 'Unit abbreviation at time of receipt';



COMMENT ON COLUMN "public"."good_receive_note_items"."discount" IS 'Discount applied during receipt (may differ from PO)';



COMMENT ON COLUMN "public"."good_receive_note_items"."tax" IS 'Tax amount for this receipt item';



COMMENT ON COLUMN "public"."good_receive_note_items"."total" IS 'Total amount for this receipt item (calculated)';



CREATE TABLE IF NOT EXISTS "public"."good_receive_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_number" "text" NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "received_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "received_by" "uuid" NOT NULL,
    "status" "public"."grn_status" DEFAULT 'draft'::"public"."grn_status",
    "total_received_items" integer DEFAULT 0,
    "notes" "text",
    "quality_check_status" "text" DEFAULT 'pending'::"text",
    "warehouse_location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rounding_adjustment" numeric(12,2) DEFAULT 0,
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "is_direct" boolean DEFAULT false,
    "vendor_invoice_number" "text",
    CONSTRAINT "good_receive_notes_quality_check_status_check" CHECK (("quality_check_status" = ANY (ARRAY['pending'::"text", 'passed'::"text", 'failed'::"text", 'partial'::"text"])))
);


ALTER TABLE "public"."good_receive_notes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."good_receive_notes"."rounding_adjustment" IS 'Rounding adjustment applied to the total amount for GRN';



COMMENT ON COLUMN "public"."good_receive_notes"."subtotal" IS 'Subtotal amount before tax and discount';



COMMENT ON COLUMN "public"."good_receive_notes"."tax_amount" IS 'Total tax amount';



COMMENT ON COLUMN "public"."good_receive_notes"."discount_amount" IS 'Total discount amount';



COMMENT ON COLUMN "public"."good_receive_notes"."total_amount" IS 'Final total amount after tax and discount';



COMMENT ON COLUMN "public"."good_receive_notes"."is_direct" IS 'Indicates if this GRN was created directly (true) or linked to an existing purchase order (false)';



CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "previous_stock" integer NOT NULL,
    "new_stock" integer NOT NULL,
    "reference" "text",
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    CONSTRAINT "inventory_movements_type_check" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'sale'::"text", 'adjustment'::"text", 'transfer'::"text", 'return'::"text", 'damage'::"text", 'expiry'::"text"])))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "transaction_type" "public"."transaction_type" NOT NULL,
    "quantity_change" integer NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_serials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "serial_number" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "grn_item_id" "uuid",
    "sale_invoice_item_id" "uuid",
    "location_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_serials_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'reserved'::"text", 'sold'::"text", 'returned'::"text", 'scrapped'::"text"])))
);


ALTER TABLE "public"."product_serials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sku_code" "text" NOT NULL,
    "barcode" "text",
    "category_id" "uuid",
    "unit_id" "uuid",
    "cost_price" numeric(12,2),
    "selling_price" numeric(12,2),
    "minimum_stock" integer DEFAULT 0,
    "maximum_stock" integer,
    "reorder_point" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hsn_code" "text" DEFAULT '000000'::"text" NOT NULL,
    "manufacturer_part_number" "text",
    "supplier_id" "uuid",
    "sale_tax_id" "uuid",
    "purchase_tax_id" "uuid",
    "manufacturer" "text",
    "brand" "text",
    "warranty_period" integer,
    "warranty_unit" "text",
    "product_tags" "text"[],
    "is_serialized" boolean DEFAULT false,
    "track_inventory" boolean DEFAULT true,
    "allow_override_price" boolean DEFAULT false,
    "discount_percentage" numeric(5,2) DEFAULT 0,
    "warehouse_rack" "text",
    "unit_conversions" "jsonb",
    "mrp" numeric(12,2),
    "sale_price" numeric(12,2),
    "subcategory_id" "uuid",
    "sale_tax_type" "text" DEFAULT 'exclusive'::"text",
    "purchase_tax_type" "text" DEFAULT 'exclusive'::"text",
    "initial_quantity" integer DEFAULT 0,
    CONSTRAINT "products_purchase_tax_type_check" CHECK (("purchase_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "products_sale_tax_type_check" CHECK (("sale_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "products_warranty_unit_check" CHECK (("warranty_unit" = ANY (ARRAY['days'::"text", 'months'::"text", 'years'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."mrp" IS 'Maximum Retail Price (MRP) for the product';



COMMENT ON COLUMN "public"."products"."sale_price" IS 'Sale price (different from selling_price/retail price)';



COMMENT ON COLUMN "public"."products"."subcategory_id" IS 'Reference to subcategory in the categories table';



COMMENT ON COLUMN "public"."products"."sale_tax_type" IS 'Tax type for sale tax: inclusive or exclusive';



COMMENT ON COLUMN "public"."products"."purchase_tax_type" IS 'Tax type for purchase tax: inclusive or exclusive';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "cost_price" numeric(12,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_name" "text",
    "sku_code" "text",
    "hsn_code" "text",
    "purchase_tax_type" "text" DEFAULT 'exclusive'::"text",
    "unit_abbreviation" "text",
    "created_by" "uuid",
    "total" numeric(12,2) GENERATED ALWAYS AS (
CASE
    WHEN ("purchase_tax_type" = 'inclusive'::"text") THEN ((("quantity")::numeric * "cost_price") - "discount")
    ELSE (((("quantity")::numeric * "cost_price") - "discount") + "tax")
END) STORED,
    CONSTRAINT "purchase_order_items_purchase_tax_type_check" CHECK (("purchase_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "purchase_order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_order_items"."product_name" IS 'Product name for display purposes';



COMMENT ON COLUMN "public"."purchase_order_items"."sku_code" IS 'Product SKU code';



COMMENT ON COLUMN "public"."purchase_order_items"."hsn_code" IS 'Product HSN code';



COMMENT ON COLUMN "public"."purchase_order_items"."purchase_tax_type" IS 'Tax type: exclusive or inclusive';



COMMENT ON COLUMN "public"."purchase_order_items"."unit_abbreviation" IS 'Unit abbreviation (e.g., pcs, kg, box)';



COMMENT ON COLUMN "public"."purchase_order_items"."created_by" IS 'User who created this item';



CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "expected_delivery_date" "date",
    "status" "public"."order_status" DEFAULT 'draft'::"public"."order_status",
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rounding_adjustment" numeric(12,2) DEFAULT 0
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "permissions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."roles"."created_at" IS 'Timestamp when the role was created';



COMMENT ON COLUMN "public"."roles"."updated_at" IS 'Timestamp when the role was last updated';



CREATE TABLE IF NOT EXISTS "public"."sale_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) GENERATED ALWAYS AS ((((("quantity")::numeric * "unit_price") - "discount") + "tax")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sales_order_item_id" "uuid",
    "product_name" "text",
    "sku_code" "text",
    "hsn_code" "text",
    "sale_tax_type" "text" DEFAULT 'exclusive'::"text",
    "unit_abbreviation" "text",
    "created_by" "uuid",
    CONSTRAINT "sale_invoice_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sale_invoice_items_sale_tax_type_check" CHECK (("sale_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"])))
);


ALTER TABLE "public"."sale_invoice_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sale_invoice_items"."sales_order_item_id" IS 'Reference to original sales order item (optional)';



COMMENT ON COLUMN "public"."sale_invoice_items"."product_name" IS 'Product name at time of invoice (for historical accuracy)';



COMMENT ON COLUMN "public"."sale_invoice_items"."sku_code" IS 'Product SKU at time of invoice (for historical accuracy)';



COMMENT ON COLUMN "public"."sale_invoice_items"."hsn_code" IS 'Product HSN code at time of invoice (for historical accuracy)';



COMMENT ON COLUMN "public"."sale_invoice_items"."sale_tax_type" IS 'Tax type (inclusive/exclusive) at time of invoice';



COMMENT ON COLUMN "public"."sale_invoice_items"."unit_abbreviation" IS 'Unit abbreviation at time of invoice';



COMMENT ON COLUMN "public"."sale_invoice_items"."created_by" IS 'User who created the invoice item';



CREATE TABLE IF NOT EXISTS "public"."sale_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "payment_method" "text",
    "payment_reference" "text",
    "payment_date" "date",
    "credit_note_id" "uuid",
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "amount_paid" numeric(12,2) DEFAULT 0,
    "amount_due" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "affects_inventory" boolean DEFAULT true,
    "inventory_processed" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rounding_adjustment" numeric(12,2) DEFAULT 0,
    "sales_order_id" "uuid",
    "is_direct" boolean DEFAULT false,
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status",
    CONSTRAINT "sale_invoices_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'cheque'::"text", 'credit_card'::"text", 'online'::"text", 'credit'::"text", 'credit_note'::"text"])))
);


ALTER TABLE "public"."sale_invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sale_invoices"."rounding_adjustment" IS 'Rounding adjustment applied to the total amount for sale invoice';



COMMENT ON COLUMN "public"."sale_invoices"."sales_order_id" IS 'Reference to the sales order this invoice was created against (for linked creation)';



COMMENT ON COLUMN "public"."sale_invoices"."is_direct" IS 'Indicates if this invoice was created directly (true) or linked to an existing sales order (false)';



COMMENT ON COLUMN "public"."sale_invoices"."status" IS 'Status of the sale invoice using invoice_status enum';



CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_order_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_name" "text",
    "sku_code" "text",
    "hsn_code" "text",
    "sale_tax_type" "text" DEFAULT 'exclusive'::"text",
    "unit_abbreviation" "text",
    "created_by" "uuid",
    "total" numeric(12,2) GENERATED ALWAYS AS (
CASE
    WHEN ("sale_tax_type" = 'inclusive'::"text") THEN ((("quantity")::numeric * "unit_price") - "discount")
    ELSE (((("quantity")::numeric * "unit_price") - "discount") + "tax")
END) STORED,
    CONSTRAINT "sales_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sales_order_items_sale_tax_type_check" CHECK (("sale_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"])))
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales_order_items"."product_name" IS 'Product name for display purposes';



COMMENT ON COLUMN "public"."sales_order_items"."sku_code" IS 'Product SKU code';



COMMENT ON COLUMN "public"."sales_order_items"."hsn_code" IS 'Product HSN code';



COMMENT ON COLUMN "public"."sales_order_items"."sale_tax_type" IS 'Tax type: exclusive or inclusive';



COMMENT ON COLUMN "public"."sales_order_items"."unit_abbreviation" IS 'Unit abbreviation (e.g., pcs, kg, box)';



COMMENT ON COLUMN "public"."sales_order_items"."created_by" IS 'User who created this item';



CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rounding_adjustment" numeric(12,2) DEFAULT 0,
    "status" "public"."so_status" DEFAULT 'draft'::"public"."so_status"
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales_orders"."status" IS 'Status of the sales order using so_status enum';



CREATE TABLE IF NOT EXISTS "public"."stock_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "quantity_on_hand" integer DEFAULT 0,
    "quantity_reserved" integer DEFAULT 0,
    "quantity_available" integer GENERATED ALWAYS AS (("quantity_on_hand" - "quantity_reserved")) STORED,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "location_id" "uuid",
    "created_by" "uuid",
    "serialized_available" integer DEFAULT 0 NOT NULL,
    "serialized_reserved" integer DEFAULT 0 NOT NULL,
    "serialized_sold" integer DEFAULT 0 NOT NULL,
    "serialized_returned" integer DEFAULT 0 NOT NULL,
    "serialized_scrapped" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."stock_levels" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stock_levels"."created_by" IS 'User who created/updated this stock level record';



COMMENT ON COLUMN "public"."stock_levels"."serialized_available" IS 'Count of available serialized units';



COMMENT ON COLUMN "public"."stock_levels"."serialized_reserved" IS 'Count of reserved serialized units';



COMMENT ON COLUMN "public"."stock_levels"."serialized_sold" IS 'Count of sold serialized units';



COMMENT ON COLUMN "public"."stock_levels"."serialized_returned" IS 'Count of returned serialized units';



COMMENT ON COLUMN "public"."stock_levels"."serialized_scrapped" IS 'Count of scrapped serialized units';



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "payment_terms" "text",
    "tax_id" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "billing_address" "jsonb",
    "shipping_address" "jsonb"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."suppliers"."billing_address" IS 'Billing address for the supplier (JSONB with street, city, state, zipCode, country)';



COMMENT ON COLUMN "public"."suppliers"."shipping_address" IS 'Shipping address for the supplier (JSONB with street, city, state, zipCode, country)';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "setting_type" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "system_settings_setting_type_check" CHECK (("setting_type" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'json'::"text", 'array'::"text"])))
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "rate" numeric(5,4) NOT NULL,
    "is_default" boolean DEFAULT false,
    "applied_to" "text" DEFAULT 'products'::"text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "taxes_applied_to_check" CHECK (("applied_to" = ANY (ARRAY['products'::"text", 'services'::"text", 'both'::"text"]))),
    CONSTRAINT "taxes_rate_check" CHECK ((("rate" >= (0)::numeric) AND ("rate" <= (1)::numeric)))
);


ALTER TABLE "public"."taxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "abbreviation" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."units"."is_active" IS 'Whether the unit is active or inactive';



CREATE OR REPLACE VIEW "public"."user_roles" WITH ("security_invoker"='on') AS
 SELECT "p"."id",
    "p"."username",
    "p"."full_name",
    "p"."is_active",
    "p"."created_at",
    "p"."updated_at",
    "p"."role_id",
    "r"."name" AS "role_name",
    "r"."permissions"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."roles" "r" ON (("p"."role_id" = "r"."id")));


ALTER VIEW "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "dashboard_layout" "jsonb" DEFAULT '{}'::"jsonb",
    "default_dashboard_widgets" "text"[] DEFAULT ARRAY['inventory_summary'::"text", 'recent_orders'::"text", 'low_stock_alerts'::"text"],
    "theme" "text" DEFAULT 'system'::"text",
    "language" "text" DEFAULT 'en'::"text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "date_format" "text" DEFAULT 'YYYY-MM-DD'::"text",
    "currency" "text" DEFAULT 'USD'::"text",
    "currency_symbol" "text" DEFAULT '$'::"text",
    "default_warehouse_location" "text",
    "low_stock_threshold_percentage" integer DEFAULT 20,
    "enable_barcode_scanning" boolean DEFAULT true,
    "auto_generate_sku" boolean DEFAULT true,
    "sku_prefix" "text" DEFAULT 'SKU'::"text",
    "default_payment_terms" "text" DEFAULT '30 days'::"text",
    "auto_create_grn" boolean DEFAULT false,
    "require_po_approval" boolean DEFAULT true,
    "default_tax_rate" "uuid",
    "email_notifications" boolean DEFAULT true,
    "low_stock_alerts" boolean DEFAULT true,
    "order_status_notifications" boolean DEFAULT true,
    "daily_report_email" boolean DEFAULT false,
    "default_report_period" "text" DEFAULT '30_days'::"text",
    "include_tax_in_reports" boolean DEFAULT true,
    "session_timeout_minutes" integer DEFAULT 480,
    "require_password_change_days" integer DEFAULT 90,
    "custom_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_settings_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_credit_note_number_key" UNIQUE ("credit_note_number");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."good_receive_note_items"
    ADD CONSTRAINT "good_receive_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."good_receive_notes"
    ADD CONSTRAINT "good_receive_notes_grn_number_key" UNIQUE ("grn_number");



ALTER TABLE ONLY "public"."good_receive_notes"
    ADD CONSTRAINT "good_receive_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_product_id_serial_number_key" UNIQUE ("product_id", "serial_number");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_code_key" UNIQUE ("sku_code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_invoice_items"
    ADD CONSTRAINT "sale_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_invoices"
    ADD CONSTRAINT "sale_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."sale_invoices"
    ADD CONSTRAINT "sale_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_location_unique" UNIQUE ("product_id", "location_id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."taxes"
    ADD CONSTRAINT "taxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_abbreviation_key" UNIQUE ("abbreviation");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_credit_note_items_created_by" ON "public"."credit_note_items" USING "btree" ("created_by");



CREATE INDEX "idx_credit_note_items_credit_note_id" ON "public"."credit_note_items" USING "btree" ("credit_note_id");



CREATE INDEX "idx_credit_note_items_product_id" ON "public"."credit_note_items" USING "btree" ("product_id");



CREATE INDEX "idx_credit_notes_credit_date" ON "public"."credit_notes" USING "btree" ("credit_date");



CREATE INDEX "idx_credit_notes_customer_id" ON "public"."credit_notes" USING "btree" ("customer_id");



CREATE INDEX "idx_credit_notes_invoice_id" ON "public"."credit_notes" USING "btree" ("invoice_id");



CREATE INDEX "idx_credit_notes_sales_order_id" ON "public"."credit_notes" USING "btree" ("sales_order_id");



CREATE INDEX "idx_credit_notes_status" ON "public"."credit_notes" USING "btree" ("status");



CREATE INDEX "idx_credit_transactions_customer_id" ON "public"."credit_transactions" USING "btree" ("customer_id");



CREATE INDEX "idx_credit_transactions_sale_invoice_id" ON "public"."credit_transactions" USING "btree" ("sale_invoice_id");



CREATE INDEX "idx_credit_transactions_type" ON "public"."credit_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_good_receive_notes_is_direct" ON "public"."good_receive_notes" USING "btree" ("is_direct");



CREATE INDEX "idx_grn_items_created_by" ON "public"."good_receive_note_items" USING "btree" ("created_by");



CREATE INDEX "idx_grn_items_grn_id" ON "public"."good_receive_note_items" USING "btree" ("grn_id");



CREATE INDEX "idx_grn_items_product_id" ON "public"."good_receive_note_items" USING "btree" ("product_id");



CREATE INDEX "idx_grn_purchase_order_id" ON "public"."good_receive_notes" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_grn_received_date" ON "public"."good_receive_notes" USING "btree" ("received_date");



CREATE INDEX "idx_grn_supplier_id" ON "public"."good_receive_notes" USING "btree" ("supplier_id");



CREATE INDEX "idx_grn_vendor_invoice_number" ON "public"."good_receive_notes" USING "btree" ("vendor_invoice_number");



CREATE INDEX "idx_inventory_movements_created_at" ON "public"."inventory_movements" USING "btree" ("created_at");



CREATE INDEX "idx_inventory_movements_from_location" ON "public"."inventory_movements" USING "btree" ("from_location_id");



CREATE INDEX "idx_inventory_movements_product_id" ON "public"."inventory_movements" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_movements_to_location" ON "public"."inventory_movements" USING "btree" ("to_location_id");



CREATE INDEX "idx_inventory_movements_type" ON "public"."inventory_movements" USING "btree" ("type");



CREATE INDEX "idx_inventory_transactions_created_at" ON "public"."inventory_transactions" USING "btree" ("created_at");



CREATE INDEX "idx_inventory_transactions_product_id" ON "public"."inventory_transactions" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_transactions_reference_id" ON "public"."inventory_transactions" USING "btree" ("reference_id");



CREATE INDEX "idx_inventory_transactions_reference_type" ON "public"."inventory_transactions" USING "btree" ("reference_type");



CREATE INDEX "idx_inventory_transactions_transaction_type" ON "public"."inventory_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_locations_is_active" ON "public"."locations" USING "btree" ("is_active");



CREATE INDEX "idx_locations_name" ON "public"."locations" USING "btree" ("name");



CREATE INDEX "idx_product_serials_location_id" ON "public"."product_serials" USING "btree" ("location_id");



CREATE INDEX "idx_product_serials_product_id" ON "public"."product_serials" USING "btree" ("product_id");



CREATE INDEX "idx_product_serials_serial_number" ON "public"."product_serials" USING "btree" ("serial_number");



CREATE INDEX "idx_product_serials_status" ON "public"."product_serials" USING "btree" ("status");



CREATE INDEX "idx_products_brand" ON "public"."products" USING "btree" ("brand");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_hsn_code" ON "public"."products" USING "btree" ("hsn_code");



CREATE INDEX "idx_products_manufacturer" ON "public"."products" USING "btree" ("manufacturer");



CREATE INDEX "idx_products_mrp" ON "public"."products" USING "btree" ("mrp");



CREATE INDEX "idx_products_purchase_tax_id" ON "public"."products" USING "btree" ("purchase_tax_id");



CREATE INDEX "idx_products_purchase_tax_type" ON "public"."products" USING "btree" ("purchase_tax_type");



CREATE INDEX "idx_products_sale_price" ON "public"."products" USING "btree" ("sale_price");



CREATE INDEX "idx_products_sale_tax_id" ON "public"."products" USING "btree" ("sale_tax_id");



CREATE INDEX "idx_products_sale_tax_type" ON "public"."products" USING "btree" ("sale_tax_type");



CREATE INDEX "idx_products_sku_code" ON "public"."products" USING "btree" ("sku_code");



CREATE INDEX "idx_products_subcategory_id" ON "public"."products" USING "btree" ("subcategory_id");



CREATE INDEX "idx_products_supplier_id" ON "public"."products" USING "btree" ("supplier_id");



CREATE INDEX "idx_purchase_order_items_product_id" ON "public"."purchase_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_supplier_id" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_sale_invoice_items_created_by" ON "public"."sale_invoice_items" USING "btree" ("created_by");



CREATE INDEX "idx_sale_invoice_items_sales_order_item_id" ON "public"."sale_invoice_items" USING "btree" ("sales_order_item_id");



CREATE INDEX "idx_sale_invoices_is_direct" ON "public"."sale_invoices" USING "btree" ("is_direct");



CREATE INDEX "idx_sale_invoices_sales_order_id" ON "public"."sale_invoices" USING "btree" ("sales_order_id");



CREATE INDEX "idx_sale_invoices_status" ON "public"."sale_invoices" USING "btree" ("status");



CREATE INDEX "idx_sales_order_items_product_id" ON "public"."sales_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_sales_orders_customer_id" ON "public"."sales_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_sales_orders_status" ON "public"."sales_orders" USING "btree" ("status");



CREATE INDEX "idx_stock_levels_created_by" ON "public"."stock_levels" USING "btree" ("created_by");



CREATE INDEX "idx_stock_levels_location_id" ON "public"."stock_levels" USING "btree" ("location_id");



CREATE INDEX "idx_stock_levels_product_id" ON "public"."stock_levels" USING "btree" ("product_id");



CREATE INDEX "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_user_settings_user_id" ON "public"."user_settings" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_credit_note_approval" AFTER UPDATE ON "public"."credit_notes" FOR EACH ROW WHEN ((("new"."status" = 'approved'::"public"."credit_note_status") AND ("old"."status" <> 'approved'::"public"."credit_note_status"))) EXECUTE FUNCTION "public"."handle_credit_note_approval"();



CREATE OR REPLACE TRIGGER "on_credit_note_item_change" AFTER INSERT OR UPDATE ON "public"."credit_note_items" FOR EACH ROW WHEN (("new"."returned_quantity" > 0)) EXECUTE FUNCTION "public"."handle_credit_note_inventory"();



CREATE OR REPLACE TRIGGER "on_credit_transaction" AFTER INSERT ON "public"."credit_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_customer_credit_balance"();



CREATE OR REPLACE TRIGGER "on_customer_payment_store_credit_usage" AFTER INSERT ON "public"."customer_payments" FOR EACH ROW WHEN (("new"."payment_method" = 'store_credit'::"text")) EXECUTE FUNCTION "public"."handle_store_credit_usage"();



CREATE OR REPLACE TRIGGER "on_grn_item_change" AFTER INSERT OR UPDATE ON "public"."good_receive_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_grn_inventory_update"();



CREATE OR REPLACE TRIGGER "on_new_product_created" AFTER INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_product_initial_stock"();



CREATE OR REPLACE TRIGGER "on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_user_settings"();



CREATE OR REPLACE TRIGGER "on_purchase_order_status_change" AFTER UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_purchase_order_inventory"();



CREATE OR REPLACE TRIGGER "on_sales_order_status_change" AFTER UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sales_order_inventory"();



CREATE OR REPLACE TRIGGER "on_stock_level_audit" AFTER UPDATE ON "public"."stock_levels" FOR EACH ROW WHEN (("old"."quantity_on_hand" IS DISTINCT FROM "new"."quantity_on_hand")) EXECUTE FUNCTION "public"."handle_stock_level_audit"();



CREATE OR REPLACE TRIGGER "trg_product_serials_sync_stock_levels_del" AFTER DELETE ON "public"."product_serials" FOR EACH ROW EXECUTE FUNCTION "public"."product_serials_sync_stock_levels"();



CREATE OR REPLACE TRIGGER "trg_product_serials_sync_stock_levels_ins" AFTER INSERT ON "public"."product_serials" FOR EACH ROW EXECUTE FUNCTION "public"."product_serials_sync_stock_levels"();



CREATE OR REPLACE TRIGGER "trg_product_serials_sync_stock_levels_upd" AFTER UPDATE ON "public"."product_serials" FOR EACH ROW EXECUTE FUNCTION "public"."product_serials_sync_stock_levels"();



CREATE OR REPLACE TRIGGER "trg_update_customer_current_credit" AFTER INSERT OR DELETE OR UPDATE ON "public"."customer_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_current_credit"();



CREATE OR REPLACE TRIGGER "trg_update_invoice_payment_amounts_delete" AFTER DELETE ON "public"."customer_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_payment_amounts"();



CREATE OR REPLACE TRIGGER "trg_update_invoice_payment_amounts_insert" AFTER INSERT ON "public"."customer_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_payment_amounts"();



CREATE OR REPLACE TRIGGER "trg_update_invoice_payment_amounts_update" AFTER UPDATE OF "payment_amount" ON "public"."customer_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_invoice_payment_amounts"();



CREATE OR REPLACE TRIGGER "trg_update_sales_order_status" AFTER UPDATE ON "public"."sale_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_sales_order_status_from_invoice"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_credit_note_items_updated_at" BEFORE UPDATE ON "public"."credit_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_credit_notes_updated_at" BEFORE UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_good_receive_note_items_updated_at" BEFORE UPDATE ON "public"."good_receive_note_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_good_receive_notes_updated_at" BEFORE UPDATE ON "public"."good_receive_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_movements_updated_at" BEFORE UPDATE ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_locations_updated_at" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_serials_updated_at" BEFORE UPDATE ON "public"."product_serials" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_serials_updated_at"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_purchase_order_items_updated_at" BEFORE UPDATE ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_purchase_orders_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sales_order_items_updated_at" BEFORE UPDATE ON "public"."sales_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sales_orders_updated_at" BEFORE UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_taxes_updated_at" BEFORE UPDATE ON "public"."taxes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_units_updated_at" BEFORE UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "public"."sales_order_items"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sale_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_sale_invoice_id_fkey" FOREIGN KEY ("sale_invoice_id") REFERENCES "public"."sale_invoices"("id");



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sale_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."good_receive_note_items"
    ADD CONSTRAINT "good_receive_note_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."good_receive_note_items"
    ADD CONSTRAINT "good_receive_note_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "public"."good_receive_notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."good_receive_note_items"
    ADD CONSTRAINT "good_receive_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."good_receive_note_items"
    ADD CONSTRAINT "good_receive_note_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id");



ALTER TABLE ONLY "public"."good_receive_notes"
    ADD CONSTRAINT "good_receive_notes_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."good_receive_notes"
    ADD CONSTRAINT "good_receive_notes_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."good_receive_notes"
    ADD CONSTRAINT "good_receive_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_grn_item_id_fkey" FOREIGN KEY ("grn_item_id") REFERENCES "public"."good_receive_note_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_serials"
    ADD CONSTRAINT "product_serials_sale_invoice_item_id_fkey" FOREIGN KEY ("sale_invoice_item_id") REFERENCES "public"."sale_invoice_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_purchase_tax_id_fkey" FOREIGN KEY ("purchase_tax_id") REFERENCES "public"."taxes"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sale_tax_id_fkey" FOREIGN KEY ("sale_tax_id") REFERENCES "public"."taxes"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."sale_invoice_items"
    ADD CONSTRAINT "sale_invoice_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sale_invoice_items"
    ADD CONSTRAINT "sale_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."sale_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_invoice_items"
    ADD CONSTRAINT "sale_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_invoice_items"
    ADD CONSTRAINT "sale_invoice_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "public"."sales_order_items"("id");



ALTER TABLE ONLY "public"."sale_invoices"
    ADD CONSTRAINT "sale_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sale_invoices"
    ADD CONSTRAINT "sale_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."sale_invoices"
    ADD CONSTRAINT "sale_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_default_tax_rate_fkey" FOREIGN KEY ("default_tax_rate") REFERENCES "public"."taxes"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin and manager access" ON "public"."categories" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."customers" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."locations" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."products" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."stock_levels" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."suppliers" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."taxes" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin and manager access" ON "public"."units" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'manager'::"public"."user_role"])));



CREATE POLICY "Admin only delete access" ON "public"."roles" FOR DELETE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "Admin only insert access" ON "public"."roles" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "Admin only update access" ON "public"."roles" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins can manage system settings" ON "public"."system_settings" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins can view all user settings" ON "public"."user_settings" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));



CREATE POLICY "All authenticated users access" ON "public"."credit_note_items" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."credit_notes" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."credit_transactions" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."customer_credit_balances" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."good_receive_note_items" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."good_receive_notes" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."inventory_movements" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."inventory_transactions" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."product_serials" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "All authenticated users access" ON "public"."purchase_order_items" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."purchase_orders" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."sale_invoice_items" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."sale_invoices" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."sales_order_items" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All authenticated users access" ON "public"."sales_orders" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read roles" ON "public"."roles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Enable delete for authenticated users" ON "public"."customer_payments" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users" ON "public"."customer_payments" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all authenticated users" ON "public"."customer_payments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update for authenticated users" ON "public"."customer_payments" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Staff read access" ON "public"."categories" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."customers" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."locations" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."products" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."stock_levels" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."suppliers" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."taxes" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Staff read access" ON "public"."units" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'staff'::"public"."user_role"));



CREATE POLICY "Users can manage their own settings" ON "public"."user_settings" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read public system settings" ON "public"."system_settings" FOR SELECT USING ((("is_public" = true) AND ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_note_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_credit_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."good_receive_note_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."good_receive_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_serials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."taxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_serialized_delta"("p_product" "uuid", "p_loc" "uuid", "p_status" "text", "p_delta" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_serialized_delta"("p_product" "uuid", "p_loc" "uuid", "p_status" "text", "p_delta" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_serialized_delta"("p_product" "uuid", "p_loc" "uuid", "p_status" "text", "p_delta" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_customer_credit_limit"("p_customer_id" "uuid", "p_invoice_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."check_customer_credit_limit"("p_customer_id" "uuid", "p_invoice_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_customer_credit_limit"("p_customer_id" "uuid", "p_invoice_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_user_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_user_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_user_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_stock_level_row"("p_product_id" "uuid", "p_location_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_stock_level_row"("p_product_id" "uuid", "p_location_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_stock_level_row"("p_product_id" "uuid", "p_location_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_credit_note_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_credit_note_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_credit_note_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_credit_note_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_credit_note_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_credit_note_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_customer_credit_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_customer_credit_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_customer_credit_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_grn_inventory_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_grn_inventory_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_grn_inventory_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_product_initial_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_product_initial_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_product_initial_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_purchase_order_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_purchase_order_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_purchase_order_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sale_invoice_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sale_invoice_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sale_invoice_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sales_order_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sales_order_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sales_order_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_stock_level_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_stock_level_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_stock_level_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_store_credit_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_store_credit_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_store_credit_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."product_serials_sync_stock_levels"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_serials_sync_stock_levels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_serials_sync_stock_levels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_amount" numeric, "p_type" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_amount" numeric, "p_type" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_amount" numeric, "p_type" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_type" "text", "p_amount" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_type" "text", "p_amount" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_credit_balance"("p_customer_id" "uuid", "p_type" "text", "p_amount" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_current_credit"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_current_credit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_current_credit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_invoice_payment_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_invoice_payment_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_invoice_payment_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_serials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_serials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_serials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sales_order_status_from_invoice"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sales_order_status_from_invoice"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sales_order_status_from_invoice"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."credit_note_items" TO "anon";
GRANT ALL ON TABLE "public"."credit_note_items" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_note_items" TO "service_role";



GRANT ALL ON TABLE "public"."credit_notes" TO "anon";
GRANT ALL ON TABLE "public"."credit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_credit_balances" TO "anon";
GRANT ALL ON TABLE "public"."customer_credit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_credit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."customer_payments" TO "anon";
GRANT ALL ON TABLE "public"."customer_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payments" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."good_receive_note_items" TO "anon";
GRANT ALL ON TABLE "public"."good_receive_note_items" TO "authenticated";
GRANT ALL ON TABLE "public"."good_receive_note_items" TO "service_role";



GRANT ALL ON TABLE "public"."good_receive_notes" TO "anon";
GRANT ALL ON TABLE "public"."good_receive_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."good_receive_notes" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."product_serials" TO "anon";
GRANT ALL ON TABLE "public"."product_serials" TO "authenticated";
GRANT ALL ON TABLE "public"."product_serials" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."sale_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."sale_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."sale_invoices" TO "anon";
GRANT ALL ON TABLE "public"."sale_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stock_levels" TO "anon";
GRANT ALL ON TABLE "public"."stock_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_levels" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."taxes" TO "anon";
GRANT ALL ON TABLE "public"."taxes" TO "authenticated";
GRANT ALL ON TABLE "public"."taxes" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







-- ==========================================
-- Auth Schema (if needed)
-- ==========================================
-- Note: Auth schema is usually created by Supabase Auth migrations
-- This section is included for reference only



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";




-- ==========================================
-- Auth Users Data
-- ==========================================
-- Note: Auth users should be inserted AFTER auth schema is created
-- The Supabase Auth service will create the schema via migrations
-- This data will be inserted after migrations complete

-- No auth.users data to import

-- ==========================================
-- Master Data (public schema)
-- ==========================================

-- Master Data from Supabase
-- Extracted on: Thu Nov 27 00:00:45 +04 2025

INSERT INTO "public"."categories" ("id", "name", "description", "parent_id", "is_active", "created_at", "updated_at") VALUES
	('22222222-2222-2222-2222-222222222227', 'Zebra Printer Accessories', 'Zebra Printers', NULL, true, '2025-07-26 07:44:27.592899+00', '2025-08-21 14:27:12.639965+00'),
	('2ea159fe-8cb3-4e24-b988-08cfb0d5991d', 'Desktop Printer Accessories', '', '22222222-2222-2222-2222-222222222227', true, '2025-08-21 14:25:40.911335+00', '2025-08-21 14:27:22.969366+00'),
	('f63045bf-d267-4eee-9c83-63d04281bf30', 'Mobile Printer Accessories', '', '22222222-2222-2222-2222-222222222227', true, '2025-08-11 17:42:51.943592+00', '2025-08-21 14:27:32.149591+00'),
	('43f69e61-369b-4d40-920e-4750a9e9ce43', 'Table Top Printers Accessories', '', '22222222-2222-2222-2222-222222222227', true, '2025-08-21 14:26:30.206676+00', '2025-08-21 14:27:45.492036+00'),
	('b4c4caae-d88e-4107-8b3e-17f30ee6c93b', 'Table Top Printers', '', NULL, true, '2025-08-23 11:27:17.765224+00', '2025-08-23 11:27:17.765224+00'),
	('5dcbe42b-9844-4f7f-8a19-d4882309c370', 'Mobile Printer', '', NULL, true, '2025-08-23 11:33:49.068335+00', '2025-08-23 11:33:49.068335+00'),
	('6779dc86-2a10-4e17-b592-bb5d6dd7e460', 'Desktop Printer', '', NULL, true, '2025-08-23 11:25:57.449774+00', '2025-08-23 11:35:57.499879+00');
INSERT INTO "public"."customers" ("id", "name", "email", "phone", "billing_address", "shipping_address", "tax_id", "notes", "credit_limit", "current_credit", "customer_type", "created_at", "updated_at", "is_active") VALUES
	('febb7e7f-4d24-4806-87f1-1045a70a1886', 'Online Shop Express', 'support@onlineshop.com', '+1-555-3003', '{"city": "Tech Hub", "state": "TX", "street": "300 Digital Lane", "country": "United States", "zipCode": "78656"}', '{"city": "Tech Hub", "state": "TX", "street": "300 Digital Lane", "country": "United States", "zipCode": "78656"}', 'CUST-003', 'E-commerce customer', 300000.00, 2500.00, 'retail', '2025-07-29 22:18:30.804734+00', '2025-09-03 17:01:47.491617+00', true),
	('68f4bbb4-f626-4d2a-ac6b-cdcf78339eeb', 'Regional Distributor North', 'sales@regionaldist.com', '+1-555-4004', '{"city": "Distribution Center", "state": "IL", "street": "400 Regional Way", "country": "United States", "zipCode": "23121"}', '{"city": "Logistics Park", "state": "IL", "street": "401 Logistics Drive", "country": "", "zipCode": ""}', 'CUST-004', 'Regional distribution partner', 300000.00, 0.00, 'distributor', '2025-07-29 22:18:30.804734+00', '2025-09-03 17:02:01.220359+00', true),
	('b1e52ae9-7149-4428-8e14-236353685a27', 'Wholesale Distributor XYZ', 'orders@wholesalexyz.com', '+1-555-2002', '{"city": "Business District", "state": "NY", "street": "200 Commerce Blvd", "country": "United States", "zipCode": "97565"}', '{"city": "Business District", "state": "NY", "street": "200 Commerce Blvd", "country": "United States", "zipCode": "97565"}', 'CUST-002', 'Major wholesale partner', 300000.00, 300.00, 'wholesale', '2025-07-29 22:18:30.804734+00', '2025-09-03 17:02:13.241558+00', true),
	('45e2bbaa-5f8f-4080-b53d-37e531773f7f', 'Local Business Solutions', 'info@localbusiness.com', '+1-555-5005', '{"city": "Small Town", "state": "FL", "street": "500 Local Street", "country": "United States", "zipCode": "1231"}', '{"city": "Small Town", "state": "FL", "street": "500 Local Street", "country": "United States", "zipCode": "1231"}', 'CUST-005', 'Local business customer', 300000.00, 1849.30, 'wholesale', '2025-07-29 22:18:30.804734+00', '2025-09-27 02:27:38.887295+00', true),
	('11e912aa-907c-4058-907f-038bdd2d49e4', 'Retail Store ABC', 'contact@retailabc.com', '+1-555-1001', '{"city": "Downtown", "state": "CA", "street": "100 Main Street", "country": "United States", "zipCode": "98575"}', '{"city": "Downtown", "state": "CA", "street": "100 Main Street", "country": "United States", "zipCode": "98575"}', 'CUST-001', 'Regular retail customer', 300000.00, 0.00, 'retail', '2025-07-29 22:18:30.804734+00', '2025-09-27 02:30:49.920267+00', true);
INSERT INTO "public"."roles" ("id", "name", "description", "permissions", "created_at", "updated_at") VALUES
	('a3ef37b6-25cc-456b-a4a1-7e550b20a267', 'staff', 'Staff', '["categories_create", "categories_delete", "categories_edit", "categories_view", "dashboard_view", "products_create", "products_delete", "products_edit", "products_view", "roles_delete"]', '2025-07-31 14:07:01.061973+00', '2025-08-01 18:29:42.221484+00'),
	('977228e3-a283-43a5-b7c8-37cce50fc160', 'admin', 'Administrator', '["dashboard_view", "products_view", "products_create", "products_edit", "products_delete", "categories_view", "categories_create", "categories_edit", "categories_delete", "units_view", "units_create", "units_edit", "units_delete", "taxes_view", "taxes_create", "taxes_edit", "taxes_delete", "suppliers_view", "suppliers_create", "suppliers_edit", "suppliers_delete", "customers_view", "customers_create", "customers_edit", "customers_delete", "inventory_view", "inventory_stock_view", "inventory_stock_manage", "inventory_movements_view", "inventory_movements_create", "inventory_locations_view", "inventory_locations_manage", "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit", "purchase_orders_delete", "grn_view", "grn_create", "grn_edit", "grn_delete", "sale_orders_view", "sale_orders_create", "sale_orders_edit", "sale_orders_delete", "sale_invoices_view", "sale_invoices_create", "sale_invoices_edit", "sale_invoices_delete", "credit_notes_view", "credit_notes_create", "credit_notes_edit", "credit_notes_delete", "reports_view", "reports_export", "users_view", "users_create", "users_edit", "users_delete", "roles_view", "roles_create", "roles_edit", "roles_delete", "settings_view", "settings_edit"]', '2025-07-31 14:07:01.061973+00', '2025-08-02 04:44:50.991565+00'),
	('34956656-03e8-4ea0-a408-f6d343f2225a', 'manager', 'Manager', '["dashboard_view", "products_view", "products_create", "products_edit", "products_delete", "categories_view", "categories_create", "categories_edit", "categories_delete", "units_view", "units_create", "units_edit", "units_delete", "taxes_view", "taxes_create", "taxes_edit", "taxes_delete", "suppliers_view", "suppliers_create", "suppliers_edit", "suppliers_delete", "customers_view", "customers_create", "customers_edit", "customers_delete", "inventory_view", "inventory_stock_view", "inventory_stock_manage", "inventory_movements_view", "inventory_movements_create", "inventory_locations_view", "inventory_locations_manage", "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit", "purchase_orders_delete", "grn_view", "grn_create", "grn_edit", "grn_delete", "sale_orders_view", "sale_orders_create", "sale_orders_edit", "sale_orders_delete", "sale_invoices_view", "sale_invoices_create", "sale_invoices_edit", "sale_invoices_delete", "credit_notes_view", "credit_notes_create", "credit_notes_edit", "credit_notes_delete", "reports_view", "reports_export", "barcode_view", "barcode_create", "barcode_print", "backup_view", "backup_create", "backup_restore", "users_view", "users_create", "users_edit", "users_delete", "roles_view", "roles_create", "roles_edit", "roles_delete", "settings_view", "settings_edit"]', '2025-07-31 14:07:01.061973+00', '2025-07-31 14:18:09.072772+00');
INSERT INTO "public"."profiles" ("id", "username", "full_name", "is_active", "created_at", "updated_at", "role_id") VALUES
	('a407b702-099d-4507-9ac3-d8bd7b6d4cf3', 'manager', 'Manager', true, '2025-07-29 08:49:27.860142+00', '2025-07-29 08:49:29.054056+00', '34956656-03e8-4ea0-a408-f6d343f2225a'),
	('ccfbb242-0687-4aed-965a-cffe41824e0d', 'staff', 'Staff', true, '2025-07-29 12:45:25.632057+00', '2025-07-29 13:12:22.129467+00', 'a3ef37b6-25cc-456b-a4a1-7e550b20a267'),
	('ad8dc9fd-e850-4906-9f14-6da34b0f5039', 'admin', 'Administrator', true, '2025-07-26 08:26:12.620653+00', '2025-08-27 09:09:30.798443+00', '977228e3-a283-43a5-b7c8-37cce50fc160');
INSERT INTO "public"."suppliers" ("id", "name", "contact_name", "email", "phone", "address", "payment_terms", "tax_id", "notes", "is_active", "created_at", "updated_at", "billing_address", "shipping_address") VALUES
	('1870e6f7-a5ab-4f32-a652-d18ef1201855', 'Cloudswood Technologies Pvt. Ltd.', 'Sasi', 't2@cloudswood.net', '+91 98452 26363', NULL, '30 Days', '', '', true, '2025-08-23 12:08:00.800557+00', '2025-08-23 12:08:00.800557+00', '{"city": "BENGALURU ", "state": "Karnataka", "street": "No.39, 2nd ''C'' cross, H-Chandra Reddy Layout, Dorasanipalya Industrial Area, Bilekahalli, ", "country": "India", "zipCode": "560076"}', '{"city": "", "state": "", "street": "", "country": "", "zipCode": ""}'),
	('8c84da11-5118-47b1-96ff-309f468d1d2f', 'SSR SOLUTIONS', 'Rahul', 'ssrsolutions@mail.com', '080-43774889 / 9880381700', NULL, '30 Days', '', '', true, '2025-08-23 12:19:10.622152+00', '2025-08-23 12:19:10.622152+00', '{"city": "BENGALURU ", "state": "Karnataka", "street": " NO 12/1, 5TH CROSS  CUBBONPET,", "country": "India", "zipCode": " 560002"}', '{"city": "", "state": "", "street": "", "country": "", "zipCode": ""}'),
	('9706aabd-07b3-4b16-bcc1-bd3240a3a079', 'P V Lumens', 'avinave', 'manju@example.com', '2342342', NULL, '30 days', '', '', true, '2025-08-11 17:51:34.922451+00', '2025-08-11 17:51:34.922451+00', '{"city": "Bangalore", "state": "Karnataka", "street": "Lalbagh Road ", "country": "India", "zipCode": "560027"}', '{"city": "", "state": "", "street": "", "country": "", "zipCode": ""}'),
	('d56b3d59-e196-4002-b96b-3c52080a69d1', 'MARKSS INFOTECH LTD', 'Karthik Kannan', 'Karthik_k@markss.com', '+91 98403 93914', NULL, '30 days', '27AACCM6071A1ZT', '', true, '2025-08-23 11:44:12.742265+00', '2025-08-23 11:45:41.310443+00', '{"city": " Mumbai ", "state": "Maharashtra ", "street": "70B, KCIEL, Post Office Lane, Charkop Kandivali (W),", "country": "India", "zipCode": " 400067."}', '{"city": " Mumbai ", "state": "Maharashtra ", "street": "70B, KCIEL, Post Office Lane, Charkop Kandivali (W),", "country": "India", "zipCode": " 400067."}'),
	('634718d8-530c-4e1c-857d-9ffc57d08749', 'IKON LABELS PVT LTD', 'Karthik', 'ikonfactory@yahoo.co.in', '+91 98457 72821', NULL, '30 Days', '', '', true, '2025-08-23 11:58:31.61456+00', '2025-08-23 11:58:31.61456+00', '{"city": "BENGALURU ", "state": "Karnataka", "street": "# 304, CHICAGO AVENUE, 37/2 CUNNINGHAM ROAD,", "country": "India", "zipCode": "560052"}', '{"city": "", "state": "", "street": "", "country": "", "zipCode": ""}');
INSERT INTO "public"."taxes" ("id", "name", "rate", "is_default", "applied_to", "description", "is_active", "created_at", "updated_at") VALUES
	('285dc8c3-4685-44bb-bf17-8cd913e5f136', 'Zero Tax', 0.0000, false, 'both', 'Tax-free items', true, '2025-07-26 07:16:47.617043+00', '2025-07-31 07:28:29.498185+00'),
	('63e3df1f-efba-4d84-ad00-91fbb7376b4b', 'GST 5%', 0.0500, false, 'both', 'GST 5% tax rate', true, '2025-07-26 07:16:47.617043+00', '2025-08-02 17:09:18.853506+00'),
	('4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', 'GST 18%', 0.1800, false, 'both', 'GST 18% tax rate for essential items', true, '2025-07-26 07:16:47.617043+00', '2025-08-02 17:10:33.660804+00');
INSERT INTO "public"."units" ("id", "name", "abbreviation", "description", "created_at", "updated_at", "is_active") VALUES
	('bf973799-177f-4e5c-9081-0fc6748b93f8', 'Kilogram', 'kg', 'Weight measurement', '2025-07-26 07:16:47.617043+00', '2025-07-26 07:16:47.617043+00', true),
	('1630685a-dc42-4d90-9f1e-a0a348467ac2', 'Liter', 'L', 'Volume measurement', '2025-07-26 07:16:47.617043+00', '2025-07-26 07:16:47.617043+00', true),
	('8114af65-597f-4f5a-b84d-72b04155037f', 'Meter', 'm', 'Length measurement', '2025-07-26 07:16:47.617043+00', '2025-07-26 07:16:47.617043+00', true),
	('15bcf491-daad-4c5f-b7bf-a6536ba2ef70', 'Box', 'box', 'Packaging unit', '2025-07-26 07:16:47.617043+00', '2025-07-26 07:16:47.617043+00', true),
	('7dd4f53e-f27e-429f-be8e-388c7f4712cc', 'Case', 'case', 'Bulk packaging unit', '2025-07-26 07:16:47.617043+00', '2025-07-26 07:16:47.617043+00', true),
	('4d0f4d7a-2b1a-49e7-b82e-bd1ea96ef98d', 'Quantity', 'Qty', 'Individual items', '2025-07-26 07:16:47.617043+00', '2025-08-09 20:10:59.304238+00', true);
INSERT INTO "public"."products" ("id", "name", "description", "sku_code", "barcode", "category_id", "unit_id", "cost_price", "selling_price", "minimum_stock", "maximum_stock", "reorder_point", "is_active", "created_at", "updated_at", "hsn_code", "manufacturer_part_number", "supplier_id", "sale_tax_id", "purchase_tax_id", "manufacturer", "brand", "warranty_period", "warranty_unit", "product_tags", "is_serialized", "track_inventory", "allow_override_price", "discount_percentage", "warehouse_rack", "unit_conversions", "mrp", "sale_price", "subcategory_id", "sale_tax_type", "purchase_tax_type", "initial_quantity") VALUES
	('14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 'ZD621D 300 dpi Printhead', 'Kit, Printhead 300 dpi, ZD621D', 'ZD621051', '', '22222222-2222-2222-2222-222222222227', '4d0f4d7a-2b1a-49e7-b82e-bd1ea96ef98d', 11250.00, 13950.00, 1, NULL, 1, true, '2025-08-23 10:20:05.372821+00', '2025-08-23 10:20:05.372821+00', '84439959', 'P1112640-051', '9706aabd-07b3-4b16-bcc1-bd3240a3a079', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', 'Zebra', 'Zebra', NULL, 'days', '{}', true, true, true, 0.00, '', NULL, 13950.00, 13950.00, '2ea159fe-8cb3-4e24-b988-08cfb0d5991d', 'exclusive', 'exclusive', 0),
	('297e81e8-8107-4b9a-bc7b-7f0b36651194', 'ZD420D ZD620D  300 dpi Printhead', 'Kit, Printhead 300 dpi, ZD420D ZD620D', 'ZD620416', '', '22222222-2222-2222-2222-222222222227', '4d0f4d7a-2b1a-49e7-b82e-bd1ea96ef98d', 11250.00, 13950.00, 1, NULL, 1, true, '2025-08-23 10:31:23.295738+00', '2025-08-23 10:31:23.295738+00', '84439959', 'P1080383-416', '9706aabd-07b3-4b16-bcc1-bd3240a3a079', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', 'Zebra', 'Zebra', NULL, 'days', '{}', true, true, false, 0.00, '', NULL, 13950.00, 13950.00, '2ea159fe-8cb3-4e24-b988-08cfb0d5991d', 'exclusive', 'exclusive', 0),
	('6d3b35ef-9b2d-4891-9d17-9cabba4554b8', 'DT Printer ZQ630 Plus (India Only)', 'DT Printer ZQ630 Plus (India Only); English, Trad Chinese, Korean fonts, Dual 802.11AC / BT4.x, Linered platen, 0.75"" core, Group D, India Only Battery, Belt clip', '1001', '', 'f63045bf-d267-4eee-9c83-63d04281bf30', '4d0f4d7a-2b1a-49e7-b82e-bd1ea96ef98d', 61000.00, 78000.00, 0, NULL, 0, true, '2025-08-11 17:49:25.758945+00', '2025-08-18 04:53:11.778573+00', '844332', 'ZQ63AAWADF400', '9706aabd-07b3-4b16-bcc1-bd3240a3a079', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', '4260ac4d-65e6-4ebb-90dc-c3f1852aed4d', 'Zebra', 'Zebra', 1, 'years', '{}', true, true, true, 0.00, 'A1-01', NULL, 100000.00, 78000.00, NULL, 'exclusive', 'exclusive', 0),
INSERT INTO "public"."locations" ("id", "name", "description", "address", "is_active", "created_at", "updated_at") VALUES
	('211c1556-5ab9-4512-ba38-1aa9610f0763', 'Main Warehouse', 'Primary storage facility', '123 Warehouse St, City, State', true, '2025-07-30 20:42:31.781652+00', '2025-07-30 20:42:31.781652+00'),
	('ea017ca7-8a2c-4287-8221-f9bddb768800', 'Store Front', 'Retail store location', '456 Main St, City, State', true, '2025-07-30 20:42:31.781652+00', '2025-07-30 20:42:31.781652+00'),
	('18a5eae7-021e-45cc-9ad8-e657c0cf26fa', 'Secondary Storage', 'Additional storage space', '789 Storage Ave, City, State', true, '2025-07-30 20:42:31.781652+00', '2025-07-30 20:42:31.781652+00');
INSERT INTO "public"."product_serials" ("id", "product_id", "serial_number", "status", "grn_item_id", "sale_invoice_item_id", "location_id", "created_at", "updated_at") VALUES
	('82016bf3-5e98-4231-8592-fa84fc3cd08e', 'c7c5130d-bc44-4832-9514-0904d45c938c', '123456789', 'available', '98741089-5834-4f83-8ec0-d5e76de96663', NULL, NULL, '2025-08-24 13:10:46.436231+00', '2025-08-24 13:10:46.436231+00'),
	('cf84ddd8-e05e-4514-a21e-9933bbdda3d5', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', '123456', 'available', 'a86437cf-cf76-4ce7-8b47-cf479dbf1d97', NULL, NULL, '2025-09-27 02:24:07.543227+00', '2025-09-27 02:24:07.543227+00'),
	('25cc8519-5f0e-4100-9841-e6a491649e13', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', '123456789', 'available', 'a86437cf-cf76-4ce7-8b47-cf479dbf1d97', NULL, NULL, '2025-09-27 02:24:07.543227+00', '2025-09-27 02:24:07.543227+00'),
	('e88f7674-a65c-4fed-8413-ae6cf9178f3b', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', '1234567', 'sold', 'a86437cf-cf76-4ce7-8b47-cf479dbf1d97', '43e018ee-1d9d-42f7-867c-4633746e4518', NULL, '2025-09-27 02:24:07.543227+00', '2025-09-27 02:35:05.31048+00');
INSERT INTO "public"."stock_levels" ("id", "product_id", "quantity_on_hand", "quantity_reserved", "last_updated", "location_id", "created_by", "serialized_available", "serialized_reserved", "serialized_sold", "serialized_returned", "serialized_scrapped") VALUES
	('4f1188bf-34d9-4ae0-99f9-92e8efeb4682', 'ab9f3a74-230b-45a7-8231-b18a8416ae74', 0, 0, '2025-08-23 09:46:56.698084+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('5524837b-e651-41d3-be6e-22be8a89d5ad', 'd90e4427-5f56-461a-92f3-86327b601aa4', 0, 0, '2025-08-23 10:27:30.466106+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('dc7819f9-20a8-499a-bee4-b8723cae860e', '297e81e8-8107-4b9a-bc7b-7f0b36651194', 0, 0, '2025-08-23 10:31:23.984901+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('8743a547-f09c-448d-8d38-a439d5170bee', 'c3157406-3771-4c11-aa7d-ec8d4a0039e7', 0, 0, '2025-08-23 10:36:30.2421+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('ffb30902-43a3-4304-a446-d2a1f1b856af', '525395ec-2241-4444-8f5f-6650967e5171', 0, 0, '2025-08-23 10:40:17.86593+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('53332ae3-1d53-49f8-bc8a-99ef3afe6f31', '94f80ff8-f07f-44f0-9279-120e0b2f0cce', 0, 0, '2025-08-23 10:46:08.444587+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('bac37d40-1b9e-4a21-9268-b4bb3e3ac7c8', '9943349b-711e-4263-8bda-8293290e6ddf', 0, 0, '2025-08-23 11:17:08.831469+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('f52093d4-df9e-494f-af2c-e98654de090d', '02ff44f5-c1d7-4486-b78e-707171f36864', 0, 0, '2025-08-23 11:20:55.842166+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('cb31361a-a6cb-47f6-9459-da0c0120acbf', '57a28a3f-e61a-4bd4-a0c1-0a6080a5c3da', 0, 0, '2025-08-23 11:24:16.906206+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('3d586981-fc3b-4397-992b-a549e473f8f4', 'c3eb587e-f4c6-47e8-851c-b4215e7df042', 0, 0, '2025-08-23 08:42:22.203864+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('87e32c31-8228-4560-abd8-02c335c4a6cb', '81571fc7-c0ee-41b9-876b-23f8a163425e', 0, 0, '2025-08-23 08:36:36.025851+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('a9e36c1e-ec8c-4ad3-a744-3a44b4acf5a3', '9649bc04-903a-4b99-8394-ed0547b17dba', 0, 0, '2025-08-21 14:42:49.408067+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 0, 0, 0, 0, 0),
	('53360fe6-b5c1-4f21-a722-dba8951ce7d0', 'c7c5130d-bc44-4832-9514-0904d45c938c', 0, 0, '2025-08-23 09:01:56.363035+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 1, 0, 0, 0, 0),
	('3b31d036-e2a2-40b4-bd46-357ff337f2d5', 'c7c5130d-bc44-4832-9514-0904d45c938c', 0, 0, '2025-08-24 13:10:46.436231+00', NULL, NULL, 1, 0, 0, 0, 0),
	('9f2e6b80-11bb-4639-a5f2-1105cb5b6ad3', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-08-23 10:20:06.133241+00', NULL, 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', 2, 0, 1, 0, 0),
	('6c8536c7-c926-4c28-af38-4c9d5dfc9b3f', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-09-27 02:24:07.543227+00', NULL, NULL, 2, 0, 1, 0, 0),
	('d9d2e8b8-a98a-4f1a-8c47-e1fc13d669e9', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-09-27 02:24:07.543227+00', NULL, NULL, 1, 0, 1, 0, 0),
	('44223977-36d0-42e9-ad1f-5bf15aa979b5', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-09-27 02:24:07.543227+00', NULL, NULL, 0, 0, 1, 0, 0),
	('10a520ab-b7e1-4954-9005-d0eaea852da5', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-09-27 02:35:05.31048+00', NULL, NULL, -1, 0, 1, 0, 0),
	('9e33cf82-00bc-41b2-8462-26e5a1a5695d', '14ec61a6-79f1-4f57-91c4-d2f2595ccabc', 0, 0, '2025-09-27 02:35:05.31048+00', NULL, NULL, 0, 0, 1, 0, 0);
INSERT INTO "public"."system_settings" ("id", "setting_key", "setting_value", "setting_type", "description", "is_public", "created_by", "created_at", "updated_at") VALUES
	('e2da0bfc-9eff-4861-b53a-bb0d6c9b52eb', 'backup_retention_days', '"30"', 'number', 'Number of days to retain backups', false, NULL, '2025-07-30 08:47:57.184698+00', '2025-07-30 12:01:31.482957+00'),
	('94d52bfe-e8a9-4f18-adb4-6c7f95a2a1ba', 'default_currency', '"\"INR\""', 'string', 'Default currency for the system', true, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-04 15:10:28.76974+00'),
	('b4e5424a-0402-4905-ad0b-4e30b0fa26a5', 'invoice_auto_numbering', 'true', 'boolean', 'Auto-generate Invoice numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:31.316561+00'),
	('5f9e3448-180c-43a5-9942-5caa1808ff5b', 'low_stock_global_threshold', '"10"', 'number', 'Global low stock threshold percentage', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:19.100281+00'),
	('e246d08f-03da-4e90-a1b0-27518ed73ea9', 'backup_frequency', '"\"daily\""', 'string', 'System backup frequency', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:19.101565+00'),
	('672f95b7-e910-41a8-87c1-9e5ec46e8f96', 'tax_calculation_method', '"\"exclusive\""', 'string', 'How tax is calculated (inclusive or exclusive)', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:19.101993+00'),
	('98ab6748-208c-4ba5-974e-d87c20b58098', 'allowed_file_types', '"\"jpg,jpeg,png,pdf,doc,docx,xls,xlsx\""', 'string', 'Allowed file types for uploads', false, NULL, '2025-07-30 08:47:59.419834+00', '2025-07-30 12:01:31.48533+00'),
	('f9dae080-28f1-40ff-b9ec-01c2e16116de', 'po_auto_numbering', 'true', 'boolean', 'Auto-generate Purchase Order numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:31.360013+00'),
	('41585ba1-6503-4aab-a4c3-8c4480d7a78f', 'time_format', '"\"12\""', 'string', 'Time format (12 or 24 hour)', false, NULL, '2025-07-30 08:47:50.100803+00', '2025-07-30 11:59:32.280671+00'),
	('f108381f-b8f7-47e7-8ac0-d8295b87729e', 'enable_two_factor_auth', 'false', 'boolean', 'Enable two-factor authentication', false, NULL, '2025-07-30 08:48:00.028404+00', '2025-08-04 14:05:06.78887+00'),
	('552a24f4-6e52-4acb-b7c8-b1127d3e290d', 'max_login_attempts', '"5"', 'number', 'Maximum login attempts before lockout', false, NULL, '2025-07-30 08:47:53.382771+00', '2025-07-30 11:59:33.27303+00'),
	('31c52908-be29-46ee-9eeb-9a670f82af5a', 'enable_signup', 'false', 'boolean', 'Enable user signup feature', true, NULL, '2025-07-30 08:47:52.083239+00', '2025-07-30 18:59:38.877397+00'),
	('1bd4b70b-4f22-46ff-a265-7fc5d7ea300e', 'email_notifications_enabled', 'false', 'boolean', 'Enable email notifications', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-04 14:05:06.802182+00'),
	('a459ba40-69a6-46a0-a76c-80ac5f27989d', 'max_file_upload_size', '"10485760"', 'number', 'Maximum file upload size in bytes', false, NULL, '2025-07-30 08:47:58.798179+00', '2025-07-30 12:01:32.471587+00'),
	('047fd691-fcb3-45f1-b4e2-84206493eaa6', 'grn_prefix', '"\"GRN\""', 'string', 'Prefix for goods received note numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:32.487326+00'),
	('28d393fc-76c7-4a7d-a73c-3b4c7d52cdbb', 'enable_multi_warehouse', 'false', 'boolean', 'Enable multi-warehouse functionality', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:31.485787+00'),
	('5917f993-d6cd-4448-a817-2ffc01eb4e5a', 'auto_backup_enabled', 'false', 'boolean', 'Enable automatic database backups', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-04 14:05:06.801011+00'),
	('3902ddde-996d-470a-8887-33801756566a', 'session_timeout_warning', '"300"', 'number', 'Session timeout warning in seconds', false, NULL, '2025-07-30 08:47:55.93866+00', '2025-07-30 12:01:31.51091+00'),
	('26043398-ee37-49a9-985f-57caed389e7c', 'lockout_duration', '"300"', 'number', 'Account lockout duration in seconds', false, NULL, '2025-07-30 08:47:53.937524+00', '2025-07-30 12:01:32.493256+00'),
	('0454c8e4-49bf-4102-b0f9-c726168dd98d', 'auto_reorder_enabled', 'false', 'boolean', 'Enable automatic reordering', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:33.687824+00'),
	('b6ec64a2-61d2-4e56-9ffd-a3b35df4c3f7', 'timezone', '"\"IST\""', 'string', 'Default timezone', true, NULL, '2025-07-30 08:47:50.788608+00', '2025-08-24 16:39:58.841206+00'),
	('c3cfc1d2-edfd-4918-97bb-20a9d4c2e0c0', 'credit_note_prefix', '"\"CN\""', 'string', 'Prefix for credit note numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:33.977327+00'),
	('4c870d7d-58ae-418b-b4d3-65f675dbc548', 'low_stock_threshold', '"10"', 'number', 'Default low stock threshold', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:33.984266+00'),
	('6855000d-ea72-421e-8e1c-1db5c5502fe6', 'company_phone', '"\"+91 9740517361\""', 'string', 'Company phone number', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-24 16:40:00.06122+00'),
	('a6fabf61-7791-4cd6-a549-f02cda360b75', 'purchase_order_prefix', '"\"PO\""', 'string', 'Prefix for purchase order numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:34.004475+00'),
	('3de86178-e07b-41cf-9abf-c2c0929868ea', 'company_country', '"\"India\""', 'string', 'Company country', false, NULL, '2025-07-30 08:47:48.859751+00', '2025-08-24 16:39:59.306903+00'),
	('adb7c975-7c70-479b-9421-6e6e827ae3f9', 'password_min_length', '"8"', 'number', 'Minimum password length', false, NULL, '2025-07-30 08:47:54.60999+00', '2025-07-30 11:59:33.808515+00'),
	('3b4a02ec-c376-49bb-b622-0f9f1ce85f4d', 'invoice_prefix', '"\"INV\""', 'string', 'Prefix for invoice numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 11:59:29.082952+00'),
	('00337ecb-bc68-4f75-92df-a23a45a22f56', 'session_timeout', '"3600"', 'number', 'Session timeout in seconds', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:34.920551+00'),
	('ffd4b9a3-185e-45df-8dea-3315ab57707a', 'company_zip', '"\"560037\""', 'string', 'Company zip/postal code', false, NULL, '2025-07-30 08:47:47.977938+00', '2025-08-24 16:40:00.094203+00'),
	('99f23be8-bccc-4403-8434-50d9ab6fabfb', 'tax_rate', '"0"', 'number', 'Default tax rate percentage', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-04 14:05:06.768939+00'),
	('f792362d-a19e-4121-b3a7-d2ca8f1f538f', 'grn_auto_numbering', 'true', 'boolean', 'Auto-generate GRN numbers', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-07-30 12:01:35.174807+00'),
	('e53eaa07-7556-4e10-8056-f40a1b5e888c', 'company_name', '"\"Sui Ikon Infotech \""', 'string', 'Company name for the warehouse management system', true, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-24 16:40:00.138751+00'),
	('8b220ee8-982d-42c1-99b1-b0318385547d', 'company_city', '"\"Bengaluru\""', 'string', 'Company city', false, NULL, '2025-07-30 08:47:46.720281+00', '2025-08-24 16:39:59.610509+00'),
	('e32f3da6-c280-4dcd-900e-d957d22afae5', 'enable_audit_log', 'true', 'boolean', 'Enable audit logging', false, NULL, '2025-07-30 08:47:56.542165+00', '2025-07-30 12:01:36.132661+00'),
	('00e7bbae-81cb-4cb9-b9c7-134b76a3227e', 'company_state', '"\"Karnataka\""', 'string', 'Company state/province', false, NULL, '2025-07-30 08:47:47.279447+00', '2025-08-24 16:39:59.6524+00'),
	('8d3b27f4-3181-4965-b9e0-26e5c8f333ef', 'language', '"\"en\""', 'string', 'Default language', true, NULL, '2025-07-30 08:47:51.511366+00', '2025-07-30 18:56:36.791019+00'),
	('c3ebf2fe-7cdb-41c1-b4d0-3073df94e18a', 'enable_remember_me', 'false', 'boolean', 'Enable remember me functionality', false, NULL, '2025-07-30 08:48:00.653248+00', '2025-08-04 14:05:07.901464+00'),
	('44c53178-6454-459a-ace4-f6fb4d34fec5', 'date_format', '"\"MM/DD/YYYY\""', 'string', 'Default date format for the system', true, NULL, '2025-07-30 08:47:49.483672+00', '2025-07-30 18:57:26.069196+00'),
	('13038866-ab2b-41b8-ad8e-952bd3356deb', 'require_email_verification', 'false', 'boolean', 'Require email verification for new users', false, NULL, '2025-07-30 08:47:52.745503+00', '2025-08-04 14:05:06.788813+00'),
	('fabea6cb-fa3e-498a-aea8-7ccc97d9caf0', 'company_email', '"\"contact@sunikon\""', 'string', 'Company email address', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-24 16:39:59.671906+00'),
	('dc1877a9-1e88-49e9-8181-4c150733206b', 'password_require_special', 'true', 'boolean', 'Require special characters in passwords', false, NULL, '2025-07-30 08:47:55.21656+00', '2025-07-30 11:59:34.197374+00'),
	('a7a51313-e5b3-457a-b878-6c0c882c4e81', 'company_address', '"\"NO.655, BHUVANESHWARI NAGAR, 7TH CROSS,5TH MAIN, BSK 3RD STAGE, \""', 'string', 'Company address for invoices and reports', false, NULL, '2025-07-30 07:52:15.797261+00', '2025-08-24 16:40:00.16378+00'),
	('07a4d19b-b0e0-48db-99f2-8b341b000ea5', 'enable_api_rate_limiting', 'true', 'boolean', 'Enable API rate limiting', false, NULL, '2025-07-30 08:47:57.87613+00', '2025-07-30 12:01:31.473663+00'),
	('443c4701-9c84-4e3b-9949-cc1a3404a693', 'enable_password_reset', 'false', 'boolean', 'Enable password reset functionality', false, NULL, '2025-07-30 08:48:01.286922+00', '2025-08-04 14:05:06.789506+00'),
	('ffd558f3-0dd0-4e53-9193-b668781ab522', 'enable_account_lockout', 'true', 'boolean', 'Enable account lockout after failed attempts', false, NULL, '2025-07-30 08:48:01.916767+00', '2025-07-30 12:01:36.102015+00'),
	('83d18d66-0ce8-4351-ad6f-0a81e75af951', 'invoice_number_reset', '"never"', 'string', 'Invoice number reset frequency: never, monthly, fiscal_year, annually', false, NULL, '2025-07-30 13:46:32.677626+00', '2025-07-30 13:46:32.677626+00'),
	('14125648-56e7-47be-a589-f34c25168d3a', 'default_invoice_notes', '"Thank you for your business"', 'string', 'Default notes to include on invoices', false, NULL, '2025-07-30 13:46:32.677626+00', '2025-07-30 13:46:32.677626+00'),
	('5e4ff5dd-da73-4621-ae1c-9da9c0dd139f', 'include_company_logo', 'true', 'boolean', 'Whether to include company logo on invoices', false, NULL, '2025-07-30 13:46:32.677626+00', '2025-07-30 13:46:32.677626+00'),
	('035058cc-081e-40d4-9b1d-e2e7a5c1cf98', 'rounding_method', '"\"down\""', 'string', 'Rounding method for calculations: no_rounding, nearest, up, down', true, NULL, '2025-07-30 13:46:32.677626+00', '2025-08-04 14:49:28.597611+00'),
	('e6e506f7-33b2-4a2e-b6b6-0638d03e1dbe', 'rounding_precision', '"\"0.50\""', 'string', 'Rounding precision: 0.01, 0.25, 0.50, 1.00', false, NULL, '2025-07-30 13:46:32.677626+00', '2025-08-04 15:39:47.144141+00'),
	('484bb51b-ae40-4840-9d94-1e4051b20559', 'invoice_format_template', '"\"custom_basic\""', 'string', 'Invoice template format: standard, custom_basic', false, NULL, '2025-07-30 13:46:32.677626+00', '2025-08-11 12:47:15.994871+00'),
	('ae13b6b3-69dd-40a9-9c72-696cab5e8fa3', 'company_logo_url', '"\"https://www.sunikon.com/wp-content/uploads/2024/03/WhatsApp-Image-2024-03-06-at-17.32.47-1-1.jpeg\""', 'string', 'Company logo', true, NULL, '2025-08-11 11:46:52.354015+00', '2025-08-24 08:17:54.640731+00');
INSERT INTO "public"."user_settings" ("id", "user_id", "dashboard_layout", "default_dashboard_widgets", "theme", "language", "timezone", "date_format", "currency", "currency_symbol", "default_warehouse_location", "low_stock_threshold_percentage", "enable_barcode_scanning", "auto_generate_sku", "sku_prefix", "default_payment_terms", "auto_create_grn", "require_po_approval", "default_tax_rate", "email_notifications", "low_stock_alerts", "order_status_notifications", "daily_report_email", "default_report_period", "include_tax_in_reports", "session_timeout_minutes", "require_password_change_days", "custom_settings", "created_at", "updated_at") VALUES
	('bc06da06-6445-4798-95db-a8b7c9044cbb', 'ad8dc9fd-e850-4906-9f14-6da34b0f5039', '{}', '{inventory_summary,recent_orders,low_stock_alerts}', 'system', 'en', 'UTC', 'YYYY-MM-DD', 'USD', '$', NULL, 20, true, true, 'SKU', '30 days', false, true, NULL, true, true, true, false, '30_days', true, 480, 90, '{}', '2025-07-26 08:26:12.620653+00', '2025-07-26 08:26:12.620653+00'),
	('3330acf8-8792-4adf-a34c-b2ea42c08af6', 'a407b702-099d-4507-9ac3-d8bd7b6d4cf3', '{}', '{inventory_summary,recent_orders,low_stock_alerts}', 'system', 'en', 'UTC', 'YYYY-MM-DD', 'USD', '$', NULL, 20, true, true, 'SKU', '30 days', false, true, NULL, true, true, true, false, '30_days', true, 480, 90, '{}', '2025-07-29 08:49:27.860142+00', '2025-07-29 08:49:27.860142+00'),
	('e11ddc15-6042-4a5e-a366-149bfaaf11f0', 'ccfbb242-0687-4aed-965a-cffe41824e0d', '{}', '{inventory_summary,recent_orders,low_stock_alerts}', 'system', 'en', 'UTC', 'YYYY-MM-DD', 'USD', '$', NULL, 20, true, true, 'SKU', '30 days', false, true, NULL, true, true, true, false, '30_days', true, 480, 90, '{}', '2025-07-29 12:45:25.632057+00', '2025-07-29 12:45:25.632057+00');

-- Summary: Found data for 13 table(s): categories, customers, locations, product_serials, products, profiles, roles, stock_levels, suppliers, system_settings, taxes, units, user_settings
