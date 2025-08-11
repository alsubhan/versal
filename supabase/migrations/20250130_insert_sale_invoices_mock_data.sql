-- Insert mock sale invoices data
-- This will populate the sale_invoices and sale_invoice_items tables with realistic data

DO $$
DECLARE
    customer1_id UUID;
    customer2_id UUID;
    customer3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get customer IDs
    SELECT id INTO customer1_id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1;
    SELECT id INTO customer2_id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1;
    SELECT id INTO customer3_id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert sale invoices
    INSERT INTO public.sale_invoices (
        bill_number,
        customer_id,
        billing_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        created_by
    ) VALUES
    (
        'INV-2024-001',
        customer1_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '25 days',
        'paid',
        1500.00,
        270.00,
        75.00,
        1695.00,
        1695.00,
        0.00,
        'bank_transfer',
        'REF-001',
        CURRENT_DATE - INTERVAL '3 days',
        'Invoice for retail store order',
        user_id
    ),
    (
        'INV-2024-002',
        customer2_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '27 days',
        'sent',
        2500.00,
        450.00,
        125.00,
        2825.00,
        0.00,
        2825.00,
        NULL,
        NULL,
        NULL,
        'Wholesale invoice - payment pending',
        user_id
    ),
    (
        'INV-2024-003',
        customer3_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '5 days',
        'overdue',
        800.00,
        144.00,
        40.00,
        904.00,
        0.00,
        904.00,
        NULL,
        NULL,
        NULL,
        'Online order invoice - overdue',
        user_id
    ),
    (
        'INV-2024-004',
        customer1_id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '29 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        1356.00,
        0.00,
        1356.00,
        NULL,
        NULL,
        NULL,
        'Draft invoice for review',
        user_id
    ),
    (
        'INV-2024-005',
        customer2_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '23 days',
        'partial',
        1800.00,
        324.00,
        90.00,
        2034.00,
        1000.00,
        1034.00,
        'cash',
        'REF-002',
        CURRENT_DATE - INTERVAL '5 days',
        'Partial payment received',
        user_id
    )
    ON CONFLICT (bill_number) DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-001
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        750.00,
        75.00,
        270.00,
        1695.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-002
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-002' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-003
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        400.00,
        40.00,
        144.00,
        904.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-003' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-004
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1356.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-004' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-005
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        450.00,
        90.00,
        324.00,
        2034.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-005' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
END $$; 