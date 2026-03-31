export interface PutAwayItem {
    id: string;
    putAwayId: string;
    qualityCheckItemId?: string;
    productId: string;
    productName: string;
    skuCode: string;
    quantity: number;
    placedQuantity: number;
    locationId?: string;
    locationName?: string;
    batchNumber?: string;
    expiryDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PutAway {
    id: string;
    putAwayNumber: string;
    qualityCheckId?: string;
    qualityCheck?: { qcNumber: string; status: string };
    grnId?: string;
    grn?: { grnNumber: string; status: string };
    assignedTo?: string;
    assignedUser?: { fullName?: string; username?: string };
    status: "pending" | "in_progress" | "completed" | "cancelled";
    putAwayDate: string;
    completedDate?: string;
    notes?: string;
    items: PutAwayItem[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
