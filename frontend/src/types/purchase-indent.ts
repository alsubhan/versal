import { type Profile } from "./profile";
import { type Product } from "./inventory";

export type PurchaseIndentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'converted';

export interface PurchaseIndentItem {
  id: string;
  indentId: string;
  productId: string;
  productName?: string;
  skuCode?: string;
  quantity: number;
  estimatedUnitPrice: number;
  purchaseOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
}

export interface PurchaseIndent {
  id: string;
  indentNumber: string;
  requesterId: string;
  requester?: Profile;
  department?: string;
  requiredDate: string;
  status: PurchaseIndentStatus;
  totalEstimatedValue: number;
  notes?: string;
  items: PurchaseIndentItem[];
  createdAt: Date;
  updatedAt: Date;
}
