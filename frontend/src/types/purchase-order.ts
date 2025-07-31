
import { type Supplier } from "./supplier";

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  skuCode: string;
  quantity: number;
  costPrice: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: Supplier;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  status: "draft" | "pending" | "approved" | "received" | "cancelled";
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}
