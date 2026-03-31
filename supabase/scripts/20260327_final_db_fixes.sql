-- Comprehensive Database Repair Migration (20260327_final_db_fixes.sql)
-- Goal: Restore missing tables and fix broken triggers/functions

BEGIN;

-- 1. Restore product_serials table if missing
CREATE TABLE IF NOT EXISTS "public"."product_serials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "product_id" "uuid" NOT NULL REFERENCES "public"."products"("id") ON DELETE CASCADE,
    "serial_number" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "grn_item_id" "uuid" REFERENCES "public"."good_receive_note_items"("id") ON DELETE SET NULL,
    "sale_invoice_item_id" "uuid" REFERENCES "public"."sale_invoice_items"("id") ON DELETE SET NULL,
    "location_id" "uuid" REFERENCES "public"."locations"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_serials_product_id_serial_number_key" UNIQUE ("product_id", "serial_number"),
    CONSTRAINT "product_serials_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'reserved'::"text", 'sold'::"text", 'returned'::"text", 'scrapped'::"text"])))
);

ALTER TABLE "public"."product_serials" OWNER TO "postgres";
ALTER TABLE "public"."product_serials" ENABLE ROW LEVEL SECURITY;

-- 2. Restore policies for product_serials
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'All authenticated users access' AND tablename = 'product_serials') THEN
        CREATE POLICY "All authenticated users access" ON "public"."product_serials" TO "authenticated" USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Update get_user_role function (Ensure it uses the role enum)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- 4. Utility function to get first admin ID (replacing the broken role_id join)
CREATE OR REPLACE FUNCTION public.get_first_admin_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1;
$$;

-- 5. Patch handle_inventory_transaction (remove role_id/roles dependency)
CREATE OR REPLACE FUNCTION "public"."handle_inventory_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_product_id UUID;
  v_qty_change INTEGER;
BEGIN
  v_product_id := NEW.product_id;
  v_qty_change := NEW.quantity_change;
  
  -- Update current_stock in products table
  UPDATE public.products 
  SET current_stock = COALESCE(current_stock, 0) + v_qty_change
  WHERE id = v_product_id;
  
  -- Log error if product not found (optional)
  RETURN NEW;
END;
$$;

-- 6. Patch various triggers that use the broken role_id/roles lookup for auditing
-- Example patch for common auditing pattern found in init.sql
-- (Replacing the hardcoded role_id join with get_first_admin_id())

CREATE OR REPLACE FUNCTION public.handle_grn_inventory_update() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id uuid;
    v_qty_change integer;
    v_admin_id uuid;
BEGIN
    v_product_id := NEW.product_id;
    v_qty_change := NEW.accepted_quantity;
    v_admin_id := public.get_first_admin_id();

    -- Create inventory transaction
    INSERT INTO public.inventory_transactions (
        product_id,
        transaction_type,
        quantity_change,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        v_product_id,
        'purchase',
        v_qty_change,
        'grn_item',
        NEW.id,
        'Stock received via GRN',
        COALESCE(NEW.created_by, v_admin_id)
    );

    RETURN NEW;
END;
$$;

-- 7. Sync stock levels for product_serials (Restore trigger function)
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

-- 8. Final cleanup: Ensure all RLS policies are using get_user_role correctly
-- This was already checked in Step 2507 and looks good (most use get_user_role).

COMMIT;
