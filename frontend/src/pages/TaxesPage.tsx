
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaxDialog } from "@/components/taxes/TaxDialog";
import { TaxTable } from "@/components/taxes/TaxTable";
import { type Tax } from "@/types/tax";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createTax, updateTax } from "@/lib/api";
import { toast } from "sonner";

const TaxesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
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
      window.location.reload();
    } catch (error) {
      console.error('Error saving tax:', error);
      toast.error(`Failed to ${editingTax ? 'update' : 'create'} tax`);
    }
  };
  
  return (
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
      
      <TaxTable onEdit={handleEditTax} />
      
      <TaxDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        tax={editingTax}
        onSubmit={handleTaxSubmit}
      />
    </div>
  );
};

export default TaxesPage;
