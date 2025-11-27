-- Insert mock credit notes data
-- This will populate the credit_notes and credit_note_items tables with realistic data

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