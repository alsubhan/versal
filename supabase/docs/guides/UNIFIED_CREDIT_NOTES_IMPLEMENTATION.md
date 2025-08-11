# Unified Credit Notes Implementation

## Overview
This document outlines the implementation of **Option 2: Unified Credit Note Creation** where all credit notes must link to invoices for better traceability and audit trail.

## Changes Made

### 1. Database Schema Updates

#### Migration: `20250131_unified_credit_notes.sql`
- **Added `invoice_id` column** to `credit_notes` table with foreign key reference to `sale_invoices(id)`
- **Added `credit_note_type` enum** with values: `'invoice_linked'` and `'standalone'`
- **Added constraint** to ensure `invoice_linked` credit notes have `invoice_id`, `standalone` credit notes don't
- **Created index** on `invoice_id` for better performance
- **Migrated existing data** to maintain consistency

#### Migration: `20250131_credit_system_enhancements.sql`
- **Enhanced `handle_credit_note_approval()` function** to handle both credit note types
- **Created `handle_store_credit_usage()` function** for tracking credit consumption
- **Updated `handle_customer_credit_balance()` function** for proper balance management
- **Added triggers** for automatic credit transaction creation and balance updates

### 2. Frontend Type Updates

#### `frontend/src/types/credit-note.ts`
- **Added `invoiceId?: string`** field to `CreditNote` interface
- **Added `saleInvoice?: SaleInvoice`** relationship field
- **Added `creditNoteType: "invoice_linked" | "standalone"`** field
- **Updated imports** to include `SaleInvoice` type

### 3. Backend API Updates

#### `backend/main.py`
- **Updated `create_credit_note()` function** to handle `invoice_id` and `credit_note_type`
- **Updated `update_credit_note()` function** with same fields
- **Added validation** to ensure `invoice_id` is provided for `invoice_linked` credit notes
- **Updated `to_camel_case_credit_note()` function** to include new fields

### 4. Frontend Component Updates

#### `frontend/src/components/credit-notes/CreditNoteDialog.tsx`
- **Added `invoiceId` field** to form state
- **Added `creditNoteType` field** with default value `"invoice_linked"`
- **Added credit note type selector** (Invoice Linked vs Standalone)
- **Added invoice ID input field** (shown only for invoice_linked type)
- **Updated form validation** to require invoice_id for invoice_linked credit notes
- **Updated form initialization** to include new fields

#### `frontend/src/components/sale-invoices/SaleReturnDialog.tsx`
- **Updated credit note creation** to include `invoiceId: invoice.id`
- **Set `creditNoteType: "invoice_linked"`** for returns from specific invoices
- **Enhanced notes** to reference the specific invoice number

## Credit System Workflow

### 1. Credit Note Creation (Invoice-Linked)
```
User creates credit note → Links to specific invoice → 
Credit note approved → Credit transaction created (type: "credit_issued") → 
Customer credit balance increases
```

### 2. Credit Usage
```
Customer makes payment using store credit → 
Credit transaction created (type: "credit_used") → 
Customer credit balance decreases
```

### 3. Credit Balance Tracking
- **`customer_credit_balances.available_credit`**: Current usable credit
- **`customer_credit_balances.used_credit`**: Total credit consumed
- **`credit_transactions`**: Complete audit trail of all credit movements

## Database Tables Involved

### Primary Tables
1. **`credit_notes`** - Main credit note documents
2. **`credit_note_items`** - Individual items in credit notes
3. **`credit_transactions`** - Credit ledger for all movements
4. **`customer_credit_balances`** - Current credit balances per customer

### Related Tables
1. **`sale_invoices`** - Invoices that credit notes reference
2. **`customer_payments`** - Payments that may use store credit
3. **`customers`** - Customer information and credit limits

## Benefits of Unified System

### 1. **100% Traceability**
- Every credit note links to a business transaction
- Clear audit trail from invoice to credit

### 2. **Better Financial Reporting**
- Easier reconciliation between sales and credits
- Accurate tracking of credit issuance and usage

### 3. **Improved Customer Service**
- Clear connection between invoice and credit
- Better communication about why credits were issued

### 4. **Data Integrity**
- Prevents orphaned credits
- Consistent data structure across all credit notes

## Usage Examples

### Example 1: Return from Specific Invoice
```typescript
const creditNote: Partial<CreditNote> = {
  creditNoteNumber: "CN-2024-001",
  invoiceId: "invoice-uuid-123",
  customerId: "customer-uuid-456",
  creditNoteType: "invoice_linked",
  reason: "return",
  totalAmount: 150.00,
  // ... other fields
};
```

### Example 2: Standalone Credit (Promotional)
```typescript
const creditNote: Partial<CreditNote> = {
  creditNoteNumber: "CN-2024-002",
  customerId: "customer-uuid-456",
  creditNoteType: "standalone",
  reason: "promotional",
  totalAmount: 50.00,
  // ... other fields
};
```

## Migration Steps

### 1. Run Database Migrations
```sql
-- Run the migration files in order:
-- 1. 20250131_unified_credit_notes.sql
-- 2. 20250131_credit_system_enhancements.sql
```

### 2. Restart Backend
- Backend will automatically use new schema
- New validation rules will be enforced

### 3. Update Frontend
- Frontend will show new fields
- Form validation will require invoice_id for invoice_linked credit notes

## Testing Scenarios

### 1. **Invoice-Linked Credit Note Creation**
- ✅ Create credit note with valid invoice_id
- ❌ Create invoice_linked credit note without invoice_id (should fail)

### 2. **Credit Note Approval**
- ✅ Approve credit note → Credit transaction created → Balance increases
- ✅ Check credit_transactions table for "credit_issued" record

### 3. **Store Credit Usage**
- ✅ Make payment using store credit → Credit transaction created → Balance decreases
- ✅ Check credit_transactions table for "credit_used" record

### 4. **Return Processing**
- ✅ Process return from Sale Invoice → Credit note created with invoice_id
- ✅ Credit note automatically marked as invoice_linked

## Future Enhancements

### 1. **Invoice Selection UI**
- Add dropdown to select from customer's invoices
- Show invoice details (number, date, amount) for reference

### 2. **Credit Note Templates**
- Pre-fill credit note based on invoice items
- Automatic calculation of return amounts

### 3. **Credit Expiry Management**
- Add expiry dates to store credits
- Automatic credit expiration handling

### 4. **Credit Limit Integration**
- Connect store credit with customer credit limits
- Unified credit management dashboard

## Conclusion

The unified credit note system provides a robust foundation for credit management with:
- **Complete traceability** from invoice to credit
- **Automated credit transactions** and balance updates
- **Flexible credit note types** for different business scenarios
- **Enhanced audit trail** for financial reporting

This implementation ensures that all credits are properly linked to business transactions while maintaining the flexibility to handle standalone credits when needed.
