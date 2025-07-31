
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { SupplierTable } from "@/components/suppliers/SupplierTable";
import { type Supplier } from "@/types/supplier";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createSupplier, updateSupplier } from "@/lib/api";
import { toast } from "sonner";

const SuppliersPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
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

  const handleSupplierSubmit = async (supplier: Supplier) => {
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, supplier);
        toast.success(`Supplier "${supplier.name}" updated successfully`);
      } else {
        await createSupplier(supplier);
        toast.success(`Supplier "${supplier.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table
      window.location.reload();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error(`Failed to ${editingSupplier ? 'update' : 'create'} supplier`);
    }
  };
  
  return (
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
      
      <SupplierTable onEdit={handleEditSupplier} />
      
      <SupplierDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        supplier={editingSupplier}
        onSubmit={handleSupplierSubmit}
      />
    </div>
  );
};

export default SuppliersPage;
