
import { useState, useEffect } from "react";
import { GRNTable } from "@/components/grn/GRNTable";
import { GRNDialog } from "@/components/grn/GRNDialog";
import { GRNView } from "@/components/grn/GRNView";
import { GRNReturnDialog } from "@/components/grn/GRNReturnDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { type GoodsReceiveNote } from "@/types/grn";
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
import { getGoodReceiveNotes, getGoodReceiveNote, createGoodReceiveNote, updateGoodReceiveNote, deleteGoodReceiveNote } from "@/lib/api";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";

export default function GRNsPage() {
  const [data, setData] = useState<GoodsReceiveNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GoodsReceiveNote | undefined>(undefined);
  const [viewingGrn, setViewingGrn] = useState<GoodsReceiveNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGrnToDelete] = useState<GoodsReceiveNote | undefined>(undefined);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingGrn, setPrintingGrn] = useState<GoodsReceiveNote | null>(null);
  
  // For returns processing
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedReturnGrn, setSelectedReturnGrn] = useState<GoodsReceiveNote | undefined>(undefined);

  const { hasPermission } = useAuth();
  const canCreateGRN = hasPermission('grn_create');
  const canEditGRN = hasPermission('grn_edit');
  const canDeleteGRN = hasPermission('grn_delete');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getGoodReceiveNotes().catch(() => []);
      setData(data || []);
    } catch (error) {
      console.error('Error loading GRNs:', error);
      toast.error("Failed to load GRNs");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedGrn(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (grn: GoodsReceiveNote) => {
    // Check if GRN can be edited based on status
    if (grn.status === 'completed' || grn.status === 'rejected') {
      toast.error(`Cannot edit GRN with status "${grn.status}". Only draft and partial GRNs can be edited.`);
      return;
    }
    
    setSelectedGrn(grn);
    setDialogOpen(true);
  };

  const handleView = (grn: GoodsReceiveNote) => {
    setViewingGrn(grn);
    setViewDialogOpen(true);
  };

  const handlePrint = async (grn: GoodsReceiveNote) => {
    try {
      const full = await getGoodReceiveNote(grn.id);
      const data = full && !full.error ? full : grn;
      setPrintingGrn(data);
      setPrintDialogOpen(true);
    } catch (e) {
      console.error('Error preparing GRN for print:', e);
      setPrintingGrn(grn);
      setPrintDialogOpen(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    const grn = data.find(g => g.id === id);
    
    // Check if GRN can be deleted based on status
    if (grn?.status === 'completed' || grn?.status === 'rejected') {
      toast.error(`Cannot delete GRN with status "${grn.status}". Only draft and partial GRNs can be deleted.`);
      return;
    }
    
    setGrnToDelete(grn);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (grnToDelete) {
      try {
        await deleteGoodReceiveNote(grnToDelete.id);
        toast.success("Goods receive note deleted successfully");
        loadData();
      } catch (error) {
        console.error('Error deleting GRN:', error);
        toast.error("Failed to delete goods receive note");
      }
      setDeleteDialogOpen(false);
      setGrnToDelete(undefined);
    }
  };

  const handleProcessReturn = (grn: GoodsReceiveNote) => {
    setSelectedReturnGrn(grn);
    setReturnDialogOpen(true);
  };

  const handleProcessReturnData = (returnData: any) => {
    // Handle the return data - this could update the GRN status, create return records, etc.
    console.log('Processing GRN return:', returnData);
    
    toast.success(`Return processed for GRN ${returnData.grnNumber}. Total return amount: ${returnData.returnTotal}`);
    
    // Reload data to reflect changes
    loadData();
  };

  const handleSave = async (grn: Partial<GoodsReceiveNote>) => {
    try {
      if (selectedGrn) {
        await updateGoodReceiveNote(selectedGrn.id, grn);
        toast.success("Goods receive note updated successfully");
      } else {
        await createGoodReceiveNote(grn);
        toast.success("Goods receive note created successfully");
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving GRN:', error);
      toast.error("Failed to save GRN");
    }
  };

  // Filter GRNs based on search term
  const filteredGRNs = data.filter(grn => 
    grn.grnNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grn.purchaseOrder?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grn.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    grn.receivedByUser?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PermissionGuard 
      requiredPermission="grn_view"
      fallbackMessage="You do not have permission to view goods receive notes. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Goods Receive Notes</h1>
          {canCreateGRN ? (
            <Button onClick={handleAddNew} className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Create GRN
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      Create GRN
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to create GRNs
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search GRNs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <GRNTable
          grns={filteredGRNs}
          loading={loading}
          onView={handleView}
          onEdit={canEditGRN ? handleEdit : undefined}
          onDelete={canDeleteGRN ? handleDeleteClick : undefined}
          onPrint={handlePrint}
          onProcessReturn={handleProcessReturn}
          canEdit={canEditGRN}
          canDelete={canDeleteGRN}
          canProcessReturn={hasPermission('grn_edit')}
        />

        <GRNDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          grn={selectedGrn}
          onSave={handleSave}
        />

        <GRNView
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          grn={viewingGrn}
        />

        <PrintPreviewDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          documentType="grn"
          data={printingGrn}
        />

        {selectedReturnGrn && (
          <GRNReturnDialog
            open={returnDialogOpen}
            onOpenChange={setReturnDialogOpen}
            grn={selectedReturnGrn}
            onProcessReturn={handleProcessReturnData}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the GRN "{grnToDelete?.grnNumber}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
