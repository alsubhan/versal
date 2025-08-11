-- Insert mock GRN data
-- This will populate the good_receive_notes and good_receive_note_items tables with realistic data

DO $$
DECLARE
    po1_id UUID;
    po2_id UUID;
    po3_id UUID;
    supplier1_id UUID;
    supplier2_id UUID;
    supplier3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get purchase order IDs
    SELECT id INTO po1_id FROM public.purchase_orders WHERE order_number = 'PO-2024-001' LIMIT 1;
    SELECT id INTO po2_id FROM public.purchase_orders WHERE order_number = 'PO-2024-002' LIMIT 1;
    SELECT id INTO po3_id FROM public.purchase_orders WHERE order_number = 'PO-2024-004' LIMIT 1;
    
    -- Get supplier IDs
    SELECT id INTO supplier1_id FROM public.suppliers WHERE name = 'Tech Solutions Inc.' LIMIT 1;
    SELECT id INTO supplier2_id FROM public.suppliers WHERE name = 'Global Manufacturing Co.' LIMIT 1;
    SELECT id INTO supplier3_id FROM public.suppliers WHERE name = 'Quality Parts Ltd.' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert GRNs
    INSERT INTO public.good_receive_notes (
        grn_number,
        purchase_order_id,
        supplier_id,
        received_date,
        received_by,
        status,
        total_received_items,
        notes,
        quality_check_status,
        warehouse_location,
        subtotal,
        tax_amount,
        total_amount,
        created_by
    ) VALUES
    (
        'GRN-2024-001',
        po1_id,
        supplier1_id,
        CURRENT_DATE - INTERVAL '2 days',
        user_id,
        'completed',
        4,
        'Tech supplies received in good condition',
        'passed',
        'Main Warehouse',
        2000.00,
        360.00,
        2360.00,
        user_id
    ),
    (
        'GRN-2024-002',
        po2_id,
        supplier2_id,
        CURRENT_DATE - INTERVAL '1 day',
        user_id,
        'partial',
        3,
        'Partial delivery - remaining items pending',
        'partial',
        'Secondary Storage',
        1500.00,
        270.00,
        1770.00,
        user_id
    ),
    (
        'GRN-2024-003',
        po3_id,
        supplier1_id,
        CURRENT_DATE - INTERVAL '5 days',
        user_id,
        'completed',
        4,
        'Quality parts received and inspected',
        'passed',
        'Main Warehouse',
        1800.00,
        324.00,
        2124.00,
        user_id
    ),
    (
        'GRN-2024-004',
        po1_id,
        supplier3_id,
        CURRENT_DATE,
        user_id,
        'draft',
        2,
        'Draft GRN for review',
        'pending',
        'Store Front',
        800.00,
        144.00,
        944.00,
        user_id
    ),
    (
        'GRN-2024-005',
        po2_id,
        supplier2_id,
        CURRENT_DATE - INTERVAL '3 days',
        user_id,
        'rejected',
        1,
        'Rejected due to quality issues',
        'failed',
        'Main Warehouse',
        500.00,
        90.00,
        590.00,
        user_id
    )
    ON CONFLICT (grn_number) DO NOTHING;
    
    -- Insert GRN items for GRN-2024-001
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product1_id,
        4,
        4,
        0,
        500.00,
        'BATCH-001',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '6 months',
        'All items passed quality check',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-001'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-002
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product2_id,
        7,
        3,
        0,
        500.00,
        'BATCH-002',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '3 months',
        'Partial delivery - remaining 4 items pending',
        'Secondary Storage'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-002'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-003
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product3_id,
        4,
        4,
        0,
        450.00,
        'BATCH-003',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '4 months',
        'All items passed quality check',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-003'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-004
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product4_id,
        2,
        2,
        0,
        400.00,
        'BATCH-004',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '2 months',
        'Draft GRN - pending approval',
        'Store Front'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-004'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-005
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product5_id,
        1,
        1,
        1,
        500.00,
        'BATCH-005',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '1 month',
        'Item rejected due to quality issues',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-005'
    ON CONFLICT DO NOTHING;
    
END $$; 