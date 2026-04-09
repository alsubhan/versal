import { type Customer } from "./customer";

export interface SaleQuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  productName: string;
  skuCode: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  saleTaxType?: "inclusive" | "exclusive";
  unitAbbreviation?: string;
  total: number;
}

export interface SaleQuotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customer?: Customer;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  quotationDate: Date;
  validUntil?: Date;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAdjustment?: number;
  gstType?: "CGST_SGST" | "IGST";
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  notes?: string;
  termsConditions?: string;
  salesOrderId?: string; // set after conversion to SO
  items: SaleQuotationItem[];
  createdAt: Date;
  updatedAt: Date;
}
