
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
import { Search, Edit, Trash, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';

type Product = {
  id: string;
  sku_code: string;
  name: string;
  description?: string;
  categories?: { name: string };
  units?: { name: string; abbreviation: string };
  cost_price?: number;
  selling_price?: number;
  stock_levels?: Array<{ quantity_on_hand: number; quantity_available: number }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Add props type definition for the component
type ProductTableProps = {
  onEdit?: (product: Product) => void;
};

const ITEMS_PER_PAGE = 20; // Limit items per page for better performance

export const ProductTable = ({ onEdit }: ProductTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { currency, getCurrencySymbol } = useCurrencyStore();
  const { hasPermission } = useAuth();
  const canEditProducts = hasPermission('products_edit');
  const canDeleteProducts = hasPermission('products_delete');

  // Calculate offset for pagination
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Test query to check if products table exists and has data
  useEffect(() => {
    const testQuery = async () => {
      try {
        console.log('Testing basic products query...');
        const testResult = await supabase
          .from('products')
          .select('id, name, sku_code')
          .limit(1);
        
        console.log('Test query result:', testResult);
        
        if (testResult.error) {
          console.error('Test query failed:', testResult.error);
        } else {
          console.log('Test query succeeded, found products:', testResult.data?.length || 0);
        }
      } catch (err) {
        console.error('Test query exception:', err);
      }
    };
    
    testQuery();
  }, []);

  // Fetch products with pagination and proper error handling
  const { data: products, isLoading, error } = useSupabaseQuery(
    ['products', currentPage.toString(), searchTerm],
    async () => {
      try {
        console.log('Attempting to fetch products with relationships...');
        let query = supabase
          .from('products')
          .select(`
            *,
            categories(name),
            units(name, abbreviation),
            stock_levels(quantity_on_hand, quantity_available)
          `);

        // Apply search filter if search term exists
        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
        }

        // Apply pagination
        const result = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
        
        if (result.error) {
          console.error('Full query failed with error:', result.error);
          console.log('Trying basic query without relationships...');
          // Fallback to basic query without relationships
          let basicQuery = supabase
            .from('products')
            .select('*');
          
          if (searchTerm.trim()) {
            basicQuery = basicQuery.or(`name.ilike.%${searchTerm}%,sku_code.ilike.%${searchTerm}%`);
          }
          
          const basicResult = await basicQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + ITEMS_PER_PAGE - 1);
          
          if (basicResult.error) {
            console.error('Basic query also failed with error:', basicResult.error);
            console.log('Trying final fallback without ordering...');
            // Final fallback - try without any ordering
            let finalQuery = supabase.from('products').select('*');
            
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
      }
    },
    {
      staleTime: 60000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (fixed from cacheTime)
    }
  );

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination info
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Handle error state
  if (error) {
    return (
      <div className="rounded-md border p-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading products</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unable to fetch products. Please try again.'}
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
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
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
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
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
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        On Hand: {product.stock_levels?.[0]?.quantity_on_hand || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Available: {product.stock_levels?.[0]?.quantity_available || 0}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEditProducts ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit && onEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button variant="ghost" size="icon" disabled>
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
                      <Button variant="ghost" size="icon">
                        <Trash className="h-4 w-4" />
                      </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button variant="ghost" size="icon" disabled>
                                  <Trash className="h-4 w-4" />
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
    </div>
  );
};
