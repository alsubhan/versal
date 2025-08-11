
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
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

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCustomerSubmit = async (customer: Customer) => {
    try {
      console.log("CustomersPage - handleCustomerSubmit called with:", customer);
      if (editingCustomer) {
        console.log("Updating customer with ID:", editingCustomer.id);
        await updateCustomer(editingCustomer.id, customer);
        toast.success(`Customer "${customer.name}" updated successfully`);
      } else {
        console.log("Creating new customer");
        await createCustomer(customer);
        toast.success(`Customer "${customer.name}" created successfully`);
      }
      setIsDialogOpen(false);
      // Refresh the table
      handleRefresh();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      if (error.status === 409) {
        toast.error(error.message || 'A customer with this name already exists');
      } else {
        toast.error(`Failed to ${editingCustomer ? 'update' : 'create'} customer`);
      }
      // Don't close dialog or refresh on error
      return;
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
        
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <CustomerTable 
          key={refreshKey}
          onEdit={handleEditCustomer} 
          searchTerm={searchTerm} 
          onRefresh={handleRefresh}
        />
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
