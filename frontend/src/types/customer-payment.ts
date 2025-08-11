export interface CustomerPayment {
  id: string;
  invoiceId: string;
  customerId: string;
  paymentAmount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "bank_transfer" | "cheque" | "credit_card" | "online" | "credit" | "credit_note";
  paymentReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPaymentWithRelations extends CustomerPayment {
  customer?: {
    id: string;
    name: string;
    customerType: "retail" | "wholesale" | "distributor";
  };
  saleInvoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    status: string;
  };
}
