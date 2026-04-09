
export interface Address {
  id?: string;
  type?: 'billing' | 'shipping' | 'both';
  label?: string;
  isDefault?: boolean;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  additionalAddresses?: Address[];
  taxId?: string;
  notes?: string;
  creditLimit?: number;
  currentCredit?: number;
  customerType?: "retail" | "wholesale" | "distributor";
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
