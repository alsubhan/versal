# GRN Items Schema Enhancement

## Overview
This document outlines the enhancement of the `good_receive_note_items` table to include product snapshot columns and additional pricing fields for better data integrity, performance, and business functionality.

## Current Schema vs Enhanced Schema

### Current Schema
```sql
CREATE TABLE public.good_receive_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES public.good_receive_notes(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  product_id uuid REFERENCES public.products(id) NOT NULL,
  ordered_quantity integer NOT NULL,
  received_quantity integer NOT NULL CHECK (received_quantity >= 0),
  rejected_quantity integer DEFAULT 0 CHECK (rejected_quantity >= 0),
  accepted_quantity integer GENERATED ALWAYS AS (received_quantity - rejected_quantity) STORED,
  unit_cost numeric(12,2) NOT NULL,
  batch_number text,
  expiry_date date,
  manufacturing_date date,
  quality_notes text,
  storage_location text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_quantities CHECK (received_quantity >= rejected_quantity)
);
```

### Enhanced Schema (After Migration)
```sql
CREATE TABLE public.good_receive_note_items (
  -- Core GRN fields
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES public.good_receive_notes(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  product_id uuid REFERENCES public.products(id) NOT NULL,
  
  -- Quantities
  ordered_quantity integer NOT NULL,
  received_quantity integer NOT NULL CHECK (received_quantity >= 0),
  rejected_quantity integer DEFAULT 0 CHECK (rejected_quantity >= 0),
  accepted_quantity integer GENERATED ALWAYS AS (received_quantity - rejected_quantity) STORED,
  
  -- Pricing (Enhanced)
  unit_cost numeric(12,2) NOT NULL,
  discount decimal(12,2) DEFAULT 0,
  tax decimal(12,2) DEFAULT 0,
  total decimal(12,2) GENERATED ALWAYS AS ((accepted_quantity * unit_cost) - discount + tax) STORED,
  
  -- Quality & Storage
  batch_number text,
  expiry_date date,
  manufacturing_date date,
  quality_notes text,
  storage_location text,
  
  -- Product Snapshot (NEW - for historical accuracy)
  product_name text,
  sku_code text,
  hsn_code text,
  purchase_tax_type text CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
  unit_abbreviation text,
  
  -- Audit Trail
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_quantities CHECK (received_quantity >= rejected_quantity)
);
```

## New Fields Added

### 1. Product Snapshot Fields
| Field | Type | Purpose |
|-------|------|---------|
| `product_name` | TEXT | Product name at time of receipt |
| `sku_code` | TEXT | Product SKU at time of receipt |
| `hsn_code` | TEXT | Product HSN code at time of receipt |
| `purchase_tax_type` | TEXT | Tax type (inclusive/exclusive) at receipt |
| `unit_abbreviation` | TEXT | Unit abbreviation at time of receipt |

### 2. Enhanced Pricing Fields
| Field | Type | Purpose |
|-------|------|---------|
| `discount` | DECIMAL(12,2) | Discount applied during receipt |
| `tax` | DECIMAL(12,2) | Tax amount for this receipt item |
| `total` | DECIMAL(12,2) | Calculated total (accepted_quantity * unit_cost - discount + tax) |

### 3. Audit Trail
| Field | Type | Purpose |
|-------|------|---------|
| `created_by` | UUID | User who created the GRN item |

## Benefits of This Enhancement

### 1. Data Integrity & Historical Accuracy
- **Problem**: Product details may change over time
- **Solution**: Store product snapshot at receipt time
- **Benefit**: GRN records show accurate historical information

### 2. Performance Optimization
- **Problem**: Joining with products table for every query
- **Solution**: Direct access to product information
- **Benefit**: Faster queries, especially for reporting

### 3. Business Flexibility
- **Problem**: Receipt pricing may differ from PO pricing
- **Solution**: Separate pricing fields for receipt-specific adjustments
- **Benefit**: Handle supplier discounts, tax changes, etc.

### 4. Audit Trail & Compliance
- **Requirement**: Complete audit trail for compliance
- **Solution**: Product snapshot + audit fields
- **Benefit**: Immutable records for regulatory requirements

### 5. Offline Capability
- **Benefit**: GRN data accessible without product table connectivity
- **Use Case**: Warehouse operations, mobile apps

## Migration Strategy

### 1. Run the Migration
```sql
-- Execute the enhance_grn_items_schema.sql file
```

### 2. Update Application Code
- Update TypeScript interfaces
- Modify GRN creation/update logic to populate new fields
- Update reporting queries to use new fields

### 3. Data Population Strategy
For existing GRN items, populate the new fields from the products table:
```sql
UPDATE public.good_receive_note_items 
SET 
  product_name = p.name,
  sku_code = p.sku_code,
  hsn_code = p.hsn_code,
  purchase_tax_type = p.purchase_tax_type,
  unit_abbreviation = u.abbreviation
FROM public.products p
LEFT JOIN public.units u ON p.unit_id = u.id
WHERE good_receive_note_items.product_id = p.id;
```

## TypeScript Interface Update

```typescript
export interface GoodsReceiveNoteItem {
  id: string;
  grnId: string;
  purchaseOrderItemId?: string;
  productId: string;
  
  // Product Snapshot
  productName: string;
  skuCode: string;
  hsnCode: string;
  purchaseTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
  
  // Quantities
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  
  // Pricing
  unitCost: number;
  discount: number;
  tax: number;
  total: number;
  
  // Quality & Storage
  batchNumber?: string;
  expiryDate?: Date;
  manufacturingDate?: Date;
  qualityNotes?: string;
  storageLocation?: string;
  
  // Audit
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Best Practices

### 1. Data Population
- Always populate product snapshot fields when creating GRN items
- Use current product data as the source
- Consider this a "snapshot" of product state at receipt time

### 2. Query Optimization
- Use product snapshot fields for reporting instead of joining with products table
- Keep product_id for current data lookups when needed
- Index frequently queried fields

### 3. Data Validation
- Ensure product snapshot fields are populated
- Validate that pricing calculations are correct
- Maintain referential integrity with product_id

## Conclusion

This enhancement provides a robust, performant, and compliant GRN system that:
- ✅ Maintains historical accuracy
- ✅ Improves query performance
- ✅ Supports business flexibility
- ✅ Ensures audit trail compliance
- ✅ Enables offline operations

The combination of product reference (`product_id`) and product snapshot fields creates the optimal balance between data integrity and performance. 