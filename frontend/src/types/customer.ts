
export interface Address {
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
  billingAddress: Address;
  shippingAddress?: Address;
  taxId?: string;
  notes?: string;
  creditLimit?: number;
  currentCredit?: number;
  customerType?: "retail" | "wholesale" | "distributor";
  createdAt: Date;
  updatedAt: Date;
}
