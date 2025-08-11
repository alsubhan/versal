-- Check sale_invoice_items table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sale_invoice_items' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if sale_invoice_items table exists and has data
SELECT 
    'sale_invoice_items' as table_name,
    COUNT(*) as record_count
FROM public.sale_invoice_items; 