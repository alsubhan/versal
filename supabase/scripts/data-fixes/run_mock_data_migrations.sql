-- Combined Mock Data Migration Script
-- Run this in your Supabase SQL Editor to populate all tables with mock data

-- 1. Insert Sales Orders Mock Data
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
    
    RAISE NOTICE 'Sales orders inserted successfully';
END $$;

-- 2. Insert Purchase Orders Mock Data
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
    
    RAISE NOTICE 'Purchase orders inserted successfully';
END $$;

-- 3. Insert Sale Invoices Mock Data
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
        invoice_number,
        customer_id,
        invoice_date,
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
    ON CONFLICT (invoice_number) DO NOTHING;
    
    RAISE NOTICE 'Sale invoices inserted successfully';
END $$;

-- 4. Insert GRN Mock Data
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
    
    RAISE NOTICE 'GRNs inserted successfully';
END $$;

-- 5. Insert Credit Notes Mock Data
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
    
    -- Insert credit notes
    INSERT INTO public.credit_notes (
        credit_note_number,
        sales_order_id,
        customer_id,
        credit_date,
        reason,
        reason_description,
        status,
        approval_required,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        refund_method,
        refund_processed,
        affects_inventory,
        inventory_processed,
        notes,
        internal_notes,
        created_by
    ) VALUES
    (
        'CN-2024-001',
        NULL,
        customer1_id,
        CURRENT_DATE - INTERVAL '3 days',
        'return',
        'Customer returned damaged goods',
        'approved',
        true,
        500.00,
        90.00,
        0.00,
        590.00,
        'credit_account',
        true,
        true,
        true,
        'Credit note for returned damaged items',
        'Items were damaged during shipping',
        user_id
    ),
    (
        'CN-2024-002',
        NULL,
        customer2_id,
        CURRENT_DATE - INTERVAL '1 day',
        'billing_error',
        'Incorrect pricing applied',
        'pending',
        true,
        200.00,
        36.00,
        0.00,
        236.00,
        'credit_account',
        false,
        false,
        false,
        'Credit note for billing error correction',
        'Price was incorrectly calculated',
        user_id
    ),
    (
        'CN-2024-003',
        NULL,
        customer3_id,
        CURRENT_DATE - INTERVAL '5 days',
        'damage',
        'Products arrived damaged',
        'processed',
        true,
        300.00,
        54.00,
        0.00,
        354.00,
        'bank_transfer',
        true,
        true,
        true,
        'Credit note for damaged products',
        'Products were damaged in transit',
        user_id
    ),
    (
        'CN-2024-004',
        NULL,
        customer1_id,
        CURRENT_DATE,
        'discount',
        'Loyalty discount applied',
        'draft',
        false,
        150.00,
        27.00,
        0.00,
        177.00,
        'store_credit',
        false,
        false,
        false,
        'Credit note for loyalty discount',
        'Customer loyalty program discount',
        user_id
    ),
    (
        'CN-2024-005',
        NULL,
        customer2_id,
        CURRENT_DATE - INTERVAL '2 days',
        'cancellation',
        'Order cancelled by customer',
        'approved',
        true,
        400.00,
        72.00,
        0.00,
        472.00,
        'credit_account',
        false,
        true,
        false,
        'Credit note for cancelled order',
        'Customer cancelled order before shipping',
        user_id
    )
    ON CONFLICT (credit_note_number) DO NOTHING;
    
    RAISE NOTICE 'Credit notes inserted successfully';
END $$;

-- Success message
SELECT 'All mock data has been inserted successfully!' as status; 