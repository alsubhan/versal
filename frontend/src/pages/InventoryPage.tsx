
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockLevelTable } from "@/components/inventory/StockLevelTable";
import { InventoryMovementsTable } from "@/components/inventory/InventoryMovementsTable";
import { InventoryTransactionsTable } from "@/components/inventory/InventoryTransactionsTable";
import { LocationsTable } from "@/components/inventory/LocationsTable";
import { StockLevelDialog } from "@/components/inventory/StockLevelDialog";
import { InventoryMovementDialog } from "@/components/inventory/InventoryMovementDialog";
import { LocationDialog } from "@/components/inventory/LocationDialog";
import { type StockLevel } from "@/types/inventory";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState("stock-levels");
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingStockLevel, setEditingStockLevel] = useState<StockLevel | null>(null);
  
  const { hasPermission } = useAuth();
  const canViewInventory = hasPermission('inventory_view');
  const canViewStock = hasPermission('inventory_stock_view');
  const canManageStock = hasPermission('inventory_stock_manage');
  const canViewMovements = hasPermission('inventory_movements_view');
  const canCreateMovements = hasPermission('inventory_movements_create');
  const canViewLocations = hasPermission('inventory_locations_view');
  const canManageLocations = hasPermission('inventory_locations_manage');

  // If user doesn't have permission to view inventory, show access denied
  if (!canViewInventory) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view inventory. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleAddStockLevel = () => {
    setEditingStockLevel(null);
    setIsStockDialogOpen(true);
  };
  
  const handleEditStockLevel = (stockLevel: StockLevel) => {
    setEditingStockLevel(stockLevel);
    setIsStockDialogOpen(true);
  };
  
  const handleAddMovement = () => {
    setIsMovementDialogOpen(true);
  };
  
  const handleAddLocation = () => {
    setIsLocationDialogOpen(true);
  };

  // Callback functions to refresh tables after successful operations
  const handleStockLevelSuccess = () => {
    // The StockLevelTable will refresh itself via the onSuccess callback
  };

  const handleMovementSuccess = () => {
    // The InventoryMovementsTable will refresh itself via the onSuccess callback
  };

  const handleLocationSuccess = () => {
    // The LocationsTable will refresh itself via the onSuccess callback
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
        
        {activeTab === "stock-levels" && (
          canManageStock ? (
          <Button 
            onClick={handleAddStockLevel}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Update Stock
          </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-1">
                      <Plus className="h-4 w-4" /> Update Stock
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to manage stock levels
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        )}
        
        {activeTab === "movements" && (
          canCreateMovements ? (
          <Button 
            onClick={handleAddMovement}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Record Movement
          </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-1">
                      <Plus className="h-4 w-4" /> Record Movement
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to record inventory movements
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        )}
        
        {activeTab === "transactions" && (
          <div className="text-sm text-gray-500">
            Transactions are automatically created when inventory changes occur
          </div>
        )}
        
        {activeTab === "locations" && (
          canManageLocations ? (
          <Button 
            onClick={handleAddLocation}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Add Location
          </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-1">
                      <Plus className="h-4 w-4" /> Add Location
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to manage locations
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="stock-levels" disabled={!canViewStock}>Stock Levels</TabsTrigger>
          <TabsTrigger value="transactions" disabled={!canViewMovements}>Transactions</TabsTrigger>
          <TabsTrigger value="movements" disabled={!canViewMovements}>Movements</TabsTrigger>
          <TabsTrigger value="locations" disabled={!canViewLocations}>Locations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="stock-levels">
          {canViewStock ? (
            <>
              <StockLevelTable onEdit={handleEditStockLevel} canEdit={canManageStock} />
              
              <StockLevelDialog 
                open={isStockDialogOpen} 
                onOpenChange={setIsStockDialogOpen}
                stockLevel={editingStockLevel}
                onSuccess={handleStockLevelSuccess}
              />
            </>
          ) : (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You do not have permission to view stock levels.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="transactions">
          {canViewMovements ? (
            <InventoryTransactionsTable />
          ) : (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You do not have permission to view inventory transactions.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="movements">
          {canViewMovements ? (
            <>
              <InventoryMovementsTable />
              
              <InventoryMovementDialog 
                open={isMovementDialogOpen} 
                onOpenChange={setIsMovementDialogOpen}
                onSuccess={handleMovementSuccess}
              />
            </>
          ) : (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You do not have permission to view inventory movements.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="locations">
          {canViewLocations ? (
            <>
              <LocationsTable />
              
              <LocationDialog 
                open={isLocationDialogOpen} 
                onOpenChange={setIsLocationDialogOpen}
                onSuccess={handleLocationSuccess}
              />
            </>
          ) : (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You do not have permission to view locations.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryPage;
