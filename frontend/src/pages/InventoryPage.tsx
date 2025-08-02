
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockLevelTable } from "@/components/inventory/StockLevelTable";
import { StockLevelDialog } from "@/components/inventory/StockLevelDialog";
import { InventoryMovementsTable } from "@/components/inventory/InventoryMovementsTable";
import { InventoryMovementDialog } from "@/components/inventory/InventoryMovementDialog";
import { LocationsTable } from "@/components/inventory/LocationsTable";
import { LocationDialog } from "@/components/inventory/LocationDialog";
import { InventoryTransactionsTable } from "@/components/inventory/InventoryTransactionsTable";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState("stock-levels");
  const [stockLevelDialogOpen, setStockLevelDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingStockLevel, setEditingStockLevel] = useState<any>(null);
  const { hasPermission } = useAuth();
  
  const canCreateStockLevel = hasPermission('inventory_stock_create');
  const canCreateMovement = hasPermission('inventory_movement_create');
  const canCreateLocation = hasPermission('inventory_location_create');

  const handleEditStockLevel = (stockLevel: any) => {
    setEditingStockLevel(stockLevel);
    setStockLevelDialogOpen(true);
  };

  return (
    <PermissionGuard 
      requiredPermission="inventory_view"
      fallbackMessage="You do not have permission to view inventory. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stock-levels">Stock Levels</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="stock-levels" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Stock Levels</CardTitle>
                    <CardDescription>
                      Manage product stock levels across different locations
                    </CardDescription>
                  </div>
                                     {canCreateStockLevel && (
                     <StockLevelDialog 
                       open={stockLevelDialogOpen} 
                       onOpenChange={setStockLevelDialogOpen}
                       stockLevel={editingStockLevel}
                       onSuccess={() => {
                         setStockLevelDialogOpen(false);
                         setEditingStockLevel(null);
                         // Refresh the table
                         window.location.reload();
                       }}
                     />
                   )}
                 </div>
               </CardHeader>
               <CardContent>
                 <StockLevelTable onEdit={handleEditStockLevel} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Inventory Movements</CardTitle>
                    <CardDescription>
                      Track all inventory movements and adjustments
                    </CardDescription>
                  </div>
                  {canCreateMovement && (
                    <InventoryMovementDialog 
                      open={movementDialogOpen} 
                      onOpenChange={setMovementDialogOpen}
                      onSuccess={() => {
                        setMovementDialogOpen(false);
                        // Refresh the table
                        window.location.reload();
                      }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <InventoryMovementsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Locations</CardTitle>
                    <CardDescription>
                      Manage warehouse locations and storage areas
                    </CardDescription>
                  </div>
                  {canCreateLocation && (
                    <LocationDialog 
                      open={locationDialogOpen} 
                      onOpenChange={setLocationDialogOpen}
                      onSuccess={() => {
                        setLocationDialogOpen(false);
                        // Refresh the table
                        window.location.reload();
                      }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <LocationsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Inventory Transactions</CardTitle>
                  <CardDescription>
                    View detailed inventory transaction history
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <InventoryTransactionsTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default InventoryPage;
