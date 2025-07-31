
import { PurchaseOrder } from "./purchase-order";

export interface GoodsReceiveNoteItem {
  id: string;
  grnId: string;
  purchaseOrderItemId?: string;
  productId: string;
  productName: string;
  skuCode: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  total: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoodsReceiveNote {
  id: string;
  grnNumber: string;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;
  receivedDate: Date;
  status: "pending" | "completed" | "partial" | "cancelled";
  receivedBy: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  items: GoodsReceiveNoteItem[];
  createdAt: Date;
  updatedAt: Date;
}
