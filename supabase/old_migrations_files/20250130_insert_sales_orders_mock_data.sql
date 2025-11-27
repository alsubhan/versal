-- Insert mock sales orders data
-- This will populate the sales_orders and sales_order_items tables with realistic data

-- First, let's get some customer and product IDs to reference
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
    
    -- Insert sales orders
    INSERT INTO public.sales_orders (
        order_number,
        customer_id,
        order_date,
        delivery_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        shipping_amount,
        total_amount,
        notes,
        created_by
    ) VALUES
    (
        'SO-2024-001',
        customer1_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '3 days',
        'sent',
        1500.00,
        270.00,
        75.00,
        50.00,
        1745.00,
        'Regular order for retail store',
        user_id
    ),
    (
        'SO-2024-002',
        customer2_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '7 days',
        'paid',
        2500.00,
        450.00,
        125.00,
        0.00,
        2825.00,
        'Wholesale order with bulk discount',
        user_id
    ),
    (
        'SO-2024-003',
        customer3_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '2 days',
        'overdue',
        800.00,
        144.00,
        40.00,
        25.00,
        929.00,
        'Online order - payment pending',
        user_id
    ),
    (
        'SO-2024-004',
        customer1_id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '5 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        30.00,
        1386.00,
        'Draft order for review',
        user_id
    ),
    (
        'SO-2024-005',
        customer2_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '1 day',
        'cancelled',
        1800.00,
        324.00,
        90.00,
        0.00,
        2034.00,
        'Cancelled due to stock unavailability',
        user_id
    )
    ON CONFLICT (order_number) DO NOTHING;
    
    -- Insert sales order items for SO-2024-001
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        500.00,
        25.00,
        90.00,
        1065.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        1,
        500.00,
        50.00,
        90.00,
        540.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-001' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-002
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-002' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-003
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        400.00,
        40.00,
        144.00,
        929.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-003' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-004
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1386.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-004' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-005
    INSERT INTO public.sales_order_items (
        sales_order_id,
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
        so.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        600.00,
        90.00,
        324.00,
        2034.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-005' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
END $$; 