
export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  description?: string;
  is_active?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
