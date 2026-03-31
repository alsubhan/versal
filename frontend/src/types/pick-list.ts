export interface PickListItem {
    id: string;
    pickListId: string;
    productId: string;
    productName: string;
    skuCode: string;
    quantity: number;
    pickedQuantity: number;
    locationId?: string;
    locationName?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PickList {
    id: string;
    pickListNumber: string;
    deliveryChallanId?: string;
    deliveryChallan?: { dcNumber: string; status: string };
    assignedTo?: string;
    assignedUser?: { fullName: string; username: string };
    status: "pending" | "in_progress" | "completed" | "cancelled";
    pickDate: string;
    completedDate?: string;
    notes?: string;
    items: PickListItem[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
