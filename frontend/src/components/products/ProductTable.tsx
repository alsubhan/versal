
import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Edit, Trash, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { apiFetch } from '@/lib/api';
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Product = {
  id: string;
  sku_code: string;
  hsn_code: string;
  name: string;
  description?: string;
  categories?: { name: string };
  units?: { name: string; abbreviation: string };
  cost_price?: number;
  selling_price?: number;
  sale_price?: number;
  mrp?: number;
  stock_levels?: Array<{ quantity_on_hand: number; quantity_available: number }> | { quantity_on_hand: number; quantity_available: number };
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Add props type definition for the component
type ProductTableProps = {
  onEdit?: (product: Product) => void;
  onRefresh?: () => void;
};

const ITEMS_PER_PAGE = 20; // Limit items per page for better performance

export const ProductTable = ({ onEdit, onRefresh }: ProductTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const { currency, getCurrencySymbol } = useCurrencyStore();
  const { hasPermission } = useAuth();
  const canEditProducts = hasPermission('products_edit');
  const canDeleteProducts = hasPermission('products_delete');

  // Calculate offset for pagination
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Fetch products from backend API
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await apiFetch('/products');
      
      // Check if the response is an error
      if (data && data.error) {
        setError(data.detail || 'Failed to fetch products');
        setProducts([]);
        setTotalCount(0);
        return;
      }
      
      if (data && Array.isArray(data)) {
        console.log('Products fetched:', data.length, 'products');
        console.log('Sample product:', data[0]);
        
        // Process products to ensure stock_levels is always an array
        const processedProducts = data.map(product => {
          // Handle stock_levels - ensure it's an array
          let stockLevels = product.stock_levels;
          if (stockLevels && !Array.isArray(stockLevels)) {
            stockLevels = [stockLevels];
          } else if (!stockLevels) {
            stockLevels = [];
          }
          
          return {
            ...product,
            stock_levels: stockLevels
          };
        });
        
        // Apply search filter if search term exists
        let filteredProducts = processedProducts;
        if (searchTerm.trim()) {
          filteredProducts = processedProducts.filter(product => 
            product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku_code?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        // Apply pagination
        const paginatedProducts = filteredProducts.slice(offset, offset + ITEMS_PER_PAGE);
        
        setProducts(paginatedProducts);
        setTotalCount(filteredProducts.length);
      } else {
        setProducts([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete product
  const handleOpenDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      const response = await apiFetch(`/products/${selectedProduct.id}`, {
        method: 'DELETE'
      });
      
      if (response && response.error) {
        console.error('Error deleting product:', response.detail);
        toast.error('Failed to delete product: ' + response.detail);
      } else {
        console.log('Product deleted successfully');
        toast.success('Product deleted successfully');
        // Refresh the products list
        fetchProducts();
      }
    } catch (err: any) {
      console.error('Error deleting product:', err);
      toast.error('Failed to delete product');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProduct(undefined);
    }
  };

  // Fetch products when component mounts or search term changes
  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Handle error state
  if (error) {
    return (
      <div className="rounded-md border p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading products</p>
          <p className="text-sm text-muted-foreground">
            {error || 'Unable to fetch products. Please try again.'}
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Retail</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Retail</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products && products.length > 0 ? (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-muted-foreground">
                          {product.description.substring(0, 50)}...
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {product.sku_code}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {product.hsn_code || '-'}
                  </TableCell>
                  <TableCell>
                    {product.categories?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {product.units ? `${product.units.name} (${product.units.abbreviation})` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.cost_price || 0, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.selling_price || 0, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.sale_price || 0, currency)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        On Hand: {Array.isArray(product.stock_levels) ? product.stock_levels?.[0]?.quantity_on_hand : product.stock_levels?.quantity_on_hand || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Available: {Array.isArray(product.stock_levels) ? product.stock_levels?.[0]?.quantity_available : product.stock_levels?.quantity_available || 0}
                      </div>

                    </div>
                  </TableCell>
                  <TableCell>
                    {product.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEditProducts ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit && onEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to edit products
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {canDeleteProducts ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to delete products
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-4 text-muted-foreground">
                  No products found. Add a new product to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + ITEMS_PER_PAGE, totalCount || 0)} of {totalCount || 0} products
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product "{selectedProduct?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
