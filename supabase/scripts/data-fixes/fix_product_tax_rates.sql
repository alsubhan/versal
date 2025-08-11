-- Fix Product Tax Rates
-- This script creates the correct tax rates and updates products to use them

-- First, let's see what tax rates currently exist
SELECT id, name, rate, is_default FROM public.taxes;

-- Create the correct tax rates (5% GST and 18% GST)
INSERT INTO public.taxes (name, rate, is_default, applied_to, description) VALUES
('GST 5%', 0.0500, false, 'products', '5% GST for exclusive tax products'),
('GST 18%', 0.1800, false, 'products', '18% GST for inclusive tax products')
ON CONFLICT (name) DO NOTHING;

-- Get the tax IDs
DO $$
DECLARE
    gst_5_id UUID;
    gst_18_id UUID;
BEGIN
    -- Get the tax IDs
    SELECT id INTO gst_5_id FROM public.taxes WHERE name = 'GST 5%';
    SELECT id INTO gst_18_id FROM public.taxes WHERE name = 'GST 18%';
    
    -- Update products to use the correct tax rates
    -- Cotton T-Shirt (PRD002) should use 5% GST (exclusive)
    UPDATE public.products 
    SET purchase_tax_id = gst_5_id,
        purchase_tax_type = 'exclusive'
    WHERE sku_code = 'PRD002';
    
    -- Premium Wireless Headphones (PRD001) should use 18% GST (inclusive)
    UPDATE public.products 
    SET purchase_tax_id = gst_18_id,
        purchase_tax_type = 'inclusive'
    WHERE sku_code = 'PRD001';
    
    -- Update any other products that don't have tax rates set
    UPDATE public.products 
    SET purchase_tax_id = gst_5_id,
        purchase_tax_type = 'exclusive'
    WHERE purchase_tax_id IS NULL;
    
    RAISE NOTICE 'Updated products with tax rates: GST 5%% for PRD002, GST 18%% for PRD001';
END $$;

-- Verify the updates
SELECT 
    p.sku_code,
    p.name,
    p.purchase_tax_type,
    t.name as tax_name,
    t.rate as tax_rate
FROM public.products p
LEFT JOIN public.taxes t ON p.purchase_tax_id = t.id
WHERE p.sku_code IN ('PRD001', 'PRD002')
ORDER BY p.sku_code; 