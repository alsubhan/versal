
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import { PurchaseOrderView } from "@/components/purchase-orders/PurchaseOrderView";
import { PurchaseOrderTable } from "@/components/purchase-orders/PurchaseOrderTable";
import { type PurchaseOrder } from "@/types/purchase-order";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, getPurchaseOrder } from "@/lib/api";
import { toast } from "sonner";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";
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

const PurchaseOrdersPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [viewingPurchaseOrder, setViewingPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | undefined>(undefined);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingPurchaseOrder, setPrintingPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const { hasPermission } = useAuth();
  const canCreatePurchaseOrders = hasPermission('purchase_orders_create');
  const canEditPurchaseOrders = hasPermission('purchase_orders_edit');
  const canDeletePurchaseOrders = hasPermission('purchase_orders_delete');
  
  // Load purchase orders on component mount
  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrders().catch(() => []);
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      toast.error('Failed to load purchase orders');
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchaseOrder = () => {
    setEditingPurchaseOrder(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    // Check if purchase order can be edited based on status
    if (purchaseOrder.status === 'approved' || purchaseOrder.status === 'cancelled' || purchaseOrder.status === 'received') {
      toast.error(`Cannot edit purchase order with status "${purchaseOrder.status}". Only draft and pending orders can be edited.`);
      return;
    }
    
    setEditingPurchaseOrder(purchaseOrder);
    setIsDialogOpen(true);
  };

  const handleViewPurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    setViewingPurchaseOrder(purchaseOrder);
    setViewDialogOpen(true);
  };

  const handleDeletePurchaseOrder = async (id: string) => {
    const purchaseOrder = purchaseOrders.find(po => po.id === id);
    
    // Check if purchase order can be deleted based on status
    if (purchaseOrder?.status === 'approved' || purchaseOrder?.status === 'cancelled' || purchaseOrder?.status === 'received') {
      toast.error(`Cannot delete purchase order with status "${purchaseOrder.status}". Only draft and pending orders can be deleted.`);
      return;
    }
    
    setSelectedPurchaseOrder(purchaseOrder);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPurchaseOrder) return;
    
    try {
      await deletePurchaseOrder(selectedPurchaseOrder.id);
      setPurchaseOrders(purchaseOrders.filter((po) => po.id !== selectedPurchaseOrder.id));
      setDeleteDialogOpen(false);
      toast.success('Purchase order deleted successfully');
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      toast.error('Failed to delete purchase order');
    }
  };

  const handlePrintPurchaseOrder = async (purchaseOrder: PurchaseOrder) => {
    try {
      // Try to fetch full details with items
      const full = await getPurchaseOrder(purchaseOrder.id);
      const data = full && !full.error ? full : purchaseOrder;
      setPrintingPurchaseOrder(data);
      setPrintDialogOpen(true);
    } catch (e) {
      console.error('Error preparing PO for print:', e);
      setPrintingPurchaseOrder(purchaseOrder);
      setPrintDialogOpen(true);
    }
  };

  const handleSavePurchaseOrder = async (purchaseOrder: Partial<PurchaseOrder>) => {
    try {
      if (editingPurchaseOrder) {
        await updatePurchaseOrder(editingPurchaseOrder.id, purchaseOrder);
        toast.success('Purchase order updated successfully');
      } else {
        await createPurchaseOrder(purchaseOrder);
        toast.success('Purchase order created successfully');
      }
      setIsDialogOpen(false);
      loadPurchaseOrders();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      toast.error('Failed to save purchase order');
    }
  };

  // Filter purchase orders based on search term
  const filteredPurchaseOrders = purchaseOrders.filter(po => 
    po.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <PermissionGuard 
      requiredPermission="purchase_orders_view"
      fallbackMessage="You do not have permission to view purchase orders. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          {canCreatePurchaseOrders ? (
        <Button 
          onClick={handleAddPurchaseOrder}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Create Purchase Order
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    disabled
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Create Purchase Order
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create purchase orders
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search purchase orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <PurchaseOrderTable 
        purchaseOrders={filteredPurchaseOrders}
        loading={loading}
        onView={handleViewPurchaseOrder}
        onEdit={canEditPurchaseOrders ? handleEditPurchaseOrder : undefined}
        onDelete={canDeletePurchaseOrders ? handleDeletePurchaseOrder : undefined}
        onPrint={handlePrintPurchaseOrder}
        canEdit={canEditPurchaseOrders}
        canDelete={canDeletePurchaseOrders}
      />
      
              <PurchaseOrderDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          purchaseOrder={editingPurchaseOrder}
          onSave={handleSavePurchaseOrder}
        />
        <PurchaseOrderView
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          purchaseOrder={viewingPurchaseOrder}
        />

        <PrintPreviewDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          documentType="purchaseOrder"
          data={printingPurchaseOrder}
        />
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the purchase order "{selectedPurchaseOrder?.orderNumber}".
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

export default PurchaseOrdersPage;
