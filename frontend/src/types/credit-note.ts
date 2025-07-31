
import { type Customer } from "./customer";

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string;
  salesOrderItemId?: string;
  originalQuantity?: number;
  creditQuantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  returnedQuantity: number;
  conditionOnReturn: 'good' | 'damaged' | 'defective' | 'expired' | 'incomplete';
  returnToStock: boolean;
  batchNumber?: string;
  expiryDate?: Date;
  storageLocation?: string;
  qualityNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName?: string;
  creditDate: Date;
  reason: 'return' | 'damage' | 'billing_error' | 'discount' | 'cancellation' | 'price_adjustment' | 'other';
  reasonDescription?: string;
  status: 'draft' | 'pending' | 'approved' | 'processed' | 'cancelled';
  approvalRequired: boolean;
  approvedBy?: string;
  approvedDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  refundMethod: 'cash' | 'bank_transfer' | 'credit_account' | 'store_credit' | 'exchange';
  refundProcessed: boolean;
  refundDate?: Date;
  refundReference?: string;
  affectsInventory: boolean;
  inventoryProcessed: boolean;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  items?: CreditNoteItem[];
}
