-- Insert mock data for credit note items
-- Run this in Supabase SQL Editor

-- Insert credit note items for the credit notes we created
INSERT INTO public.credit_note_items (
  credit_note_id,
  product_id,
  credit_quantity,
  unit_price,
  discount,
  tax,
  returned_quantity,
  condition_on_return,
  return_to_stock,
  batch_number,
  quality_notes
) VALUES
-- Items for CN-0001 (Damaged goods return)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0001'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  2,
  900.00,
  0.00,
  90.00,
  2,
  'damaged',
  false,
  'BATCH-2024-001',
  'Items damaged during shipping - not returnable to stock'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0001'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  3,
  25.00,
  0.00,
  2.50,
  3,
  'damaged',
  false,
  'BATCH-2024-002',
  'Packaging damaged - items may be salvageable'
),

-- Items for CN-0002 (Wrong items shipped)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0002'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  1,
  120.00,
  10.00,
  11.00,
  1,
  'good',
  true,
  'BATCH-2024-003',
  'Wrong item shipped - returned in good condition'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0002'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  2,
  35.00,
  0.00,
  3.50,
  2,
  'good',
  true,
  'BATCH-2024-004',
  'Correct item - returned to stock'
),

-- Items for CN-0003 (Order cancellation)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0003'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  1,
  150.00,
  0.00,
  15.00,
  0,
  'good',
  false,
  'BATCH-2024-005',
  'Order cancelled before shipping - no physical return'
),

-- Items for CN-0004 (Quality issues)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0004'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  3,
  900.00,
  10.00,
  89.00,
  3,
  'defective',
  false,
  'BATCH-2024-006',
  'Quality control issues - batch recall'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0004'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  5,
  25.00,
  0.00,
  2.50,
  5,
  'defective',
  false,
  'BATCH-2024-007',
  'Defective batch - not returnable to stock'
),

-- Items for CN-0005 (Pricing error)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0005'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  1,
  35.00,
  7.00,
  2.80,
  0,
  'good',
  false,
  'BATCH-2024-008',
  'Pricing error - no physical return needed'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0005'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  1,
  120.00,
  0.00,
  12.00,
  0,
  'good',
  false,
  'BATCH-2024-009',
  'Pricing error correction'
)
ON CONFLICT DO NOTHING; 