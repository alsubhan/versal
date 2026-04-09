-- Migration: Fix missing shipping_address columns
-- This migration adds the missing shipping_address column to sales_orders and sale_invoices
-- to support the document-level address snapshotting system.

-- 1. Add column to sales_orders
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- 2. Add column to sale_invoices
ALTER TABLE public.sale_invoices 
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- 3. Backfill existing records from customers table (optional but recommended)
UPDATE public.sales_orders so
SET shipping_address = c.shipping_address
FROM public.customers c
WHERE so.customer_id = c.id AND so.shipping_address IS NULL;

UPDATE public.sale_invoices si
SET shipping_address = c.shipping_address
FROM public.customers c
WHERE si.customer_id = c.id AND si.shipping_address IS NULL;

-- 4. Verify quotations (already handled, but ensuring consistency)
ALTER TABLE public.sale_quotations 
ADD COLUMN IF NOT EXISTS billing_address JSONB,
ADD COLUMN IF NOT EXISTS shipping_address JSONB;
