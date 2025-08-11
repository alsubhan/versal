-- Verification Script for Mock Data
-- Run this after running the mock data migration to verify the data was inserted correctly

-- Check if customers exist
SELECT 'Customers' as table_name, COUNT(*) as count FROM public.customers;

-- Check if suppliers exist
SELECT 'Suppliers' as table_name, COUNT(*) as count FROM public.suppliers;

-- Check if products exist
SELECT 'Products' as table_name, COUNT(*) as count FROM public.products;

-- Check if profiles exist
SELECT 'Profiles' as table_name, COUNT(*) as count FROM public.profiles;

-- Check sales orders
SELECT 'Sales Orders' as table_name, COUNT(*) as count FROM public.sales_orders;
SELECT 
    order_number,
    customer_id,
    order_date,
    status,
    total_amount
FROM public.sales_orders 
ORDER BY order_date DESC;

-- Check purchase orders
SELECT 'Purchase Orders' as table_name, COUNT(*) as count FROM public.purchase_orders;
SELECT 
    order_number,
    supplier_id,
    order_date,
    status,
    total_amount
FROM public.purchase_orders 
ORDER BY order_date DESC;

-- Check sale invoices
SELECT 'Sale Invoices' as table_name, COUNT(*) as count FROM public.sale_invoices;
SELECT 
    bill_number,
    customer_id,
    billing_date,
    due_date,
    status,
    total_amount
FROM public.sale_invoices 
ORDER BY billing_date DESC;

-- Check GRNs
SELECT 'GRNs' as table_name, COUNT(*) as count FROM public.good_receive_notes;
SELECT 
    grn_number,
    purchase_order_id,
    received_date,
    status,
    total_amount
FROM public.good_receive_notes 
ORDER BY received_date DESC;

-- Check customer names for sale invoices
SELECT 
    si.bill_number,
    c.name as customer_name,
    si.billing_date,
    si.status,
    si.total_amount
FROM public.sale_invoices si
LEFT JOIN public.customers c ON si.customer_id = c.id
ORDER BY si.billing_date DESC;

-- Check supplier names for purchase orders
SELECT 
    po.order_number,
    s.name as supplier_name,
    po.order_date,
    po.status,
    po.total_amount
FROM public.purchase_orders po
LEFT JOIN public.suppliers s ON po.supplier_id = s.id
ORDER BY po.order_date DESC; 