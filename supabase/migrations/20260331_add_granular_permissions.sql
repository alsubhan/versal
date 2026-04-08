-- Update roles to include new granular permissions based on existing ones
-- Indent Orders from Purchase Orders
UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements_text(permissions || 
    CASE WHEN permissions @> '["purchase_orders_view"]'::jsonb THEN '["purchase_indents_view"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["purchase_orders_create"]'::jsonb THEN '["purchase_indents_create"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["purchase_orders_edit"]'::jsonb THEN '["purchase_indents_edit"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["purchase_orders_delete"]'::jsonb THEN '["purchase_indents_delete"]'::jsonb ELSE '[]'::jsonb END
  ) AS p
)
WHERE permissions ? 'purchase_orders_view';

-- Quality Checks and Put Aways from GRN
UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements_text(permissions || 
    CASE WHEN permissions @> '["grn_view"]'::jsonb THEN '["quality_checks_view", "put_aways_view"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["grn_create"]'::jsonb THEN '["quality_checks_create", "put_aways_create"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["grn_edit"]'::jsonb THEN '["quality_checks_edit", "put_aways_edit"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["grn_delete"]'::jsonb THEN '["quality_checks_delete", "put_aways_delete"]'::jsonb ELSE '[]'::jsonb END
  ) AS p
)
WHERE permissions ? 'grn_view';

-- Delivery Challans, Pick Lists, and Return DCs from Sale Invoices
UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements_text(permissions || 
    CASE WHEN permissions @> '["sale_invoices_view"]'::jsonb THEN '["delivery_challans_view", "pick_lists_view", "return_delivery_challans_view"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_invoices_create"]'::jsonb THEN '["delivery_challans_create", "pick_lists_create", "return_delivery_challans_create"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_invoices_edit"]'::jsonb THEN '["delivery_challans_edit", "pick_lists_edit", "return_delivery_challans_edit"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_invoices_delete"]'::jsonb THEN '["delivery_challans_delete", "pick_lists_delete", "return_delivery_challans_delete"]'::jsonb ELSE '[]'::jsonb END
  ) AS p
)
WHERE permissions ? 'sale_invoices_view';

-- Sale Quotations from Sale Orders (Quotation is the first step in the sale flow)
UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements_text(permissions ||
    CASE WHEN permissions @> '["sale_orders_view"]'::jsonb   THEN '["sale_quotations_view"]'::jsonb   ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_orders_create"]'::jsonb THEN '["sale_quotations_create"]'::jsonb ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_orders_edit"]'::jsonb   THEN '["sale_quotations_edit"]'::jsonb   ELSE '[]'::jsonb END ||
    CASE WHEN permissions @> '["sale_orders_delete"]'::jsonb THEN '["sale_quotations_delete"]'::jsonb ELSE '[]'::jsonb END
  ) AS p
)
WHERE permissions ? 'sale_orders_view';
