
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierTable } from "@/components/suppliers/SupplierTable";
import { type Supplier } from "@/types/supplier";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createSupplier, updateSupplier } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/ui/permission-guard";

const SuppliersPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasPermission } = useAuth();
  const canCreateSuppliers = hasPermission('suppliers_create');
  
  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsDialogOpen(true);
  };
  
  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSupplierSubmit = async (supplier: Supplier) => {
    try {
      console.log("SuppliersPage - handleSupplierSubmit called with:", supplier);
      if (editingSupplier) {
        console.log("Updating supplier with ID:", editingSupplier.id);
        await updateSupplier(editingSupplier.id, supplier);
        toast.success(`Supplier "${supplier.name}" updated successfully`);
      } else {
        console.log("Creating new supplier");
        await createSupplier(supplier);
        toast.success(`Supplier "${supplier.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table
      handleRefresh();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      if (error.status === 409) {
        toast.error(error.message || 'A supplier with this name already exists');
      } else {
        toast.error(`Failed to ${editingSupplier ? 'update' : 'create'} supplier`);
      }
      // Don't close dialog or refresh on error
      return;
    }
  };
  
  return (
    <PermissionGuard 
      requiredPermission="suppliers_view"
      fallbackMessage="You do not have permission to view suppliers. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          {canCreateSuppliers ? (
        <Button 
          onClick={handleAddSupplier}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Supplier
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
                    <Plus className="h-4 w-4" /> Add Supplier
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create suppliers
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <SupplierTable 
        key={refreshKey}
        onEdit={handleEditSupplier} 
        searchTerm={searchTerm} 
        onRefresh={handleRefresh}
      />
      
      <SupplierDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        supplier={editingSupplier}
        onSubmit={handleSupplierSubmit}
      />
    </div>
    </PermissionGuard>
  );
};

export default SuppliersPage;
