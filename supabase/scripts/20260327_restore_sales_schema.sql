-- Restore Sale Invoices and Sale Invoice Items (20260327_restore_sales_schema.sql)
BEGIN;

-- 1. Drop degraded tables (CASCADE to handle foreign key dependencies)
DROP TABLE IF EXISTS "public"."sale_invoice_items" CASCADE;
DROP TABLE IF EXISTS "public"."sale_invoices" CASCADE;

-- 2. Recreate sale_invoices from init.sql
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
    CONSTRAINT "sale_invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_invoices_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'cheque'::"text", 'credit_card'::"text", 'online'::"text", 'credit'::"text", 'credit_note'::"text"]))),
    CONSTRAINT "sale_invoices_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT "sale_invoices_sales_order_id_fkey" FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
    CONSTRAINT "sale_invoices_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id)
);

ALTER TABLE "public"."sale_invoices" OWNER TO "postgres";
ALTER TABLE "public"."sale_invoices" ENABLE ROW LEVEL SECURITY;

-- 3. Recreate sale_invoice_items from init.sql
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
    CONSTRAINT "sale_invoice_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_invoice_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sale_invoice_items_sale_tax_type_check" CHECK (("sale_tax_type" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "sale_invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE CASCADE,
    CONSTRAINT "sale_invoice_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT "sale_invoice_items_sales_order_item_id_fkey" FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE SET NULL
);

ALTER TABLE "public"."sale_invoice_items" OWNER TO "postgres";
ALTER TABLE "public"."sale_invoice_items" ENABLE ROW LEVEL SECURITY;

-- 4. Restore foreign key in delivery_challans
ALTER TABLE "public"."delivery_challans" 
ADD CONSTRAINT "delivery_challans_sale_invoice_id_fkey" 
FOREIGN KEY (sale_invoice_id) REFERENCES sale_invoices(id) ON DELETE SET NULL;

-- 5. Restore policies
CREATE POLICY "All authenticated users access" ON "public"."sale_invoices" USING (uid() IS NOT NULL);
CREATE POLICY "All authenticated users access" ON "public"."sale_invoice_items" USING (uid() IS NOT NULL);

-- 6. Restore triggers
CREATE TRIGGER update_sale_invoices_updated_at BEFORE UPDATE ON sale_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sale_invoice_items_updated_at BEFORE UPDATE ON sale_invoice_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
