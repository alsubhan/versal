import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search } from "lucide-react";
import { type SaleQuotation } from "@/types/sale-quotation";
import { SaleQuotationTable } from "@/components/sale-quotations/SaleQuotationTable";
import { SaleQuotationDialog } from "@/components/sale-quotations/SaleQuotationDialog";
import { SaleQuotationView } from "@/components/sale-quotations/SaleQuotationView";
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
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";
import {
  getSaleQuotations,
  getSaleQuotation,
  createSaleQuotation,
  updateSaleQuotation,
  deleteSaleQuotation,
  convertQuotationToOrder,
} from "@/lib/api";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";

const TERMINAL_STATUSES = ["accepted", "rejected", "expired", "cancelled"];

export default function SaleQuotationsPage() {
  const [quotations, setQuotations] = useState<SaleQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const [selectedQuotation, setSelectedQuotation] = useState<SaleQuotation | undefined>(undefined);
  const [viewingQuotation, setViewingQuotation] = useState<SaleQuotation | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<SaleQuotation | undefined>(undefined);
  const [printingQuotation, setPrintingQuotation] = useState<SaleQuotation | null>(null);
  const [quotationToConvert, setQuotationToConvert] = useState<SaleQuotation | null>(null);
  const [converting, setConverting] = useState(false);

  const { hasPermission } = useAuth();
  const canCreate = hasPermission("sale_quotations_create");
  const canEdit = hasPermission("sale_quotations_edit");
  const canDelete = hasPermission("sale_quotations_delete");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getSaleQuotations().catch(() => []);
      setQuotations(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load quotations");
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedQuotation(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (q: SaleQuotation) => {
    if (TERMINAL_STATUSES.includes(q.status)) {
      toast.error(`Cannot edit a ${q.status} quotation.`);
      return;
    }
    setSelectedQuotation(q);
    setDialogOpen(true);
  };

  const handleView = (q: SaleQuotation) => {
    setViewingQuotation(q);
    setViewDialogOpen(true);
  };

  const handlePrint = async (q: SaleQuotation) => {
    try {
      const full = await getSaleQuotation(q.id);
      setPrintingQuotation(full && !full.error ? full : q);
      setPrintDialogOpen(true);
    } catch {
      setPrintingQuotation(q);
      setPrintDialogOpen(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    const q = quotations.find((o) => o.id === id);
    if (!q) return;
    if (TERMINAL_STATUSES.includes(q.status)) {
      toast.error(`Cannot delete a ${q.status} quotation.`);
      return;
    }
    setQuotationToDelete(q);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!quotationToDelete) return;
    try {
      await deleteSaleQuotation(quotationToDelete.id);
      toast.success("Quotation deleted successfully");
      loadData();
    } catch {
      toast.error("Failed to delete quotation");
    } finally {
      setDeleteDialogOpen(false);
      setQuotationToDelete(undefined);
    }
  };

  const handleSave = async (q: Partial<SaleQuotation>) => {
    try {
      if (selectedQuotation) {
        await updateSaleQuotation(selectedQuotation.id, q);
        toast.success("Quotation updated successfully");
      } else {
        await createSaleQuotation(q);
        toast.success("Quotation created successfully");
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save quotation");
    }
  };

  // Trigger convert confirm dialog (from table OR view)
  const handleConvertRequest = (q: SaleQuotation) => {
    setViewDialogOpen(false);
    setQuotationToConvert(q);
    setConvertDialogOpen(true);
  };

  const handleConvertConfirm = async () => {
    if (!quotationToConvert) return;
    setConverting(true);
    try {
      const so = await convertQuotationToOrder(quotationToConvert.id);
      toast.success(
        `Sale Order ${so.order_number || so.orderNumber || ""} created successfully!`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert quotation");
    } finally {
      setConverting(false);
      setConvertDialogOpen(false);
      setQuotationToConvert(null);
    }
  };

  const filtered = quotations.filter(
    (q) =>
      q.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PermissionGuard
      requiredPermission="sale_quotations_view"
      fallbackMessage="You do not have permission to view sale quotations. Please contact an administrator."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Sale Quotations</h1>
          {canCreate ? (
            <Button onClick={handleAddNew} className="flex items-center gap-1">
              <PlusCircle className="h-4 w-4" />
              Create Quotation
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-1">
                      <PlusCircle className="h-4 w-4" />
                      Create Quotation
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>You do not have permission to create quotations</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by quotation #, customer or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        <SaleQuotationTable
          quotations={filtered}
          loading={loading}
          onView={handleView}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canDelete ? handleDeleteClick : undefined}
          onPrint={handlePrint}
          onConvert={canEdit ? handleConvertRequest : undefined}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        {/* Create / Edit Dialog */}
        <SaleQuotationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quotation={selectedQuotation ?? null}
          onSave={handleSave}
        />

        {/* View Dialog */}
        <SaleQuotationView
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          quotation={viewingQuotation}
          onConvert={canEdit ? handleConvertRequest : undefined}
          onPrint={handlePrint}
        />

        {/* Print Dialog */}
        <PrintPreviewDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          documentType="saleQuotation"
          data={printingQuotation}
        />

        {/* Delete Confirm */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete quotation "{quotationToDelete?.quotationNumber}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Convert Confirm */}
        <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Convert to Sale Order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a new Sale Order from quotation "
                {quotationToConvert?.quotationNumber}" and mark the quotation as{" "}
                <strong>accepted (read-only)</strong>. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={converting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConvertConfirm}
                disabled={converting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {converting ? "Converting..." : "Convert to Sale Order"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
