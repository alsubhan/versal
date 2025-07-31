
import { type Customer } from "./customer";

export interface WholesaleOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  skuCode: string;
  eanCode?: string;
  quantity: number;
  unitPrice: number;
  mrpPrice?: number;
  wholesalePrice?: number;
  discount: number;
  tax: number;
  sgst?: number;
  cgst?: number;
  warehouseRack?: string;
  serialNumbers?: string[];
  expiryDate?: Date;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WholesaleOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: Customer;
  orderDate: Date;
  deliveryDate?: Date;
  status: "draft" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned" | "exchanged" | "partially_returned";
  subtotal: number;
  taxAmount: number;
  sgstAmount?: number;
  cgstAmount?: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  overridePrice?: boolean;
  notes?: string;
  items: WholesaleOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}
