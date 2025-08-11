## Transactions Workflow

This document describes the end-to-end process flows across purchasing, receiving, sales, invoicing, payments, returns, credit notes, and the credit ledgers.

### Contents
- Purchase Order (PO)
- GRN and GRN Return
- Sales Order (SO)
- Sale Invoice, Payments, and Sale Return
- Credit Note, Customer Credit Balances, and Credit Transaction Ledger
- Cross‑cutting Policies, Endpoints, and Data Consistency

---

## Purchase Order (PO)

### Purpose
Commit to purchase goods from a supplier; drives inbound receiving (GRN).

### Statuses
- draft → sent/approved → partially_received → received/closed → cancelled

### Core fields
- supplier, expected_date, currency/terms
- items: productId, orderedQty, unitCost, tax, discount

### Workflow
1. Create PO in draft; edit items and terms.
2. Approve/send PO to supplier; locks price/qty.
3. Receive goods using GRN(s):
   - Any receipt < ordered → PO becomes partially_received.
   - All lines fully received (± tolerance) → PO becomes received/closed.
4. Cancelling a PO disallows new receipts.

### Validations
- Supplier is active.
- Items exist; units/taxes valid.
- Received quantity cannot exceed remaining (unless policy allows).

### Integration
- PO → GRN (1:N). Remaining = ordered − received.
- Prices default from PO to GRN lines.

---

## GRN (Goods Receipt Note) and GRN Return

### Purpose
Confirm quantities/costs received (GRN) and process supplier returns (GRN Return).

### GRN Workflow
1. Create GRN against a PO (preferred) or standalone.
2. Capture lines: receivedQuantity, unitCost, tax, batch/lot if applicable.
3. On process/post:
   - Inventory increases via `inventory_transactions` (type: receipt).
   - GRN status: draft → received/posted → cancelled (reversal if needed).
   - If linked to PO, updates PO received quantities and status.

### GRN Return Workflow
1. Initialize return lines from GRN lines with `returnQuantity: 0`.
2. User sets per-line returnQty (capped at original `receivedQuantity`) and per-line returnReason; optional general reason.
3. Validate at least one line has `returnQuantity > 0`.
4. On process:
   - Inventory decreases via `inventory_transactions` (type: supplier_return).
   - Optional AP credit/debit memo if accounting layer exists.

### Calculations
- Line return total = `returnQuantity × unitCost`.
- Return total = sum of line totals.

### Constraints
- Cannot return more than received.
- Only received/posted GRNs are returnable.

---

## Sales Order (SO)

### Purpose
Reserve/commit to sell to a customer; drives fulfillment and invoicing.

### Statuses
- draft → partial → fulfilled → cancelled

### Workflow
1. Create SO (customer, items, prices, taxes).
2. Pick/ship and/or invoice against SO:
   - When any invoice is raised → SO becomes partial.
   - When fully invoiced/shipped → SO becomes fulfilled.
3. Editing allowed in draft/partial; blocked in fulfilled/cancelled.

### Integration
- SO → Sale Invoice (1:N).
- Trigger/function `update_sales_order_status_from_invoice` keeps SO status in sync with related invoice status.

---

## Sale Invoice, Payments, and Sale Return

### Purpose
Bill the customer; manage receivables and payments.

### Statuses
- draft → sent → partial → paid → overdue → cancelled

### Creation and Credit Limit (Wholesale/Distributor)
- Default `payment_method = "credit"` for wholesale/distributor customers.
- Credit limit validation via `check_customer_credit_limit(customer_id, invoice_total)`:
  - Uses customer `credit_limit` and outstanding exposure (`customers.current_credit`).
  - Blocks creation if insufficient limit.
- Initialize `amountPaid = 0`, `amountDue = totalAmount`.

### Customer Payments
- `customer_payments` table with methods: cash, bank_transfer, store_credit, etc.
- Triggers/functions:
  - `update_invoice_payment_amounts`: maintains `amount_paid` and `amount_due` on invoices.
  - `update_invoice_status_from_payments`: sets status based on paid/due.
  - `handle_store_credit_usage` (AFTER INSERT when `payment_method='store_credit'`):
    - Creates `credit_transactions` row with `transaction_type='credit_used'` linked to `sale_invoice_id`.
    - Validates `customer_credit_balances.available_credit` (raises if insufficient).
  - `update_customer_current_credit`: maintains `customers.current_credit` as sum of outstanding credit invoices.

### Overdue Handling
- Periodic endpoint/report for `/sale-invoices/overdue` to surface late receivables.

### Sale Return
- Initiated from a processed/paid invoice.
- UI: user selects items (capped by original invoiced quantities) and reason.
- Creates an invoice‑linked Credit Note (see below). Inventory increases if items return to stock.

---

## Credit Note, Customer Credit Balances, and Credit Transaction Ledger

### Purpose
Issue credits for returns/adjustments and manage customer store credit.

### Schema (high level)
- `credit_notes`: `credit_note_number`, `customer_id`, `invoice_id`, `credit_note_type` (invoice_linked | standalone), amounts, status.
- `credit_note_items`: product, quantity, unitPrice, discount, tax, total, tax type.
- `customer_credit_balances`: `total_credit_balance`, `available_credit`, `used_credit`.
- `credit_transactions`: `customer_id`, `sale_invoice_id`, `amount`, `transaction_type` (`credit_issued` | `credit_used`), description, timestamps.

### Unified Model (Option 2)
- Operationally all credit notes are invoice‑linked in the UI; standalone exists for schema completeness.
- Constraint ensures `invoice_linked` notes have `invoice_id`.

### Lifecycle
- draft → pending/approved → processed → cancelled

### Issuance (Store Credit)
- On approval when `refund_method = 'store_credit'`:
  - `handle_credit_note_approval` inserts `credit_transactions` with `transaction_type='credit_issued'` (optionally includes invoice number in description).
  - `handle_customer_credit_balance` increases `total_credit_balance` and `available_credit`.

### Consumption (Store Credit Payment)
- When paying an invoice using `store_credit`:
  - `handle_store_credit_usage` inserts `credit_transactions` with `transaction_type='credit_used'` linked to `sale_invoice_id`.
  - `handle_customer_credit_balance` decreases `available_credit` and increases `used_credit`.

### Inventory Effects
- For invoice‑linked returns that affect inventory, credit note processing increases stock.

### UI Rules
- Invoice‑linked:
  - Items auto‑load from selected invoice.
  - Quantity capped by original invoice quantity; unit price/discount/tax read‑only; totals auto‑calculated.
- Standalone (if enabled): items can be added/edited manually.

---

## Cross‑cutting Policies, Endpoints, and Data Consistency

### Key Endpoints (illustrative)
- Sale invoices: GET/POST/PUT `/sale-invoices`, GET `/sale-invoices/overdue`, GET `/customers/{id}/invoices`
- Customer payments: GET/POST/PUT/DELETE `/customer-payments`, GET/POST `/sale-invoices/{id}/payments`
- Credit notes: GET/POST/PUT/DELETE `/credit-notes`, items subroutes
- Credit balances: GET `/customers/{id}/credit-balance`

### Triggers/Functions (highlights)
- `check_customer_credit_limit`
- `update_invoice_payment_amounts`, `update_invoice_status_from_payments`
- `update_sales_order_status_from_invoice`
- `update_customer_current_credit`
- `handle_store_credit_usage`
- `handle_credit_note_approval`, `handle_customer_credit_balance`

### Enums and Constraints
- `invoice_status` includes `partial`.
- `so_status` includes `partial`, `fulfilled`.
- Credit notes with `invoice_linked` must have `invoice_id`.
- `credit_transactions` reference `sale_invoice_id` (not sales order).

### Security (RLS)
- Apply row‑level security by tenant/store/user; ensure triggers run with appropriate roles.

### Dashboards
- Overdue invoices list.
- Customer credit balance widget (total/available/used).

### Operational Guardrails
- Prevent invoice creation if credit limit exceeded for wholesale/distributor.
- Prevent store credit payment when `available_credit` is insufficient.
- Prevent return quantities beyond source quantities (GRN/invoice).

### Typical Flows
- PO → GRN(s) → Inventory up → GRN Return (if needed) → Inventory down.
- SO → Invoice(s) → Payments (cash/bank/credit/store_credit) → Status updates → Overdue handling.
- Invoice‑linked return → Credit Note approved → credit_issued → customer spends via store_credit on another invoice → credit_used.


