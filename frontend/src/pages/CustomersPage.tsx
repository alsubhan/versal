
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { type Customer } from "@/types/customer";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createCustomer, updateCustomer } from "@/lib/api";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/ui/permission-guard";

const CustomersPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { hasPermission } = useAuth();
  const canCreateCustomers = hasPermission('customers_create');
  
  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsDialogOpen(true);
  };
  
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleCustomerSubmit = async (customer: Customer) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customer);
        toast.success(`Customer "${customer.name}" updated successfully`);
      } else {
        await createCustomer(customer);
        toast.success(`Customer "${customer.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table
      window.location.reload();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(`Failed to ${editingCustomer ? 'update' : 'create'} customer`);
    }
  };
  
  return (
    <PermissionGuard 
      requiredPermission="customers_view"
      fallbackMessage="You do not have permission to view customers. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          {canCreateCustomers ? (
            <Button 
              onClick={handleAddCustomer}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add Customer
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
                      <Plus className="h-4 w-4" /> Add Customer
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to create customers
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CustomerTable onEdit={handleEditCustomer} />
        <CustomerDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          customer={editingCustomer}
          onSubmit={handleCustomerSubmit}
        />
      </div>
    </PermissionGuard>
  );
};

export default CustomersPage;
