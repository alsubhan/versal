
import { useState } from "react";
import { UnitTable } from "@/components/units/UnitTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { type Unit } from "@/types/unit";
import { UnitDialog } from "@/components/units/UnitDialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createUnit, updateUnit } from "@/lib/api";
import { PermissionGuard } from "@/components/ui/permission-guard";

const UnitsPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const { hasPermission } = useAuth();
  const canCreateUnits = hasPermission('units_create');
  
  const handleAddUnit = () => {
    setEditingUnit(null);
    setIsDialogOpen(true);
  };
  
  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setIsDialogOpen(true);
  };
  
  const handleUnitSubmit = async (formData: any) => {
    try {
      // Convert form data to the expected format
      const unitData = {
        name: formData.name,
        abbreviation: formData.abbreviation,
        description: formData.description,
        isActive: formData.is_active
      };

      if (editingUnit) {
        await updateUnit(editingUnit.id, unitData);
        toast.success(`Unit "${formData.name}" updated successfully`);
      } else {
        await createUnit(unitData);
        toast.success(`Unit "${formData.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table by triggering a page reload or state update
      window.location.reload();
    } catch (error: any) {
      console.error('Error saving unit:', error);
      if (error.status === 409) {
        toast.error(error.message || 'A unit with this name already exists');
      } else {
        toast.error(`Failed to ${editingUnit ? 'update' : 'create'} unit`);
      }
      // Don't close dialog or refresh on error
      return;
    }
  };
  
  return (
    <PermissionGuard 
      requiredPermission="units_view"
      fallbackMessage="You do not have permission to view units. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          {canCreateUnits ? (
        <Button 
          onClick={handleAddUnit}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Unit
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
                    <Plus className="h-4 w-4" /> Add Unit
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create units
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <UnitTable onEdit={handleEditUnit} />
      
      <UnitDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        unit={editingUnit}
        onSubmit={handleUnitSubmit}
      />
    </div>
    </PermissionGuard>
  );
};

export default UnitsPage;
