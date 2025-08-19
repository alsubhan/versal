import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search } from "lucide-react";
import { type SaleInvoice } from "@/types/sale-invoice";
import { type SalesOrder } from "@/types/sales-order";
import { SalesInvoiceTable } from "@/components/sale-invoices/SalesInvoiceTable";
import { SaleInvoiceDialog } from "@/components/sale-invoices/SaleInvoiceDialog";
import { SaleInvoiceView } from "@/components/sale-invoices/SaleInvoiceView";
import { SaleReturnDialog } from "@/components/sale-invoices/SaleReturnDialog";
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
import { toast } from "sonner";
import { type Customer } from "@/types/customer";
import { type CreditNote } from "@/types/credit-note";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { getSaleInvoices, createSaleInvoice, updateSaleInvoice, deleteSaleInvoice, getSaleInvoice } from "@/lib/api";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";

export default function SaleInvoicesPage() {
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | undefined>(undefined);
  const [viewingInvoice, setViewingInvoice] = useState<SaleInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SaleInvoice | undefined>(undefined);
  
  // For returns processing
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<SaleInvoice | undefined>(undefined);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingInvoice, setPrintingInvoice] = useState<SaleInvoice | null>(null);

  const { hasPermission } = useAuth();
  const canCreateBilling = hasPermission('sale_invoices_create');
  const canEditBilling = hasPermission('sale_invoices_edit');
  const canDeleteBilling = hasPermission('sale_invoices_delete');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getSaleInvoices().catch(() => []);
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading sale invoices:', error);
      toast.error('Failed to load sale invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedInvoice(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (invoice: SaleInvoice) => {
    // Check if invoice can be edited based on status
    if (invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled') {
      toast.error(`Cannot edit sale invoice with status "${invoice.status}". Only draft, sent, and partial invoices can be edited.`);
      return;
    }
    
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const handleView = (invoice: SaleInvoice) => {
    setViewingInvoice(invoice);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setInvoiceToDelete(invoices.find(invoice => invoice.id === id));
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (invoiceToDelete) {
      try {
        await deleteSaleInvoice(invoiceToDelete.id);
      toast.success("Sale invoice deleted successfully");
        loadData();
      } catch (error) {
        console.error('Error deleting sale invoice:', error);
        toast.error("Failed to delete sale invoice");
      }
      setDeleteDialogOpen(false);
      setInvoiceToDelete(undefined);
    }
  };

  const handleProcessReturn = async (invoice: SaleInvoice) => {
    try {
      // Fetch complete invoice data including items
      const completeInvoice = await getSaleInvoice(invoice.id);
      if (completeInvoice && !completeInvoice.error) {
        setSelectedReturnInvoice(completeInvoice);
        setReturnDialogOpen(true);
      } else {
        toast.error("Failed to load invoice details for return processing");
      }
    } catch (error) {
      console.error('Error loading invoice for return:', error);
      toast.error("Failed to load invoice details for return processing");
    }
  };

  const handleCreateCreditNote = (creditNote: Partial<CreditNote>) => {
    const newCreditNote: CreditNote = {
      id: Date.now().toString(),
      ...creditNote as Omit<CreditNote, 'id'>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // If the invoice was fully returned, update its status
    if (selectedReturnInvoice && newCreditNote.totalAmount >= selectedReturnInvoice.totalAmount) {
      setInvoices(invoices.map(invoice => 
        invoice.id === selectedReturnInvoice.id 
          ? { ...invoice, status: "cancelled", notes: `${invoice.notes || ''} \nFully returned. Credit Note #${newCreditNote.creditNoteNumber}` }
          : invoice
      ));
    } else if (selectedReturnInvoice) {
      // Mark as partially returned
      setInvoices(invoices.map(invoice => 
        invoice.id === selectedReturnInvoice.id 
          ? { ...invoice, notes: `${invoice.notes || ''} \nPartially returned. Credit Note #${newCreditNote.creditNoteNumber}` }
          : invoice
      ));
    }
  };

  const handleSave = async (invoice: Partial<SaleInvoice>) => {
    try {
    if (selectedInvoice) {
        await updateSaleInvoice(selectedInvoice.id, invoice);
      toast.success("Sale invoice updated successfully");
    } else {
        await createSaleInvoice(invoice);
        toast.success("Sale invoice created successfully");
      }
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving sale invoice:', error);
      const msg = (error?.message || '').toString();
      if (msg.toLowerCase().includes('insufficient credit limit') || msg.toLowerCase().includes('credit limit exceeded')) {
        toast.error('Credit limit exceeded. Cannot complete invoice on credit. Choose a non-credit payment method or reduce the total.');
        // Keep dialog open and focus payment method
        setDialogOpen(true);
        setFocusPaymentMethodTick((t) => t + 1);
      } else {
        toast.error("Failed to save sale invoice");
      }
    }
  };

  // Tick to request focus of payment method inside dialog
  const [focusPaymentMethodTick, setFocusPaymentMethodTick] = useState(0);

  const handlePrintInvoice = async (invoice: SaleInvoice) => {
    try {
      const full = await getSaleInvoice(invoice.id);
      const data = full && !full.error ? full : invoice;
      setPrintingInvoice(data);
      setPrintDialogOpen(true);
    } catch (e) {
      console.error('Error preparing invoice for print:', e);
      setPrintingInvoice(invoice);
      setPrintDialogOpen(true);
    }
  };

  // Filter sale invoices based on search term
  const filteredInvoices = invoices.filter(invoice => 
    invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.salesOrder?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PermissionGuard 
      requiredPermission="sale_invoices_view"
      fallbackMessage="You do not have permission to view sale invoices. Please contact an administrator."
    >
      <div className="space-y-6">

        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Sale Invoices</h1>
        {canCreateBilling ? (
        <Button onClick={handleAddNew} className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Create Sale Invoice
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Create Sale Invoice
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create sale invoices
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search sale invoices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <SalesInvoiceTable
        invoices={filteredInvoices}
        loading={loading}
        onView={handleView}
        onEdit={canEditBilling ? handleEdit : undefined}
        onDelete={canDeleteBilling ? handleDeleteClick : undefined}
        onPrintInvoice={handlePrintInvoice}
        onProcessReturn={handleProcessReturn}
        canEdit={canEditBilling}
        canDelete={canDeleteBilling}
      />

      <SaleInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        saleInvoice={selectedInvoice}
        onSave={handleSave}
        focusPaymentMethodTick={focusPaymentMethodTick}
      />

      <SaleInvoiceView
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        saleInvoice={viewingInvoice}
        onInvoiceUpdate={loadData}
      />
      
      {selectedReturnInvoice && (
        <SaleReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          invoice={selectedReturnInvoice}
          onCreateCreditNote={handleCreateCreditNote}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sale invoice "{invoiceToDelete?.invoiceNumber}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrintPreviewDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        documentType="saleInvoice"
        data={printingInvoice}
      />
    </div>
    </PermissionGuard>
  );
}
