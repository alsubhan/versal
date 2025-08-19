
import { type Supplier } from "./supplier";

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  skuCode: string;
  hsnCode: string;
  quantity: number;
  costPrice: number;
  discount: number;
  tax: number;
  total: number;
  purchaseTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
  // Note: Serial numbers are not stored in Purchase Orders
  // They are created at GRN time and stored in product_serials table
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier?: Supplier;
  orderDate: Date;
  expectedDeliveryDate: Date;
  status: "draft" | "pending" | "approved" | "received" | "cancelled";
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAdjustment?: number;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}
