import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText } from "lucide-react";
import { type WholesaleBill } from "@/types/wholesale-billing";
import { type WholesaleOrder } from "@/types/wholesale-order";
import { WholesaleBillingTable } from "@/components/wholesale-billing/WholesaleBillingTable";
import { WholesaleBillingDialog } from "@/components/wholesale-billing/WholesaleBillingDialog";
import { ReturnDialog } from "@/components/wholesale-billing/ReturnDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { type Customer } from "@/types/customer";
import { type CreditNote } from "@/types/credit-note";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

// Sample data for demonstration
const sampleBills: WholesaleBill[] = [
  {
    id: "1",
    billNumber: "BILL-0001",
    wholesaleOrderId: "1",
    customerId: "1",
    customer: {
      id: "1",
      name: "ABC Corporation",
      email: "info@abccorp.com",
      phone: "555-1234",
      billingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    billingDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "pending",
    subtotal: 1500,
    taxAmount: 150,
    discountAmount: 50,
    totalAmount: 1600,
    amountPaid: 0,
    amountDue: 1600,
    notes: "Please make payment by due date",
    items: [
      {
        id: "1",
        billId: "1",
        productId: "1",
        productName: "Product One",
        skuCode: "PRD-001",
        quantity: 10,
        unitPrice: 150,
        discount: 5,
        tax: 10,
        total: 1600,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    billNumber: "BILL-0002",
    customerId: "2",
    customer: {
      id: "2",
      name: "XYZ Limited",
      email: "info@xyzlimited.com",
      phone: "555-5678",
      billingAddress: {
        street: "456 Market St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94103",
        country: "USA"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    billingDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    status: "paid",
    paymentMethod: "bank_transfer",
    paymentReference: "TXN-9876543",
    paymentDate: new Date(),
    subtotal: 750,
    taxAmount: 75,
    discountAmount: 0,
    totalAmount: 825,
    amountPaid: 825,
    amountDue: 0,
    notes: "",
    items: [
      {
        id: "2",
        billId: "2",
        productId: "2",
        productName: "Product Two",
        skuCode: "PRD-002",
        quantity: 5,
        unitPrice: 150,
        discount: 0,
        tax: 10,
        total: 825,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample customers for demonstration
const sampleCustomers: Customer[] = [
  { 
    id: "1", 
    name: "ABC Corporation",
    email: "info@abccorp.com",
    phone: "555-1234",
    billingAddress: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  { 
    id: "2", 
    name: "XYZ Limited",
    email: "info@xyzlimited.com",
    phone: "555-5678",
    billingAddress: {
      street: "456 Market St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94103",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  { 
    id: "3", 
    name: "123 Industries",
    email: "info@123industries.com",
    phone: "555-9012",
    billingAddress: {
      street: "789 Broadway",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
];

// Sample products for demonstration
const sampleProducts = [
  { id: "1", name: "Product One", skuCode: "PRD-001", price: 150, taxRate: 10 },
  { id: "2", name: "Product Two", skuCode: "PRD-002", price: 150, taxRate: 10 },
  { id: "3", name: "Product Three", skuCode: "PRD-003", price: 200, taxRate: 10 },
];

// Sample orders for demonstration
const sampleOrders: WholesaleOrder[] = [
  {
    id: "1",
    orderNumber: "WS-0001",
    customerId: "1",
    customer: {
      id: "1",
      name: "ABC Corporation",
      email: "info@abccorp.com",
      phone: "555-1234",
      billingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "confirmed",
    subtotal: 1500,
    taxAmount: 150,
    discountAmount: 50,
    shippingAmount: 25,
    totalAmount: 1625,
    items: [
      {
        id: "1",
        orderId: "1",
        productId: "1",
        productName: "Product One",
        skuCode: "PRD-001",
        quantity: 10,
        unitPrice: 150,
        discount: 5,
        tax: 10,
        total: 1625,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

export default function WholesaleBillingPage() {
  const [bills, setBills] = useState<WholesaleBill[]>(sampleBills);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<WholesaleBill | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  
  // For returns processing
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedReturnBill, setSelectedReturnBill] = useState<WholesaleBill | undefined>(undefined);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);

  const { hasPermission } = useAuth();
  const canViewBilling = hasPermission('sale_invoices_view');
  const canCreateBilling = hasPermission('sale_invoices_create');
  const canEditBilling = hasPermission('sale_invoices_edit');
  const canDeleteBilling = hasPermission('sale_invoices_delete');

  if (!canViewBilling) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Sale Invoices</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view sale invoices. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAddNew = () => {
    setSelectedBill(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (bill: WholesaleBill) => {
    setSelectedBill(bill);
    setDialogOpen(true);
  };

  const handleView = (bill: WholesaleBill) => {
    setSelectedBill(bill);
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (itemToDeleteId) {
      setBills(bills.filter((item) => item.id !== itemToDeleteId));
      toast({
        title: "Success",
        description: "Sale invoice deleted successfully",
      });
      setDeleteDialogOpen(false);
      setItemToDeleteId(null);
    }
  };

  const handleProcessReturn = (bill: WholesaleBill) => {
    setSelectedReturnBill(bill);
    setReturnDialogOpen(true);
  };

  const handleCreateCreditNote = (creditNote: Partial<CreditNote>) => {
    const newCreditNote: CreditNote = {
      id: Date.now().toString(),
      ...creditNote as Omit<CreditNote, 'id'>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCreditNotes([...creditNotes, newCreditNote]);
    
    // If the bill was fully returned, update its status
    if (selectedReturnBill && newCreditNote.totalAmount >= selectedReturnBill.totalAmount) {
      setBills(bills.map(bill => 
        bill.id === selectedReturnBill.id 
          ? { ...bill, status: "cancelled", notes: `${bill.notes || ''} \nFully returned. Credit Note #${newCreditNote.creditNoteNumber}` }
          : bill
      ));
    } else if (selectedReturnBill) {
      // Mark as partially returned
      setBills(bills.map(bill => 
        bill.id === selectedReturnBill.id 
          ? { ...bill, notes: `${bill.notes || ''} \nPartially returned. Credit Note #${newCreditNote.creditNoteNumber}` }
          : bill
      ));
    }
  };

  const handleSave = (bill: Partial<WholesaleBill>) => {
    if (selectedBill) {
      // Update existing bill
      setBills(bills.map((item) => (item.id === selectedBill.id ? { ...item, ...bill } : item)));
      toast({
        title: "Success",
        description: "Wholesale bill updated successfully",
      });
    } else {
      // Create new bill
      const newBill: WholesaleBill = {
        id: Date.now().toString(),
        billNumber: bill.billNumber || "",
        wholesaleOrderId: bill.wholesaleOrderId,
        customerId: bill.customerId || "",
        customer: bill.customer || sampleCustomers[0],
        billingDate: bill.billingDate || new Date(),
        dueDate: bill.dueDate || new Date(),
        status: bill.status || "draft",
        paymentMethod: bill.paymentMethod,
        paymentReference: bill.paymentReference,
        paymentDate: bill.status === "paid" ? new Date() : undefined,
        subtotal: bill.subtotal || 0,
        taxAmount: bill.taxAmount || 0,
        discountAmount: bill.discountAmount || 0,
        totalAmount: bill.totalAmount || 0,
        amountPaid: bill.amountPaid || 0,
        amountDue: bill.amountDue || 0,
        notes: bill.notes,
        items: bill.items || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setBills([...bills, newBill]);
      toast({
        title: "Success",
        description: "Wholesale bill created successfully",
      });
    }
  };

  const handlePrintInvoice = (bill: WholesaleBill) => {
    toast({
      title: "Printing invoice",
      description: `Invoice ${bill.billNumber} is being prepared for printing.`,
    });
    // In a real implementation, this would trigger a print dialog or generate a PDF
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sale Invoices</h1>
        {canCreateBilling ? (
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <PlusCircle size={18} />
          New Bill
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="flex items-center gap-2">
                    <PlusCircle size={18} />
                    New Bill
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create wholesale bills
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <WholesaleBillingTable
        bills={bills}
        onView={handleView}
        onEdit={canEditBilling ? handleEdit : undefined}
        onDelete={canDeleteBilling ? handleDeleteClick : undefined}
        onPrintInvoice={handlePrintInvoice}
        onProcessReturn={handleProcessReturn}
        canEdit={canEditBilling}
        canDelete={canDeleteBilling}
      />

      <WholesaleBillingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bill={selectedBill}
        onSave={handleSave}
        customers={sampleCustomers}
        products={sampleProducts}
        orders={sampleOrders}
        creditNotes={creditNotes}
      />
      
      {selectedReturnBill && (
        <ReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          bill={selectedReturnBill}
          onCreateCreditNote={handleCreateCreditNote}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              wholesale bill and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
