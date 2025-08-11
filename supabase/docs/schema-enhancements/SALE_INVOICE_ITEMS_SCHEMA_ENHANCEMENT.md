# Sale Invoice Items Schema Enhancement

## Overview
This document outlines the enhancement of the `sale_invoice_items` table to include product snapshot columns and additional audit fields for better data integrity, performance, and business functionality.

## Current Schema vs Enhanced Schema

### Current Schema
```sql
CREATE TABLE public.sale_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### Enhanced Schema (After Migration)
```sql
CREATE TABLE public.sale_invoice_items (
  -- Core Invoice fields
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  
  -- Reference to Original Order (Optional)
  sales_order_item_id uuid REFERENCES public.sales_order_items(id),
  
  -- Quantities and Pricing
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  
  -- Product Snapshot (NEW - for historical accuracy)
  product_name text,
  sku_code text,
  hsn_code text,
  sale_tax_type text CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
  unit_abbreviation text,
  
  -- Audit Trail
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## New Fields Added

### 1. Reference to Original Order
| Field | Type | Purpose |
|-------|------|---------|
| `sales_order_item_id` | UUID | Reference to original sales order item |

### 2. Product Snapshot Fields
| Field | Type | Purpose |
|-------|------|---------|
| `product_name` | TEXT | Product name at time of invoice |
| `sku_code` | TEXT | Product SKU at time of invoice |
| `hsn_code` | TEXT | Product HSN code at time of invoice |
| `sale_tax_type` | TEXT | Tax type (inclusive/exclusive) at invoice |
| `unit_abbreviation` | TEXT | Unit abbreviation at time of invoice |

### 3. Audit Trail
| Field | Type | Purpose |
|-------|------|---------|
| `created_by` | UUID | User who created the invoice item |

## Benefits of This Enhancement

### 1. Data Integrity & Historical Accuracy
- **Problem**: Product details may change between order and invoice
- **Solution**: Store product snapshot at invoice time
- **Benefit**: Invoice records show accurate historical information

### 2. Performance Optimization
- **Problem**: Joining with products table for every query
- **Solution**: Direct access to product information
- **Benefit**: Faster queries, especially for reporting

### 3. Business Flexibility
- **Problem**: Invoice pricing may differ from order pricing
- **Solution**: Separate pricing fields for invoice-specific adjustments
- **Benefit**: Handle price changes, promotions, discounts

### 4. Audit Trail & Compliance
- **Requirement**: Complete audit trail for compliance
- **Solution**: Product snapshot + audit fields
- **Benefit**: Immutable records for regulatory requirements

### 5. Offline Capability
- **Benefit**: Invoice data accessible without product table connectivity
- **Use Case**: Mobile apps, offline operations

## Relationship with Sales Orders

### Key Differences:
1. **Sales Order**: Intent to sell (can be modified)
2. **Sales Invoice**: Actual sale (immutable record)

### Why Product Snapshot is Important:
- **Price Changes**: Invoice price may differ from order price
- **Product Updates**: Product details may change between order and invoice
- **Tax Changes**: Tax rates may change
- **Promotions**: Additional discounts may apply at invoice time

## Migration Strategy

### 1. Run the Migration
```sql
-- Execute the enhance_sale_invoice_items_schema.sql file
```

### 2. Update Application Code
- Update TypeScript interfaces
- Modify invoice creation logic to populate new fields
- Update reporting queries to use new fields

### 3. Data Population Strategy
For existing invoice items, populate the new fields from the products table:
```sql
UPDATE public.sale_invoice_items 
SET 
  product_name = p.name,
  sku_code = p.sku_code,
  hsn_code = p.hsn_code,
  sale_tax_type = p.sale_tax_type,
  unit_abbreviation = u.abbreviation
FROM public.products p
LEFT JOIN public.units u ON p.unit_id = u.id
WHERE sale_invoice_items.product_id = p.id;
```

## TypeScript Interface Update

```typescript
export interface SaleInvoiceItem {
  id: string;
  salesInvoiceId: string;
  salesOrderItemId?: string; // Reference to original sales order item
  productId: string;
  
  // Product Snapshot
  productName: string;
  skuCode: string;
  hsnCode: string;
  saleTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
  
  // Quantities and Pricing
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  
  // Audit
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Best Practices

### 1. Data Population
- Always populate product snapshot fields when creating invoice items
- Use current product data as the source
- Consider this a "snapshot" of product state at invoice time

### 2. Query Optimization
- Use product snapshot fields for reporting instead of joining with products table
- Keep product_id for current data lookups when needed
- Index frequently queried fields

### 3. Data Validation
- Ensure product snapshot fields are populated
- Validate that pricing calculations are correct
- Maintain referential integrity with product_id

### 4. Business Logic
- Handle price changes between order and invoice
- Support promotions and discounts at invoice time
- Manage tax rate changes

## Comparison with Other Tables

### Consistent Pattern:
- **Purchase Order Items**: ✅ Has product snapshot
- **Sales Order Items**: ✅ Has product snapshot  
- **GRN Items**: ✅ Has product snapshot
- **Credit Note Items**: ✅ Has product snapshot
- **Sale Invoice Items**: ✅ Will have product snapshot (after migration)

## Conclusion

This enhancement provides a robust, performant, and compliant sale invoice system that:
- ✅ Maintains historical accuracy
- ✅ Improves query performance
- ✅ Supports business flexibility
- ✅ Ensures audit trail compliance
- ✅ Enables offline operations

The combination of product reference (`product_id`) and product snapshot fields creates the optimal balance between data integrity and performance, following the same pattern established in other tables throughout the system. 