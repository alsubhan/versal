export interface DeliveryChallanItem {
    id: string;
    deliveryChallanId: string;
    productId: string;
    productName: string;
    skuCode: string;
    quantity: number;
    dispatchedQuantity: number;
    unitPrice: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DeliveryChallan {
    id: string;
    dcNumber: string;
    saleInvoiceId?: string;
    saleInvoice?: { invoiceNumber: string; status: string };
    salesOrderId?: string;
    salesOrder?: { orderNumber: string; status: string };
    customerId?: string;
    customer?: { name: string; phone?: string; address?: string };
    status: "draft" | "dispatched" | "delivered" | "invoiced" | "returned" | "partial_return" | "cancelled";
    dcDate: string;
    dispatchDate?: string;
    deliveryDate?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    deliveryAddress?: string;
    isStandalone: boolean;
    notes?: string;
    items: DeliveryChallanItem[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
