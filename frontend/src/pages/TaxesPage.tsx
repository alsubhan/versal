
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { TaxDialog } from "@/components/taxes/TaxDialog";
import { TaxTable } from "@/components/taxes/TaxTable";
import { type Tax } from "@/types/tax";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createTax, updateTax } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/ui/permission-guard";

const TaxesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasPermission } = useAuth();
  const canCreateTaxes = hasPermission('taxes_create');
  
  const handleAddTax = () => {
    setEditingTax(null);
    setIsDialogOpen(true);
  };
  
  const handleEditTax = (tax: Tax) => {
    setEditingTax(tax);
    setIsDialogOpen(true);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleTaxSubmit = async (tax: Tax) => {
    try {
      if (editingTax) {
        await updateTax(editingTax.id, tax);
        toast.success(`Tax "${tax.name}" updated successfully`);
      } else {
        await createTax(tax);
        toast.success(`Tax "${tax.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table
      handleRefresh();
    } catch (error: any) {
      console.error('Error saving tax:', error);
      if (error.status === 409) {
        toast.error(error.message || 'A tax with this name already exists');
      } else {
        toast.error(`Failed to ${editingTax ? 'update' : 'create'} tax`);
      }
      // Don't close dialog or refresh on error
      return;
    }
  };
  
  return (
    <PermissionGuard 
      requiredPermission="taxes_view"
      fallbackMessage="You do not have permission to view taxes. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Tax Rates</h1>
          {canCreateTaxes ? (
        <Button 
          onClick={handleAddTax}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Tax Rate
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
                    <Plus className="h-4 w-4" /> Add Tax Rate
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create tax rates
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search taxes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <TaxTable 
        key={refreshKey}
        onEdit={handleEditTax} 
        searchTerm={searchTerm} 
        onRefresh={handleRefresh}
      />
      
      <TaxDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        tax={editingTax}
        onSubmit={handleTaxSubmit}
      />
      </div>
    </PermissionGuard>
  );
};

export default TaxesPage;
