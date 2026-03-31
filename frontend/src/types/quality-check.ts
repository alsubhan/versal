import { type GoodsReceiveNote } from "./grn";

export interface QualityCheckItem {
  id: string;
  qcId: string;
  grnItemId: string;
  productId: string;
  productName: string;
  skuCode: string;
  receivedQuantity: number;
  inspectedQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  failureReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityCheck {
  id: string;
  qcNumber: string;
  grnId: string;
  grn?: GoodsReceiveNote;
  inspectorId: string;
  inspectorName?: string;
  qcDate: Date;
  status: "pending" | "in_progress" | "passed" | "failed" | "partial";
  notes?: string;
  createdBy: string;
  items: QualityCheckItem[];
  createdAt: Date;
  updatedAt: Date;
}
