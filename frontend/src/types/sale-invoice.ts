import { type Customer } from "./customer";
import { type SalesOrder } from "./sales-order";

export interface SaleInvoiceItem {
  id: string;
  saleInvoiceId: string;
  salesOrderItemId?: string; // Reference to original sales order item
  productId: string;
  productName: string;
  skuCode: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  saleTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
  serialNumbers?: string[];
  createdBy?: string;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  salesOrderId?: string;
  salesOrder?: SalesOrder;
  customerId: string;
  customer?: Customer;
  invoiceDate: Date;
  dueDate?: Date;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  paymentMethod?: "cash" | "bank_transfer" | "cheque" | "credit_card" | "online" | "credit" | "credit_note";
  paymentReference?: string;
  paymentDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid?: number;
  amountDue?: number;
  roundingAdjustment?: number;
  isDirect?: boolean; // Indicates if created directly or linked to sales order
  notes?: string;
  items: SaleInvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
} 