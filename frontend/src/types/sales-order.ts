import { type Customer } from "./customer";

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
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
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  orderDate: Date;
  dueDate?: Date;
  status: "draft" | "pending" | "approved" | "sent" | "partial" | "fulfilled" | "overdue" | "cancelled";
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAdjustment?: number;
  notes?: string;
  items: SalesOrderItem[];
  createdAt: Date;
  updatedAt: Date;
} 