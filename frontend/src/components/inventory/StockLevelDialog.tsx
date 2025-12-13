
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { type StockLevel } from "@/types/inventory";
import { createStockLevel, updateStockLevel, getProducts, getLocations, getStockLevels } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().min(1, "Location is required"),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  quantityReserved: z.number().min(0, "Reserved quantity must be 0 or greater"),
  serialNumbers: z.string().optional(),
}).refine((data) => {
  // For serialized products, serial numbers are required
  // Validation will be done in component based on selected product
  return true;
});

type FormValues = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku_code: string;
  is_serialized?: boolean;
}

interface Location {
  id: string;
  name: string;
}

interface StockLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockLevel: StockLevel | null;
  onSuccess?: () => void;
}

export function StockLevelDialog({ open, onOpenChange, stockLevel, onSuccess }: StockLevelDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      locationId: "",
      quantity: 0,
      quantityReserved: 0,
      serialNumbers: "",
    },
  });

  // Watch productId to update selectedProduct
  const watchedProductId = form.watch("productId");
  const watchedQuantity = form.watch("quantity");

  const fetchData = useCallback(async () => {
    try {
      setFetchingData(true);
      const [productsData, locationsData] = await Promise.all([
        getProducts(),
        getLocations()
      ]);
      setProducts(productsData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load products and locations",
        variant: "destructive"
      });
    } finally {
      setFetchingData(false);
    }
  }, []);

  // Check if a stock level already exists for the selected product and location
  const checkExistingStockLevel = useCallback(async (productId: string, locationId: string) => {
    try {
      const stockLevels = await getStockLevels();
      return stockLevels?.find(sl => 
        sl.productId === productId && sl.locationId === locationId
      );
    } catch (error) {
      console.error('Error checking existing stock level:', error);
      return null;
    }
  }, []);

  // Fetch products and locations when dialog opens
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Update selectedProduct when productId changes
  useEffect(() => {
    if (watchedProductId) {
      const product = products.find(p => p.id === watchedProductId);
      setSelectedProduct(product || null);
    } else {
      setSelectedProduct(null);
    }
  }, [watchedProductId, products]);

  useEffect(() => {
    if (stockLevel) {
      form.reset({
        productId: stockLevel.productId,
        locationId: stockLevel.locationId,
        quantity: stockLevel.quantity,
        quantityReserved: stockLevel.quantityReserved || 0,
        serialNumbers: "",
      });
    } else {
      form.reset({
        productId: "",
        locationId: "",
        quantity: 0,
        quantityReserved: 0,
        serialNumbers: "",
      });
    }
  }, [stockLevel, form, open]);

  const parseSerials = (text: string): string[] => {
    return text
      .split(/\r?\n|,/)
      .map(s => s.trim())
      .filter(Boolean);
  };

  const validateSerials = (serials: string[], quantity: number, isSerialized: boolean): string | null => {
    if (!isSerialized) return null;
    
    if (serials.length !== quantity) {
      return `Serial count (${serials.length}) must match quantity (${quantity})`;
    }
    
    // Check for duplicates
    const seen = new Set<string>();
    for (const serial of serials) {
      if (seen.has(serial)) {
        return `Duplicate serial number detected: ${serial}`;
      }
      seen.add(serial);
      
      // Check alphanumeric only
      if (!/^[a-zA-Z0-9]+$/.test(serial)) {
        return `Serial number "${serial}" must be alphanumeric only`;
      }
    }
    
    return null;
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      
      const isSerialized = selectedProduct?.is_serialized || false;
      let serialNumbers: string[] = [];
      
      // Validate serial numbers for serialized products
      if (isSerialized) {
        if (!data.serialNumbers || !data.serialNumbers.trim()) {
          toast({
            title: "Validation Error",
            description: "Serial numbers are required for serialized products",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        serialNumbers = parseSerials(data.serialNumbers);
        const validationError = validateSerials(serialNumbers, data.quantity, true);
        
        if (validationError) {
          toast({
            title: "Validation Error",
            description: validationError,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      } else {
        // For non-serialized products, ensure no serial numbers are provided
        if (data.serialNumbers && data.serialNumbers.trim()) {
          toast({
            title: "Validation Error",
            description: "Serial numbers should not be provided for non-serialized products",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }
      
      const stockLevelData = {
        productId: data.productId,
        locationId: data.locationId,
        quantity: data.quantity,
        quantityReserved: data.quantityReserved,
        serialNumbers: isSerialized ? serialNumbers : undefined,
      };

      if (stockLevel) {
        await updateStockLevel(stockLevel.id, stockLevelData);
        toast({
          title: "Stock level updated successfully",
          description: `Updated stock level for ${products.find(p => p.id === data.productId)?.name}`,
        });
      } else {
        // Check if a stock level already exists for this product-location combination
        const existingStockLevel = await checkExistingStockLevel(data.productId, data.locationId);
        
        if (existingStockLevel) {
          const productName = products.find(p => p.id === data.productId)?.name;
          const locationName = locations.find(l => l.id === data.locationId)?.name;
          
          toast({
            title: "Stock Level Already Exists",
            description: `A stock level for "${productName}" at "${locationName}" already exists (Current: ${existingStockLevel.quantity} units). Use the Edit button to modify it.`,
            variant: "destructive"
          });
          return; // Don't close the dialog
        }

        // Create new stock level
        await createStockLevel(stockLevelData);
        toast({
          title: "Stock level created successfully",
          description: `Created stock level for ${products.find(p => p.id === data.productId)?.name}`,
        });
      }
      
      onOpenChange(false);
      onSuccess?.(); // Callback to refresh the table
    } catch (error: any) {
      console.error('Error saving stock level:', error);
      const errorMessage = error?.detail || error?.message || "Failed to save stock level";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{stockLevel ? "Edit Stock Level" : "Add Stock Level"}</DialogTitle>
          {stockLevel ? (
            <p className="text-sm text-muted-foreground">
              Edit stock level details including on-hand and reserved quantities
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a new stock level for a product at a specific location
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!!stockLevel}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!!stockLevel}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On Hand Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={selectedProduct?.is_serialized && !stockLevel}
                      />
                    </FormControl>
                    {selectedProduct?.is_serialized && !stockLevel && (
                      <p className="text-xs text-muted-foreground">
                        Quantity will be determined by serial numbers entered below
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantityReserved"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reserved Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={selectedProduct?.is_serialized}
                      />
                    </FormControl>
                    {selectedProduct?.is_serialized && (
                      <p className="text-xs text-muted-foreground">
                        Reserved quantity is managed automatically for serialized products
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedProduct?.is_serialized && (
              <FormField
                control={form.control}
                name="serialNumbers"
                render={({ field }) => {
                  const serialCount = field.value ? parseSerials(field.value).length : 0;
                  const isValidCount = serialCount === watchedQuantity;
                  
                  return (
                    <FormItem>
                      <FormLabel>
                        Serial Numbers {watchedQuantity > 0 && `(${watchedQuantity} required)`}
                        {field.value && (
                          <span className={`ml-2 text-xs ${isValidCount ? 'text-green-600' : 'text-orange-600'}`}>
                            ({serialCount} entered)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter serial numbers, one per line or comma-separated (e.g., SN001, SN002, SN003)"
                          rows={Math.min(Math.max(watchedQuantity || 3, 3), 10)}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Enter {watchedQuantity || 0} unique alphanumeric serial number{watchedQuantity !== 1 ? 's' : ''}. 
                        One per line or comma-separated.
                      </p>
                      {field.value && !isValidCount && watchedQuantity > 0 && (
                        <p className="text-xs text-orange-600">
                          {serialCount < watchedQuantity 
                            ? `Need ${watchedQuantity - serialCount} more serial number${watchedQuantity - serialCount !== 1 ? 's' : ''}`
                            : `Too many serial numbers. Expected ${watchedQuantity}, got ${serialCount}`
                          }
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : null}
                {stockLevel ? "Update" : "Save"} Stock Level
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
