
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Combine } from "lucide-react";
import { PurchaseIndentTable } from "@/components/purchase-orders/PurchaseIndentTable";
import { PurchaseIndentDialog } from "@/components/purchase-orders/PurchaseIndentDialog";
import { PurchaseIndentView } from "@/components/purchase-orders/PurchaseIndentView";
import { type PurchaseIndent } from "@/types/purchase-indent";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { getPurchaseIndents, createPurchaseIndent, updatePurchaseIndent, deletePurchaseIndent, getPurchaseIndent, consolidateIndentsToPO, getSuppliers } from "@/lib/api";
import { toast } from "sonner";
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
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const PurchaseIndentsPage = () => {
  const [indents, setIndents] = useState<PurchaseIndent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingIndent, setEditingIndent] = useState<PurchaseIndent | null>(null);
  const [viewingIndent, setViewingIndent] = useState<PurchaseIndent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState<PurchaseIndent | undefined>(undefined);
  
  // Consolidation State
  const [selectedIndentIds, setSelectedIndentIds] = useState<string[]>([]);
  const [isConsolidateDialogOpen, setIsConsolidateDialogOpen] = useState(false);
  const [suppliers, setSuppliersList] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isConsolidating, setIsConsolidating] = useState(false);

  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission('purchase_orders_create');
  const canEdit = hasPermission('purchase_orders_edit');
  const canDelete = hasPermission('purchase_orders_delete');
  
  useEffect(() => {
    loadIndents();
    loadSuppliers();
  }, []);

  const loadIndents = async () => {
    try {
      setLoading(true);
      const data = await getPurchaseIndents().catch(() => []);
      setIndents(data || []);
    } catch (error) {
      console.error('Error loading indents:', error);
      toast.error('Failed to load indents');
      setIndents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliersList(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const handleAddIndent = () => {
    setEditingIndent(null);
    setIsDialogOpen(true);
  };
  
  const handleEditIndent = (indent: PurchaseIndent) => {
    if (indent.status === 'approved' || indent.status === 'converted' || indent.status === 'rejected') {
      toast.error(`Cannot edit indent with status "${indent.status}".`);
      return;
    }
    setEditingIndent(indent);
    setIsDialogOpen(true);
  };

  const handleViewIndent = async (indent: PurchaseIndent) => {
    try {
        const full = await getPurchaseIndent(indent.id);
        setViewingIndent(full || indent);
        setViewDialogOpen(true);
    } catch (e) {
        setViewingIndent(indent);
        setViewDialogOpen(true);
    }
  };

  const handleDeleteIndent = (id: string) => {
    const indent = indents.find(i => i.id === id);
    if (indent?.status === 'approved' || indent?.status === 'converted') {
      toast.error(`Cannot delete indent with status "${indent.status}".`);
      return;
    }
    setSelectedIndent(indent);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIndent) return;
    try {
      await deletePurchaseIndent(selectedIndent.id);
      setIndents(indents.filter((i) => i.id !== selectedIndent.id));
      setDeleteDialogOpen(false);
      toast.success('Indent deleted successfully');
    } catch (error) {
      toast.error('Failed to delete indent');
    }
  };

  const handleSaveIndent = async (indentData: any) => {
    try {
      if (editingIndent) {
        await updatePurchaseIndent(editingIndent.id, indentData);
        toast.success('Indent updated successfully');
      } else {
        await createPurchaseIndent(indentData);
        toast.success('Indent created successfully');
      }
      setIsDialogOpen(false);
      loadIndents();
    } catch (error) {
      toast.error('Failed to save indent');
    }
  };

  const handleConsolidateClick = () => {
    if (selectedIndentIds.length === 0) return;
    
    // Validate all selected indents are approved
    const selectedIndents = indents.filter(i => selectedIndentIds.includes(i.id));
    const allApproved = selectedIndents.every(i => i.status === 'approved');
    
    if (!allApproved) {
        toast.error("All selected indents must be in 'approved' status to consolidate.");
        return;
    }

    setIsConsolidateDialogOpen(true);
  };

  const handleConsolidateConfirm = async () => {
    if (!selectedSupplierId) {
        toast.error("Please select a supplier");
        return;
    }

    try {
        setIsConsolidating(true);
        const result = await consolidateIndentsToPO({
            indentIds: selectedIndentIds,
            supplierId: selectedSupplierId,
            orderDate: new Date().toISOString().split('T')[0]
        });

        toast.success("Purchase Order created successfully");
        setIsConsolidateDialogOpen(false);
        setSelectedIndentIds([]);
        loadIndents();
        
        // Navigate to the newly created PO
        if (result.purchaseOrderId) {
            navigate(`/purchase-orders?id=${result.purchaseOrderId}`);
        }
    } catch (error: any) {
        toast.error(error.message || "Failed to consolidate indents");
    } finally {
        setIsConsolidating(false);
    }
  };

  const filteredIndents = indents.filter(i => 
    i.indentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <PermissionGuard 
      requiredPermission="purchase_orders_view"
      fallbackMessage="You do not have permission to view purchase indents."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Indents</h1>
            <p className="text-muted-foreground">Manage internal procurement requests (Intent Orders).</p>
          </div>
          <div className="flex gap-2">
            {selectedIndentIds.length > 0 && (
                <Button 
                    variant="outline" 
                    className="flex items-center gap-1 border-primary text-primary hover:bg-primary/10"
                    onClick={handleConsolidateClick}
                >
                    <Combine className="h-4 w-4" /> Consolidate ({selectedIndentIds.length}) to PO
                </Button>
            )}
            {canCreate && (
                <Button onClick={handleAddIndent} className="flex items-center gap-1">
                    <Plus className="h-4 w-4" /> Create Indent
                </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search indents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <PurchaseIndentTable 
          indents={filteredIndents}
          loading={loading}
          onView={handleViewIndent}
          onEdit={canEdit ? handleEditIndent : undefined}
          onDelete={canDelete ? handleDeleteIndent : undefined}
          selectedIds={selectedIndentIds}
          onSelectionChange={setSelectedIndentIds}
        />
        
        <PurchaseIndentDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          indent={editingIndent}
          onSave={handleSaveIndent}
        />

        <PurchaseIndentView
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          indent={viewingIndent}
        />

        {/* Consolidation Dialog */}
        <Dialog open={isConsolidateDialogOpen} onOpenChange={setIsConsolidateDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Consolidate Indents to Purchase Order</DialogTitle>
                    <DialogDescription>
                        You are creating a single Purchase Order from {selectedIndentIds.length} approved indents.
                        All identical products will be summed up.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="supplier">Select Supplier</Label>
                        <Select onValueChange={setSelectedSupplierId} value={selectedSupplierId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsConsolidateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConsolidateConfirm} disabled={isConsolidating}>
                        {isConsolidating ? "Generating PO..." : "Generate Purchase Order"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete indent "{selectedIndent?.indentNumber}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
};

export default PurchaseIndentsPage;
