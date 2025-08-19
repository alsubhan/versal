
import { type PurchaseOrder } from "./purchase-order";
import { type Supplier } from "./supplier";

export interface GoodsReceiveNoteItem {
  id: string;
  goodReceiveNoteId: string;
  purchaseOrderItemId?: string; // Reference to original purchase order item
  productId: string;
  productName: string;
  skuCode: string;
  hsnCode: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity?: number;
  acceptedQuantity?: number;
  unitCost: number;
  discount: number;
  tax: number;
  total: number;
  purchaseTaxType?: 'inclusive' | 'exclusive';
  unitAbbreviation?: string;
  serialNumbers?: string[];
  batchNumber?: string;
  expiryDate?: Date;
  manufacturingDate?: Date;
  qualityNotes?: string;
  storageLocation?: string;
  eanCode?: string;
  createdBy?: string;
}

export interface GoodsReceiveNote {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  supplierId: string;
  supplier?: Supplier;
  // In UI this will be shown as Invoice Date
  receivedDate: Date;
  // For Direct GRN mode only - expected delivery date for auto-generated PO
  deliveryDate?: Date;
  vendorInvoiceNumber?: string;
  receivedBy: string;
  receivedByUser?: any; // User profile data
  status: "draft" | "partial" | "completed" | "rejected";
  totalReceivedItems?: number;
  notes?: string;
  qualityCheckStatus?: string;
  warehouseLocation?: string;
  isDirect?: boolean; // Indicates if created directly or linked to purchase order
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  roundingAdjustment?: number;
  items: GoodsReceiveNoteItem[];
  createdAt: Date;
  updatedAt: Date;
}
