-- Update existing GRN records with proper totals
-- This script calculates totals from items and updates the GRN records

-- First, let's see what we have
SELECT 
    grn.id,
    grn.grn_number,
    grn.total_amount,
    grn.subtotal,
    grn.tax_amount,
    grn.discount_amount,
    COUNT(items.id) as item_count,
    SUM(items.total) as items_total
FROM good_receive_notes grn
LEFT JOIN good_receive_note_items items ON grn.id = items.grn_id
GROUP BY grn.id, grn.grn_number, grn.total_amount, grn.subtotal, grn.tax_amount, grn.discount_amount
ORDER BY grn.created_at DESC;

-- Update GRN totals based on items
UPDATE good_receive_notes 
SET 
    subtotal = COALESCE(
        (SELECT SUM(received_quantity * unit_cost) 
         FROM good_receive_note_items 
         WHERE grn_id = good_receive_notes.id), 0
    ),
    discount_amount = COALESCE(
        (SELECT SUM(discount) 
         FROM good_receive_note_items 
         WHERE grn_id = good_receive_notes.id), 0
    ),
    tax_amount = COALESCE(
        (SELECT SUM(tax) 
         FROM good_receive_note_items 
         WHERE grn_id = good_receive_notes.id), 0
    ),
    total_amount = COALESCE(
        (SELECT SUM(total) 
         FROM good_receive_note_items 
         WHERE grn_id = good_receive_notes.id), 0
    )
WHERE id IN (
    SELECT DISTINCT grn_id 
    FROM good_receive_note_items 
    WHERE grn_id IS NOT NULL
);

-- Verify the updates
SELECT 
    grn.id,
    grn.grn_number,
    grn.total_amount,
    grn.subtotal,
    grn.tax_amount,
    grn.discount_amount,
    COUNT(items.id) as item_count,
    SUM(items.total) as items_total
FROM good_receive_notes grn
LEFT JOIN good_receive_note_items items ON grn.id = items.grn_id
GROUP BY grn.id, grn.grn_number, grn.total_amount, grn.subtotal, grn.tax_amount, grn.discount_amount
ORDER BY grn.created_at DESC; 