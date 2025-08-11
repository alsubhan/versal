
import { type Customer } from "./customer";
import { type SalesOrder } from "./sales-order";
import { type SaleInvoice } from "./sale-invoice";

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string;
  productName: string;
  skuCode: string;
  hsnCode: string;
  quantity: number;
  creditQuantity: number; // Add this field for compatibility
  originalQuantity?: number; // Store original invoice quantity for validation
  unitPrice: number;
  discount: number;
  originalDiscount?: number; // Store original invoice discount for validation
  tax: number;
  total: number;
  reason?: string; // Add this field for compatibility
  saleTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  salesOrderId?: string;
  salesOrder?: SalesOrder;
  invoiceId?: string; // NEW: Reference to sale invoice
  saleInvoice?: SaleInvoice; // NEW: Sale invoice details
  customerId: string;
  customer?: Customer;
  creditDate: Date;
  reason: "return" | "damage" | "billing_error" | "discount" | "cancellation" | "price_adjustment" | "other";
  reasonDescription?: string;
  status: "draft" | "pending" | "approved" | "processed" | "cancelled";
  approvalRequired: boolean;
  approvedBy?: string;
  approvedByUser?: any;
  approvedDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAdjustment?: number;
  refundMethod: "cash" | "bank_transfer" | "credit_account" | "store_credit" | "exchange";
  refundProcessed: boolean;
  refundDate?: Date;
  refundReference?: string;
  affectsInventory: boolean;
  inventoryProcessed: boolean;
  creditNoteType: "invoice_linked" | "standalone"; // NEW: Type of credit note
  notes?: string;
  internalNotes?: string;
  items: CreditNoteItem[];
  createdAt: Date;
  updatedAt: Date;
}
