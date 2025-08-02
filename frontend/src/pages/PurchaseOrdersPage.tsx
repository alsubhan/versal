
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import { PurchaseOrderTable } from "@/components/purchase-orders/PurchaseOrderTable";
import { type PurchaseOrder } from "@/types/purchase-order";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";

const PurchaseOrdersPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const { hasPermission } = useAuth();
  const canCreatePurchaseOrders = hasPermission('purchase_orders_create');
  
  const handleAddPurchaseOrder = () => {
    setEditingPurchaseOrder(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    setEditingPurchaseOrder(purchaseOrder);
    setIsDialogOpen(true);
  };
  
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
      
      <PurchaseOrderTable onEdit={handleEditPurchaseOrder} />
      
      <PurchaseOrderDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        purchaseOrder={editingPurchaseOrder}
      />
      </div>
    </PermissionGuard>
  );
};

export default PurchaseOrdersPage;
