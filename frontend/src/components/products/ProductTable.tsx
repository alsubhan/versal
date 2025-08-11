
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
import { Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { performanceMonitor } from '@/lib/performance';
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
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog';

type Product = {
  id: string;
  sku_code: string;
  hsn_code: string;
  name: string;
  description?: string;
  barcode?: string;
  category_id?: string;
  subcategory_id?: string;
  unit_id?: string;
  categories?: { name: string };
  units?: { name: string; abbreviation: string };
  cost_price?: number;
  selling_price?: number;
  sale_price?: number;
  mrp?: number;
  initial_quantity?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_point?: number;
  supplier_id?: string;
  sale_tax_id?: string;
  sale_tax_type?: string;
  purchase_tax_id?: string;
  purchase_tax_type?: string;
  discount_percentage?: number;
  manufacturer?: string;
  brand?: string;
  manufacturer_part_number?: string;
  warranty_period?: number;
  warranty_unit?: string;
  product_tags?: string[];
  is_serialized?: boolean;
  track_inventory?: boolean;
  allow_override_price?: boolean;
  warehouse_rack?: string;
  unit_conversions?: any;
  stock_levels?: Array<{ quantity_on_hand: number; quantity_available: number }> | { quantity_on_hand: number; quantity_available: number };
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Add props type definition for the component
type ProductTableProps = {
  onEdit?: (product: Product) => void;
  onRefresh?: () => void;
  searchTerm?: string;
};

const ITEMS_PER_PAGE = 20; // Limit items per page for better performance

// Sortable header component
const SortableHeader = ({ 
  field, 
  children, 
  sortField, 
  sortDirection, 
  onSort, 
  className = "" 
}: {
  field: string;
  children: React.ReactNode;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}) => {
  const isActive = sortField === field;
  
  return (
    <TableHead 
      className={`cursor-pointer select-none hover:bg-gray-50 ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <div className="flex flex-col">
          <ChevronUp 
            className={`h-3 w-3 ${isActive && sortDirection === "asc" ? "text-blue-600" : "text-gray-400"}`} 
          />
          <ChevronDown 
            className={`h-3 w-3 -mt-1 ${isActive && sortDirection === "desc" ? "text-blue-600" : "text-gray-400"}`} 
          />
        </div>
      </div>
    </TableHead>
  );
};

export const ProductTable = ({ onEdit, onRefresh, searchTerm = "" }: ProductTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency, getCurrencySymbol } = useCurrencyStore();
  const { hasPermission } = useAuth();
  const canEditProducts = hasPermission('products_edit');
  const canDeleteProducts = hasPermission('products_delete');

  // Calculate offset for pagination
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Test query to check if products table exists and has data
  useEffect(() => {
    const testQuery = async () => {
      performanceMonitor.startTimer('product-table-test-query');
      try {
        console.log('Testing basic products query...');
        const testResult = await supabase
          .from('products')
          .select('id, name')
          .limit(1);
        
        console.log('Test query result:', testResult);
        
        if (testResult.error) {
          console.error('Test query failed:', testResult.error);
        } else {
          console.log('Test query succeeded, found products:', testResult.data?.length || 0);
        }
      } catch (err) {
        console.error('Test query exception:', err);
      } finally {
        performanceMonitor.endTimer('product-table-test-query');
      }
    };
    
    testQuery();
  }, []);

  // Fetch products with pagination and proper error handling
  const { data: products, isLoading, error, refetch } = useSupabaseQuery(
    ['products', currentPage.toString(), searchTerm, sortField, sortDirection],
    async () => {
      performanceMonitor.startTimer('product-table-main-query');
      try {
        console.log('Attempting to fetch products with relationships...');
        let query = supabase
          .from('products')
          .select(`
            id,
            name,
            description,
            sku_code,
            barcode,
            category_id,
            subcategory_id,
            unit_id,
            cost_price,
            selling_price,
            minimum_stock,
            maximum_stock,
            reorder_point,
            is_active,
            created_at,
            updated_at,
            hsn_code,
            mrp,
            sale_price,
            initial_quantity,
            supplier_id,
            sale_tax_id,
            sale_tax_type,
            purchase_tax_id,
            purchase_tax_type,
            discount_percentage,
            manufacturer,
            brand,
            manufacturer_part_number,
            warranty_period,
            warranty_unit,
            product_tags,
            is_serialized,
            track_inventory,
            allow_override_price,
            warehouse_rack,
            unit_conversions,
            categories:category_id(name),
            units:unit_id(name, abbreviation),
            stock_levels(quantity_on_hand, quantity_available)
          `);

        // Apply search filter if search term exists
        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
        }

        // Apply pagination with sorting
        const result = await query
          .order(sortField, { ascending: sortDirection === "asc" })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
        
        if (result.error) {
          console.error('Full query failed with error:', result.error);
          console.log('Trying basic query without relationships...');
          // Fallback to basic query without relationships
          let basicQuery = supabase
            .from('products')
            .select(`
              id,
              name,
              description,
              sku_code,
              barcode,
              category_id,
              subcategory_id,
              unit_id,
              cost_price,
              selling_price,
              minimum_stock,
              maximum_stock,
              reorder_point,
              is_active,
              created_at,
              updated_at,
              hsn_code,
              mrp,
              sale_price,
              initial_quantity,
              supplier_id,
              sale_tax_id,
              sale_tax_type,
              purchase_tax_id,
              purchase_tax_type,
              discount_percentage,
              manufacturer,
              brand,
              manufacturer_part_number,
              warranty_period,
              warranty_unit,
              product_tags,
              is_serialized,
              track_inventory,
              allow_override_price,
              warehouse_rack,
              unit_conversions
            `);
          
          if (searchTerm.trim()) {
            basicQuery = basicQuery.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
          }
          
          const basicResult = await basicQuery
            .order(sortField, { ascending: sortDirection === "asc" })
            .range(offset, offset + ITEMS_PER_PAGE - 1);
          
          if (basicResult.error) {
            console.error('Basic query also failed with error:', basicResult.error);
            console.log('Trying final fallback without ordering...');
            // Final fallback - try without any ordering
            let finalQuery = supabase.from('products').select(`
              id,
              name,
              description,
              sku_code,
              barcode,
              category_id,
              subcategory_id,
              unit_id,
              cost_price,
              selling_price,
              minimum_stock,
              maximum_stock,
              reorder_point,
              is_active,
              created_at,
              updated_at,
              hsn_code,
              mrp,
              sale_price,
              initial_quantity,
              supplier_id,
              sale_tax_id,
              sale_tax_type,
              purchase_tax_id,
              purchase_tax_type,
              discount_percentage,
              manufacturer,
              brand,
              manufacturer_part_number,
              warranty_period,
              warranty_unit,
              product_tags,
              is_serialized,
              track_inventory,
              allow_override_price,
              warehouse_rack,
              unit_conversions
            `);
            
            if (searchTerm.trim()) {
              finalQuery = finalQuery.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
            }
            
            const finalResult = await finalQuery.range(offset, offset + ITEMS_PER_PAGE - 1);
            
            if (finalResult.error) {
              console.error('Final fallback also failed:', finalResult.error);
              throw finalResult.error;
            }
            
            console.log('Final fallback succeeded, returning basic data');
            return finalResult;
          }
          
          console.log('Basic query succeeded, returning data without relationships');
          return basicResult;
        }
        
        console.log('Full query succeeded with relationships');
        return result;
      } catch (err) {
        console.error('Query error:', err);
        throw err;
      } finally {
        performanceMonitor.endTimer('product-table-main-query');
      }
    },
    {
      // Add caching and stale time to reduce unnecessary refetches
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (fixed from cacheTime)
    }
  );

  // Get total count for pagination
  const { data: totalCount } = useSupabaseQuery(
    ['products-count', searchTerm],
    async () => {
      performanceMonitor.startTimer('product-table-count-query');
      try {
        let query = supabase
          .from('products')
          .select('id', { count: 'exact', head: true });

        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
        }

        const result = await query;
        return result.count || 0;
      } catch (err) {
        console.error('Count query error:', err);
        return 0;
      } finally {
        performanceMonitor.endTimer('product-table-count-query');
      }
    },
    {
      staleTime: 60000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (fixed from cacheTime)
    }
  );

  // Reset to first page when search term or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortDirection]);

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handler to open delete confirmation dialog
  const handleOpenDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  // Handler to delete a product
  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error deleting product:', error);
        // You might want to show a toast notification here
        return;
      }

      // Close dialog and refresh data
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      // You might want to show a toast notification here
    }
  };

  const handlePrintProduct = (product: Product) => {
    setPrintingProduct(product);
    setPrintDialogOpen(true);
  };

  // Calculate pagination info
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Monitor component render performance
  useEffect(() => {
    performanceMonitor.startTimer('product-table-render');
    return () => {
      performanceMonitor.endTimer('product-table-render');
    };
  });

  // Handle error state
  if (error) {
    return (
      <div className="rounded-md border p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading products</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unable to fetch products. Please try again.'}
          </p>
          <div className="flex gap-2 mt-4 justify-center">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
            >
              Retry Query
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
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
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Product
              </SortableHeader>
              <SortableHeader field="sku_code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                SKU
              </SortableHeader>
              <SortableHeader field="category_id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Category
              </SortableHeader>
              <SortableHeader field="quantity_on_hand" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Stock
              </SortableHeader>
              <SortableHeader field="unit_id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Unit
              </SortableHeader>
              <SortableHeader field="cost_price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">
                Cost Price
              </SortableHeader>
              <SortableHeader field="sale_price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">
                Sale Price
              </SortableHeader>
              <SortableHeader field="is_active" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                Status
              </SortableHeader>
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
                  <TableCell>
                    {product.categories?.name || product.category_id || '-'}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            {(() => {
                              // Calculate consolidated stock across all locations
                              let totalOnHand = 0;
                              let totalAvailable = 0;
                              
                              if (Array.isArray(product.stock_levels)) {
                                product.stock_levels.forEach(level => {
                                  totalOnHand += level.quantity_on_hand || 0;
                                  totalAvailable += level.quantity_available || 0;
                                });
                              } else if (product.stock_levels) {
                                totalOnHand = product.stock_levels.quantity_on_hand || 0;
                                totalAvailable = product.stock_levels.quantity_available || 0;
                              }
                              
                              return (
                                <span className={`font-medium ${totalOnHand > 0 && totalOnHand !== totalAvailable ? 'text-orange-600' : ''}`}>
                                  {totalOnHand}
                                  {totalOnHand > 0 && totalOnHand !== totalAvailable && (
                                    <span className="ml-1 text-xs text-muted-foreground">ⓘ</span>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            {(() => {
                              // Calculate consolidated stock across all locations
                              let totalOnHand = 0;
                              let totalAvailable = 0;
                              
                              if (Array.isArray(product.stock_levels)) {
                                product.stock_levels.forEach(level => {
                                  totalOnHand += level.quantity_on_hand || 0;
                                  totalAvailable += level.quantity_available || 0;
                                });
                              } else if (product.stock_levels) {
                                totalOnHand = product.stock_levels.quantity_on_hand || 0;
                                totalAvailable = product.stock_levels.quantity_available || 0;
                              }
                              
                              return (
                                <>
                                  <div className="font-medium">Stock Details</div>
                                  <div>Total: {totalOnHand} units</div>
                                  <div>Available: {totalAvailable} units</div>
                                  {totalOnHand > 0 && totalOnHand !== totalAvailable && (
                                    <div className="text-orange-600">
                                      Reserved: {totalOnHand - totalAvailable} units
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {product.units ? `${product.units.name} (${product.units.abbreviation})` : (product.unit_id || '-')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.cost_price || 0, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.sale_price || 0, currency)}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintProduct(product)}
                        title="Print Product"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
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

      <PrintPreviewDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        documentType="product"
        data={printingProduct}
      />
    </div>
  );
};
