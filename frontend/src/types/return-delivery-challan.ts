export interface ReturnDCItem {
    id: string;
    returnDcId: string;
    productId: string;
    productName: string;
    skuCode: string;
    deliveredQuantity: number;
    returnQuantity: number;
    receivedQuantity: number;
    reason?: string;
    condition: "good" | "damaged" | "defective" | "expired";
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ReturnDeliveryChallan {
    id: string;
    returnDcNumber: string;
    deliveryChallanId?: string;
    deliveryChallan?: { dcNumber: string; status: string };
    customerId?: string;
    customer?: { name: string; phone?: string };
    status: "draft" | "received" | "inspected" | "completed" | "cancelled";
    returnDate: string;
    receivedDate?: string;
    completedDate?: string;
    reason?: string;
    notes?: string;
    items: ReturnDCItem[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
