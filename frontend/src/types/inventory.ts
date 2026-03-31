
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

export interface Product {
  id: string;
  name: string;
  sku_code: string;
  hsn_code: string;
  barcode: string;
  cost_price: number;
  sale_price: number;
  mrp?: number;
  purchase_tax_type?: 'inclusive' | 'exclusive';
  sale_tax_type?: 'inclusive' | 'exclusive';
  allow_override_price?: boolean;
  is_serialized?: boolean;
  unit_conversions?: Record<string, number> | string | null;
  purchase_tax?: {
    id: string;
    name: string;
    rate: number;
  };
  sale_tax?: {
    id: string;
    name: string;
    rate: number;
  };
  units?: {
    name: string;
    abbreviation: string;
  };
  category?: {
    name: string;
  };
  // Enriched fields produced by dialogs for consumers
  _selectedQuantity?: number;
  _selectedUnitLabel?: string;
  _selectedUnitMultiplier?: number;
  _selectedUnitPrice?: number;
  _serialNumbers?: string[];
}

