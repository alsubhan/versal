# Credit Notes Schema Enhancement

## Overview
This document outlines the enhancement of the `credit_notes` and `credit_note_items` tables to include missing fields for better data integrity, performance, and business functionality.

## Current Schema vs Enhanced Schema

### Current Credit Notes Schema
```sql
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT CHECK (reason IN ('return', 'damage', 'billing_error', 'discount', 'cancellation', 'price_adjustment', 'other')) NOT NULL,
  reason_description TEXT,
  status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'processed', 'cancelled')) DEFAULT 'draft',
  approval_required BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.profiles(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  -- ❌ Missing: rounding_adjustment
  refund_method TEXT CHECK (refund_method IN ('cash', 'bank_transfer', 'credit_account', 'store_credit', 'exchange')) DEFAULT 'credit_account',
  refund_processed BOOLEAN DEFAULT false,
  refund_date DATE,
  refund_reference TEXT,
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Current Credit Note Items Schema
```sql
CREATE TABLE public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  original_quantity INTEGER,
  credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((credit_quantity * unit_price) - discount + tax) STORED,
  returned_quantity INTEGER DEFAULT 0,
  condition_on_return TEXT CHECK (condition_on_return IN ('good', 'damaged', 'defective', 'expired', 'incomplete')) DEFAULT 'good',
  return_to_stock BOOLEAN DEFAULT true,
  batch_number TEXT,
  expiry_date DATE,
  storage_location TEXT,
  quality_notes TEXT,
  -- ❌ Missing: product snapshot fields and created_by
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Enhanced Schema (After Migration)
```sql
-- Credit Notes Table (Enhanced)
CREATE TABLE public.credit_notes (
  -- Core fields (same as before)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT CHECK (reason IN ('return', 'damage', 'billing_error', 'discount', 'cancellation', 'price_adjustment', 'other')) NOT NULL,
  reason_description TEXT,
  status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'processed', 'cancelled')) DEFAULT 'draft',
  approval_required BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.profiles(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  
  -- Financial details (Enhanced)
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  rounding_adjustment DECIMAL(12,2) DEFAULT 0, -- ✅ ADDED
  
  -- Processing details (same as before)
  refund_method TEXT CHECK (refund_method IN ('cash', 'bank_transfer', 'credit_account', 'store_credit', 'exchange')) DEFAULT 'credit_account',
  refund_processed BOOLEAN DEFAULT false,
  refund_date DATE,
  refund_reference TEXT,
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Credit Note Items Table (Enhanced)
CREATE TABLE public.credit_note_items (
  -- Core fields (same as before)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  
  -- Quantities and pricing (same as before)
  original_quantity INTEGER,
  credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((credit_quantity * unit_price) - discount + tax) STORED,
  
  -- Return details (same as before)
  returned_quantity INTEGER DEFAULT 0,
  condition_on_return TEXT CHECK (condition_on_return IN ('good', 'damaged', 'defective', 'expired', 'incomplete')) DEFAULT 'good',
  return_to_stock BOOLEAN DEFAULT true,
  
  -- Quality and location (same as before)
  batch_number TEXT,
  expiry_date DATE,
  storage_location TEXT,
  quality_notes TEXT,
  
  -- Product Snapshot (NEW - for historical accuracy)
  product_name TEXT, -- ✅ ADDED
  sku_code TEXT, -- ✅ ADDED
  hsn_code TEXT, -- ✅ ADDED
  sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive', -- ✅ ADDED
  unit_abbreviation TEXT, -- ✅ ADDED
  
  -- Audit Trail (NEW)
  created_by UUID REFERENCES public.profiles(id), -- ✅ ADDED
  
  -- Timestamps (same as before)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## New Fields Added

### 1. Credit Notes Table
| Field | Type | Purpose |
|-------|------|---------|
| `rounding_adjustment` | DECIMAL(12,2) | Rounding adjustment applied to total amount |

### 2. Credit Note Items Table
| Field | Type | Purpose |
|-------|------|---------|
| `product_name` | TEXT | Product name at time of credit note |
| `sku_code` | TEXT | Product SKU at time of credit note |
| `hsn_code` | TEXT | Product HSN code at time of credit note |
| `sale_tax_type` | TEXT | Tax type (inclusive/exclusive) at credit note |
| `unit_abbreviation` | TEXT | Unit abbreviation at time of credit note |
| `created_by` | UUID | User who created the credit note item |

## Benefits of This Enhancement

### 1. Data Integrity & Historical Accuracy
- **Problem**: Product details may change between original sale and credit note
- **Solution**: Store product snapshot at credit note time
- **Benefit**: Credit note records show accurate historical information

### 2. Performance Optimization
- **Problem**: Joining with products table for every query
- **Solution**: Direct access to product information
- **Benefit**: Faster queries, especially for reporting

### 3. Business Flexibility
- **Problem**: Credit note pricing may differ from original sale pricing
- **Solution**: Separate pricing fields for credit note-specific adjustments
- **Benefit**: Handle price changes, promotions, discounts

### 4. Audit Trail & Compliance
- **Requirement**: Complete audit trail for compliance
- **Solution**: Product snapshot + audit fields
- **Benefit**: Immutable records for regulatory requirements

### 5. Rounding Support
- **Benefit**: Consistent rounding adjustment support across all modules
- **Use Case**: Currency rounding requirements, precision handling

### 6. Offline Capability
- **Benefit**: Credit note data accessible without product table connectivity
- **Use Case**: Mobile apps, offline operations

## Migration Strategy

### 1. Run the Migration
```sql
-- Execute the enhance_credit_notes_schema.sql file
```

### 2. Update Application Code
- Update TypeScript interfaces (already done)
- Modify credit note creation logic to populate new fields
- Update reporting queries to use new fields

### 3. Data Population Strategy
For existing credit note items, populate the new fields from the products table:
```sql
UPDATE public.credit_note_items 
SET 
  product_name = p.name,
  sku_code = p.sku_code,
  hsn_code = p.hsn_code,
  sale_tax_type = p.sale_tax_type,
  unit_abbreviation = u.abbreviation
FROM public.products p
LEFT JOIN public.units u ON p.unit_id = u.id
WHERE credit_note_items.product_id = p.id;
```

## TypeScript Interface Update

The TypeScript interfaces are already updated and include all the new fields:

```typescript
export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string;
  productName: string; // ✅ Already present
  skuCode: string; // ✅ Already present
  hsnCode: string; // ✅ Already present
  quantity: number;
  creditQuantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  saleTaxType?: 'inclusive' | 'exclusive'; // ✅ Already present
  unitAbbreviation?: string; // ✅ Already present
  createdBy?: string; // ✅ Already present
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  // ... other fields
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAdjustment?: number; // ✅ Already present
  // ... other fields
}
```

## Best Practices

### 1. Data Population
- Always populate product snapshot fields when creating credit note items
- Use current product data as the source
- Consider this a "snapshot" of product state at credit note time

### 2. Query Optimization
- Use product snapshot fields for reporting instead of joining with products table
- Keep product_id for current data lookups when needed
- Index frequently queried fields

### 3. Data Validation
- Ensure product snapshot fields are populated
- Validate that pricing calculations are correct
- Maintain referential integrity with product_id

### 4. Business Logic
- Handle price changes between original sale and credit note
- Support promotions and discounts at credit note time
- Manage tax rate changes

## Comparison with Other Tables

### Consistent Pattern:
- **Purchase Order Items**: ✅ Has product snapshot + rounding
- **Sales Order Items**: ✅ Has product snapshot + rounding
- **GRN Items**: ✅ Has product snapshot + rounding
- **Sale Invoice Items**: ✅ Has product snapshot + rounding
- **Credit Note Items**: ✅ Will have product snapshot + rounding (after migration)

## Conclusion

This enhancement provides a robust, performant, and compliant credit note system that:
- ✅ Maintains historical accuracy
- ✅ Improves query performance
- ✅ Supports business flexibility
- ✅ Ensures audit trail compliance
- ✅ Enables offline operations
- ✅ Provides consistent rounding support

The combination of product reference (`product_id`) and product snapshot fields creates the optimal balance between data integrity and performance, following the same pattern established in other tables throughout the system. 