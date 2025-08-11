-- Corrected Sale Invoices Migration
-- This script uses the actual database schema column names

DO $$
DECLARE
    customer1_id UUID;
    customer2_id UUID;
    customer3_id UUID;
    customer4_id UUID;
    customer5_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
    invoice1_id UUID;
    invoice2_id UUID;
    invoice3_id UUID;
    invoice4_id UUID;
    invoice5_id UUID;
BEGIN
    -- Get customer IDs
    SELECT id INTO customer1_id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1;
    SELECT id INTO customer2_id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1;
    SELECT id INTO customer3_id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1;
    SELECT id INTO customer4_id FROM public.customers WHERE name = 'Bulk Buyers Ltd' LIMIT 1;
    SELECT id INTO customer5_id FROM public.customers WHERE name = 'Local Market Chain' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert sale invoices using correct schema column names
    INSERT INTO public.sale_invoices (
        invoice_number,
        customer_id,
        invoice_date,
        due_date,
        status,
        payment_method,
        payment_reference,
        payment_date,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        notes,
        affects_inventory,
        inventory_processed,
        created_by
    ) VALUES
    (
        'INV-2024-001',
        customer1_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '30 days',
        'paid',
        'bank_transfer',
        'REF-001',
        CURRENT_DATE - INTERVAL '3 days',
        1500.00,
        270.00,
        0.00,
        1770.00,
        1770.00,
        0.00,
        'Wholesale order for electronics',
        true,
        true,
        user_id
    ),
    (
        'INV-2024-002',
        customer2_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '15 days',
        'pending',
        'credit_card',
        'REF-002',
        NULL,
        800.00,
        144.00,
        50.00,
        894.00,
        0.00,
        894.00,
        'Retail store order',
        true,
        false,
        user_id
    ),
    (
        'INV-2024-003',
        customer3_id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '7 days',
        'pending',
        'online',
        'REF-003',
        NULL,
        1200.00,
        216.00,
        0.00,
        1416.00,
        0.00,
        1416.00,
        'Online order for home delivery',
        true,
        false,
        user_id
    ),
    (
        'INV-2024-004',
        customer4_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '45 days',
        'draft',
        'cheque',
        'REF-004',
        NULL,
        2500.00,
        450.00,
        200.00,
        2750.00,
        0.00,
        2750.00,
        'Bulk order for corporate client',
        true,
        false,
        user_id
    ),
    (
        'INV-2024-005',
        customer5_id,
        CURRENT_DATE - INTERVAL '2 days',
        CURRENT_DATE + INTERVAL '20 days',
        'overdue',
        'cash',
        'REF-005',
        NULL,
        600.00,
        108.00,
        0.00,
        708.00,
        0.00,
        708.00,
        'Local market chain order',
        true,
        false,
        user_id
    )
    ON CONFLICT (invoice_number) DO NOTHING;
    
    -- Get the inserted invoice IDs
    SELECT id INTO invoice1_id FROM public.sale_invoices WHERE invoice_number = 'INV-2024-001';
    SELECT id INTO invoice2_id FROM public.sale_invoices WHERE invoice_number = 'INV-2024-002';
    SELECT id INTO invoice3_id FROM public.sale_invoices WHERE invoice_number = 'INV-2024-003';
    SELECT id INTO invoice4_id FROM public.sale_invoices WHERE invoice_number = 'INV-2024-004';
    SELECT id INTO invoice5_id FROM public.sale_invoices WHERE invoice_number = 'INV-2024-005';
    
    -- Insert sale invoice items (if the table exists)
    -- Note: You may need to adjust column names based on your actual sale_invoice_items schema
    BEGIN
        INSERT INTO public.sale_invoice_items (
            sale_invoice_id,
            product_id,
            quantity,
            unit_price,
            discount,
            tax,
            total
        ) VALUES
        -- Invoice 1 items
        (invoice1_id, product1_id, 10, 150.00, 0.00, 27.00, 1770.00),
        -- Invoice 2 items
        (invoice2_id, product2_id, 5, 160.00, 50.00, 19.80, 894.00),
        -- Invoice 3 items
        (invoice3_id, product3_id, 8, 150.00, 0.00, 21.60, 1416.00),
        -- Invoice 4 items
        (invoice4_id, product4_id, 15, 166.67, 200.00, 45.00, 2750.00),
        -- Invoice 5 items
        (invoice5_id, product5_id, 4, 150.00, 0.00, 10.80, 708.00)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Sale invoice items inserted successfully';
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE 'sale_invoice_items table does not exist, skipping items insertion';
    END;
    
    RAISE NOTICE 'Sale invoices inserted successfully';
    RAISE NOTICE 'Invoice 1 ID: %', invoice1_id;
    RAISE NOTICE 'Invoice 2 ID: %', invoice2_id;
    RAISE NOTICE 'Invoice 3 ID: %', invoice3_id;
    RAISE NOTICE 'Invoice 4 ID: %', invoice4_id;
    RAISE NOTICE 'Invoice 5 ID: %', invoice5_id;
END $$; 