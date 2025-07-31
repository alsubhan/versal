
import { useState } from "react";
import { ProductTable } from "@/components/products/ProductTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductDialog } from "@/components/products/ProductDialog";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

// Define a more complete Product interface to match what's used in ProductTable
export interface Product {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  price?: number;
  quantity?: number;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductsPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { hasPermission } = useAuth();
  const canViewProducts = hasPermission('products_view');
  const canCreateProducts = hasPermission('products_create');

  if (!canViewProducts) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view products. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };
  
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        {canCreateProducts ? (
        <Button 
          onClick={handleAddProduct}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Product
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
                    <Plus className="h-4 w-4" /> Add Product
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create products
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {/* Pass onEdit prop properly to ProductTable component */}
      <ProductTable onEdit={handleEditProduct} />
      
      <ProductDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
      />
    </div>
  );
};

export default ProductsPage;
