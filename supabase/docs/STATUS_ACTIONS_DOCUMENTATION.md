# **📋 Status-Based Action Permissions Documentation**

## **Overview**
This document defines the action permissions for each status across all modules in the Versal Inventory Management System. These permissions are enforced both at the frontend (UI level) and backend (API level) to ensure data integrity and proper workflow control.

---

## **🔄 Module Status Definitions**

### **Purchase Orders (`order_status`)**
- **draft** | **pending** | **approved** | **received** | **cancelled**

### **Goods Receive Notes (`grn_status`)**
- **draft** | **partial** | **completed** | **rejected**

### **Sale Orders (`invoice_status`)**
- **draft** | **sent** | **paid** | **overdue** | **cancelled**

### **Sale Invoices (`invoice_status`)**
- **draft** | **sent** | **paid** | **overdue** | **cancelled**

### **Credit Notes (`credit_note_status`)**
- **draft** | **pending** | **approved** | **processed** | **cancelled**

---

## **✅ Action Permissions Matrix**

| Module | Status | Edit | Delete | View | Print | Return |
|--------|--------|------|--------|------|-------|--------|
| **Purchase Orders** | draft | ✅ | ✅ | ❌ | ❌ | - |
| | pending | ✅ | ❌ | ❌ | ❌ | - |
| | approved | ❌ | ❌ | ✅ | ✅ | - |
| | received | ❌ | ❌ | ✅ | ✅ | - |
| | cancelled | ❌ | ❌ | ✅ | ✅ | - |
| **GRNs** | draft | ✅ | ✅ | ❌ | ❌ | - |
| | partial | ✅ | ❌ | ❌ | ❌ | - |
| | completed | ❌ | ❌ | ✅ | ✅ | ✅ |
| | rejected | ❌ | ❌ | ✅ | ✅ | - |
| **Sale Orders** | draft | ✅ | ✅ | ❌ | ❌ | - |
| | sent | ✅ | ❌ | ✅ | ✅ | - |
| | paid | ❌ | ❌ | ✅ | ✅ | - |
| | overdue | ❌ | ❌ | ✅ | ✅ | - |
| | cancelled | ❌ | ❌ | ✅ | ✅ | - |
| **Sale Invoices** | draft | ✅ | ✅ | ❌ | ❌ | - |
| | sent | ✅ | ❌ | ✅ | ✅ | - |
| | paid | ❌ | ❌ | ✅ | ✅ | ✅ |
| | overdue | ❌ | ❌ | ✅ | ✅ | - |
| | cancelled | ❌ | ❌ | ✅ | ✅ | - |
| **Credit Notes** | draft | ✅ | ✅ | ❌ | ❌ | - |
| | pending | ✅ | ❌ | ✅ | ✅ | - |
| | approved | ❌ | ❌ | ✅ | ✅ | - |
| | processed | ❌ | ❌ | ✅ | ✅ | - |
| | cancelled | ❌ | ❌ | ✅ | ✅ | - |

---

## **🔧 Implementation Details**

### **Frontend Implementation**
Action permissions are controlled in the respective table components:

#### **Purchase Order Table** (`PurchaseOrderTable.tsx`)
```typescript
// View and Print buttons
disabled={po.status === 'draft' || po.status === 'pending'}

// Edit button (handled by backend validation)
// Delete button (handled by backend validation)
```

#### **GRN Table** (`GRNTable.tsx`)
```typescript
// View and Print buttons
disabled={grn.status === 'draft' || grn.status === 'partial'}

// Edit button (handled by backend validation)
// Delete button (handled by backend validation)
```

#### **Sale Order Table** (`SaleOrderTable.tsx`)
```typescript
// View and Print buttons
disabled={order.status === 'draft'}

// Edit button
disabled={order.status === 'paid' || order.status === 'cancelled'}

// Delete button
disabled={order.status === 'sent' || order.status === 'paid' || order.status === 'overdue' || order.status === 'cancelled'}
```

#### **Sale Invoice Table** (`SalesInvoiceTable.tsx`)
```typescript
// View and Print buttons
disabled={invoice.status === 'draft'}

// Edit button
disabled={invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled'}

// Delete button
disabled={invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled'}

// Return button
disabled={invoice.status !== "paid"}
```

#### **Credit Note Table** (`CreditNoteTable.tsx`)
```typescript
// View and Print buttons
disabled={creditNote.status === 'draft'}

// Edit button
disabled={creditNote.status === 'approved' || creditNote.status === 'processed' || creditNote.status === 'cancelled'}

// Delete button
disabled={creditNote.status === 'pending' || creditNote.status === 'approved' || creditNote.status === 'processed' || creditNote.status === 'cancelled'}
```

### **Backend Implementation**
Status validation is enforced in the API endpoints through validation functions:

#### **Status Validation Functions** (`backend/main.py`)
```python
def validate_purchase_order_status_transition(current_status: str, operation: str = "edit"):
    """Validate Purchase Order status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and pending can be edited
        if current_status in ['approved', 'cancelled', 'received']:
            raise HTTPException(status_code=403, detail="...")
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['pending', 'approved', 'cancelled', 'received']:
            raise HTTPException(status_code=403, detail="...")

def validate_grn_status_transition(current_status: str, operation: str = "edit"):
    """Validate GRN status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and partial can be edited
        if current_status in ['completed', 'rejected']:
            raise HTTPException(status_code=403, detail="...")
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['partial', 'completed', 'rejected']:
            raise HTTPException(status_code=403, detail="...")

def validate_sales_order_status_transition(current_status: str, operation: str = "edit"):
    """Validate Sales Order status for edit/delete operations"""
    if operation == "edit":
        # For editing: draft, sent, and overdue can be edited
        if current_status in ['paid', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['sent', 'paid', 'overdue', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")

def validate_sale_invoice_status_transition(current_status: str, operation: str = "edit"):
    """Validate Sale Invoice status for edit/delete operations"""
    if operation == "edit":
        # For editing: draft and sent can be edited
        if current_status in ['paid', 'overdue', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['sent', 'paid', 'overdue', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")

def validate_credit_note_status_transition(current_status: str, operation: str = "edit"):
    """Validate Credit Note status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and pending can be edited
        if current_status in ['approved', 'processed', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['pending', 'approved', 'processed', 'cancelled']:
            raise HTTPException(status_code=403, detail="...")
```

---

## **🎯 Business Logic Rules**

### **General Principles**
1. **Edit Actions**: Allow editing in early workflow stages (draft, pending, sent)
2. **Delete Actions**: Only allow deletion in draft status to prevent data loss
3. **View/Print Actions**: Enable for all non-draft statuses for business operations
4. **Return Actions**: Only available for completed/paid documents

### **Status Transition Rules**
- **Draft** → Any status (initial state)
- **Pending** → Approved/Rejected/Cancelled (approval workflow)
- **Sent** → Paid/Overdue/Cancelled (customer response workflow)
- **Approved** → Completed/Processed (fulfillment)
- **Completed/Processed** → Final state (no further changes)

### **Inventory Impact**
- **Purchase Orders**: No direct inventory impact
- **GRNs**: Updates inventory when items received
- **Sale Orders**: Reserves inventory
- **Sale Invoices**: Decreases inventory when shipped
- **Credit Notes**: Restores inventory when items returned

---

## **🔒 Security Considerations**

### **Frontend vs Backend Validation**
- **Frontend**: Provides immediate user feedback and prevents unnecessary API calls
- **Backend**: Critical security layer that cannot be bypassed
- **Both**: Must be kept in sync to ensure consistent behavior

### **Permission Enforcement**
- All status validations are enforced at the API level
- Frontend UI reflects backend permissions
- No client-side bypass possible for critical operations

---

## **📝 Maintenance Notes**

### **Adding New Statuses**
1. Update the ENUM definition in the database
2. Update TypeScript types in `frontend/src/integrations/supabase/types.ts`
3. Update frontend table components with new status logic
4. Update backend validation functions
5. Test all workflows with new status

### **Modifying Action Permissions**
1. Update this documentation
2. Modify frontend table components
3. Update backend validation functions
4. Test all affected workflows
5. Update any related business logic

### **Testing Checklist**
- [ ] Frontend UI correctly disables/enables actions
- [ ] Backend API returns appropriate error messages
- [ ] Status transitions work correctly
- [ ] No security bypasses possible
- [ ] Business workflows remain intact

---

## **📞 Support Information**

For questions or issues related to status-based permissions:
1. Check this documentation first
2. Review the specific module's table component
3. Check the backend validation functions
4. Test the workflow manually
5. Contact the development team if issues persist

---

**Last Updated**: August 6, 2025  
**Version**: 1.0  
**Maintained By**: Development Team 