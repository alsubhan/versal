import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search } from "lucide-react";
import { type SalesOrder } from "@/types/sales-order";
import { SaleOrderTable } from "@/components/sale-orders/SaleOrderTable";
import { SaleOrderDialog } from "@/components/sale-orders/SaleOrderDialog";
import { SaleOrderView } from "@/components/sale-orders/SaleOrderView";
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
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { getSalesOrders, createSalesOrder, updateSalesOrder, deleteSalesOrder, getSalesOrder } from "@/lib/api";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";

export default function SaleOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | undefined>(undefined);
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrder | undefined>(undefined);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<SalesOrder | null>(null);
  const { hasPermission } = useAuth();
  const canCreateOrders = hasPermission('sale_orders_create');
  const canEditOrders = hasPermission('sale_orders_edit');
  const canDeleteOrders = hasPermission('sale_orders_delete');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getSalesOrders().catch(() => []);
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading sales orders:', error);
      toast.error('Failed to load sales orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedOrder(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (order: SalesOrder) => {
    // Check if order can be edited based on status
            if (order.status === 'fulfilled' || order.status === 'cancelled') {
              toast.error(`Cannot edit sale order with status "${order.status}". Only draft, pending, approved, sent, partial, and overdue orders can be edited.`);
      return;
    }
    
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleView = (order: SalesOrder) => {
    setViewingOrder(order);
    setViewDialogOpen(true);
  };

  const handlePrint = async (order: SalesOrder) => {
    try {
      const full = await getSalesOrder(order.id);
      const data = full && !full.error ? full : order;
      setPrintingOrder(data);
      setPrintDialogOpen(true);
    } catch (e) {
      console.error('Error preparing SO for print:', e);
      setPrintingOrder(order);
      setPrintDialogOpen(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    const order = orders.find(o => o.id === id);
    
    // Check if order can be deleted based on status
            if (order?.status === 'fulfilled' || order?.status === 'cancelled') {
              toast.error(`Cannot delete sale order with status "${order.status}". Only draft, pending, approved, sent, partial, and overdue orders can be deleted.`);
      return;
    }
    
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (orderToDelete) {
      try {
        await deleteSalesOrder(orderToDelete.id);
      toast.success("Sale order deleted successfully");
        loadData();
      } catch (error) {
        console.error('Error deleting sale order:', error);
        toast.error("Failed to delete sale order");
      }
      setDeleteDialogOpen(false);
      setOrderToDelete(undefined);
    }
  };

  const handleSave = async (order: Partial<SalesOrder>) => {
    try {
    if (selectedOrder) {
        await updateSalesOrder(selectedOrder.id, order);
      toast.success("Sale order updated successfully");
    } else {
        await createSalesOrder(order);
      toast.success("Sale order created successfully");
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving sale order:', error);
      toast.error("Failed to save sale order");
    }
  };

  // Filter sale orders based on search term
  const filteredOrders = orders.filter(order => 
    order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PermissionGuard 
      requiredPermission="sale_orders_view"
      fallbackMessage="You do not have permission to view sale orders. Please contact an administrator."
    >
      <div className="space-y-6">

        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Sale Orders</h1>
        {canCreateOrders ? (
        <Button onClick={handleAddNew} className="flex items-center gap-1">
          <PlusCircle className="h-4 w-4" />
          Create Sale Order
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="flex items-center gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Create Sale Order
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create sale orders
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search sale orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <SaleOrderTable
        orders={filteredOrders}
        loading={loading}
        onView={handleView}
        onEdit={canEditOrders ? handleEdit : undefined}
        onDelete={canDeleteOrders ? handleDeleteClick : undefined}
        onPrint={handlePrint}
        canEdit={canEditOrders}
        canDelete={canDeleteOrders}
      />

      <SaleOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        salesOrder={selectedOrder}
        onSave={handleSave}
      />

      <SaleOrderView
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        salesOrder={viewingOrder}
      />

      <PrintPreviewDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        documentType="salesOrder"
        data={printingOrder}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sale order "{orderToDelete?.orderNumber}".
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
