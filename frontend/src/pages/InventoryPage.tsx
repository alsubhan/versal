
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const { hasPermission } = useAuth();
  
  const canCreateStockLevel = hasPermission('inventory_stock_manage');
  const canCreateMovement = hasPermission('inventory_movements_create');
  const canCreateLocation = hasPermission('inventory_locations_manage');



  const handleEditStockLevel = (stockLevel: any) => {
    setEditingStockLevel(stockLevel);
    setStockLevelDialogOpen(true);
  };

  const handleEditLocation = (location: any) => {
    setEditingLocation(location);
    setLocationDialogOpen(true);
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
                      Manage product stock levels across different locations. Use "Edit" to modify existing stock levels or "Add Stock Level" to create new ones.
                    </CardDescription>
                  </div>
                  {canCreateStockLevel && (
                    <Button 
                      onClick={() => {
                        setEditingStockLevel(null); // Reset to null for new stock level
                        setStockLevelDialogOpen(true);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add Stock Level
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <StockLevelTable onEdit={handleEditStockLevel} />
              </CardContent>
            </Card>
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
                    <Button 
                      onClick={() => setMovementDialogOpen(true)}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Record Movement
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <InventoryMovementsTable />
              </CardContent>
            </Card>
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
                    <Button 
                      onClick={() => setLocationDialogOpen(true)}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add Location
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <LocationsTable onEdit={handleEditLocation} />
              </CardContent>
            </Card>
            {canCreateLocation && (
              <LocationDialog 
                open={locationDialogOpen} 
                onOpenChange={setLocationDialogOpen}
                location={editingLocation}
                onSuccess={() => {
                  setLocationDialogOpen(false);
                  setEditingLocation(null);
                  // Refresh the table
                  window.location.reload();
                }}
              />
            )}
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
