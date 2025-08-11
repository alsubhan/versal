-- Insert mock purchase orders data
-- This will populate the purchase_orders and purchase_order_items tables with realistic data

DO $$
DECLARE
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
    
    -- Insert purchase orders
    INSERT INTO public.purchase_orders (
        order_number,
        supplier_id,
        order_date,
        expected_delivery_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        notes,
        created_by
    ) VALUES
    (
        'PO-2024-001',
        supplier1_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '5 days',
        'pending',
        2000.00,
        360.00,
        100.00,
        2260.00,
        'Regular tech supplies order',
        user_id
    ),
    (
        'PO-2024-002',
        supplier2_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '3 days',
        'approved',
        3500.00,
        630.00,
        175.00,
        3955.00,
        'Manufacturing materials order',
        user_id
    ),
    (
        'PO-2024-003',
        supplier3_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '7 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        1356.00,
        'Quality parts order - draft',
        user_id
    ),
    (
        'PO-2024-004',
        supplier1_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '2 days',
        'received',
        1800.00,
        324.00,
        90.00,
        2034.00,
        'Completed order - received',
        user_id
    ),
    (
        'PO-2024-005',
        supplier2_id,
        CURRENT_DATE - INTERVAL '15 days',
        CURRENT_DATE - INTERVAL '5 days',
        'cancelled',
        2500.00,
        450.00,
        125.00,
        2825.00,
        'Cancelled due to supplier issues',
        user_id
    )
    ON CONFLICT (order_number) DO NOTHING;
    
    -- Insert purchase order items for PO-2024-001
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        500.00,
        100.00,
        360.00,
        2260.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-002
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        7,
        500.00,
        175.00,
        630.00,
        3955.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-002' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-003
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1356.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-003' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-004
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        450.00,
        90.00,
        324.00,
        2034.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-004' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-005
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-005' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
END $$; 