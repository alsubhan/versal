
export interface Tax {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  appliedTo: "products" | "services" | "both";
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
