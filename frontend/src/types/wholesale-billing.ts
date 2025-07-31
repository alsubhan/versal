
import { type Customer } from "./customer";
import { type WholesaleOrder } from "./wholesale-order";

export interface WholesaleBillingItem {
  id: string;
  billId: string;
  orderItemId?: string;
  productId: string;
  productName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  returnedQuantity?: number;
  exchangedQuantity?: number;
  customReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WholesaleBill {
  id: string;
  billNumber: string;
  wholesaleOrderId?: string;
  wholesaleOrder?: WholesaleOrder;
  customerId: string;
  customer: Customer;
  billingDate: Date;
  dueDate: Date;
  status: "draft" | "pending" | "paid" | "overdue" | "cancelled";
  paymentMethod?: "cash" | "bank_transfer" | "cheque" | "credit_card" | "online" | "credit" | "credit_note";
  paymentReference?: string;
  paymentDate?: Date;
  creditNoteId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  notes?: string;
  items: WholesaleBillingItem[];
  createdAt: Date;
  updatedAt: Date;
}
