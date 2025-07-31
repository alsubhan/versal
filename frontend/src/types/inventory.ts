
export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  skuCode: string;
  type: "purchase" | "sale" | "adjustment" | "transfer";
  quantity: number;
  previousStock: number;
  newStock: number;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  skuCode: string;
  transactionType: "purchase" | "sale" | "adjustment" | "transfer";
  quantityChange: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface InventoryLocation {
  id: string;
  name: string;
  description?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLevel {
  id: string;
  productId: string;
  productName: string;
  skuCode: string;
  locationId: string;
  locationName: string;
  quantity: number; // This maps to quantity_on_hand from database
  quantityReserved: number; // New field from database
  quantityAvailable: number; // New computed field from database
  minStockLevel: number; // Default to 0 since not in schema
  maxStockLevel: number; // Default to 0 since not in schema
  reorderPoint: number; // Default to 0 since not in schema
  lastUpdated: Date;
}
