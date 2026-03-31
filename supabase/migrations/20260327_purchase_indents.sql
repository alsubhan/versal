-- Purchase Indents Migration (20260327_purchase_indents.sql)
BEGIN;

-- 1. Create Status Enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'indent_status') THEN
        CREATE TYPE public.indent_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'converted');
    END IF;
END $$;

-- 2. Create purchase_indents table
CREATE TABLE IF NOT EXISTS "public"."purchase_indents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "indent_number" "text" NOT NULL UNIQUE,
    "requester_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id"),
    "department" "text",
    "required_date" "date" NOT NULL DEFAULT CURRENT_DATE,
    "status" "public"."indent_status" DEFAULT 'draft'::"public"."indent_status" NOT NULL,
    "total_estimated_value" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."purchase_indents" OWNER TO "postgres";
ALTER TABLE "public"."purchase_indents" ENABLE ROW LEVEL SECURITY;

-- 3. Create purchase_indent_items table
CREATE TABLE IF NOT EXISTS "public"."purchase_indent_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "indent_id" "uuid" NOT NULL REFERENCES "public"."purchase_indents"("id") ON DELETE CASCADE,
    "product_id" "uuid" NOT NULL REFERENCES "public"."products"("id"),
    "quantity" integer NOT NULL DEFAULT 1,
    "estimated_unit_price" numeric(12,2) DEFAULT 0,
    "purchase_order_id" "uuid" REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchase_indent_items_quantity_check" CHECK (quantity > 0)
);

ALTER TABLE "public"."purchase_indent_items" OWNER TO "postgres";
ALTER TABLE "public"."purchase_indent_items" ENABLE ROW LEVEL SECURITY;

-- 4. Set up RLS Policies
CREATE POLICY "All authenticated users access" ON "public"."purchase_indents" TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "All authenticated users access" ON "public"."purchase_indent_items" TO "authenticated" USING (true) WITH CHECK (true);

-- 5. Set up Audit Triggers
CREATE TRIGGER update_purchase_indents_updated_at BEFORE UPDATE ON purchase_indents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_indent_items_updated_at BEFORE UPDATE ON purchase_indent_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
