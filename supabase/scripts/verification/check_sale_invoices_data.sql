-- Check if sale_invoices table has data
SELECT 
    'sale_invoices' as table_name,
    COUNT(*) as record_count
FROM public.sale_invoices;

-- Check sample data from sale_invoices
SELECT 
    id,
    bill_number,
    customer_id,
    billing_date,
    status,
    total_amount
FROM public.sale_invoices 
LIMIT 5;

-- Check if customers table has data
SELECT 
    'customers' as table_name,
    COUNT(*) as record_count
FROM public.customers;

-- Check sample customers
SELECT 
    id,
    name,
    email
FROM public.customers 
LIMIT 5; 