
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
});

type FormValues = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku_code: string;
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      locationId: "",
      quantity: 0,
      quantityReserved: 0,
    },
  });

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

  useEffect(() => {
    if (stockLevel) {
      form.reset({
        productId: stockLevel.productId,
        locationId: stockLevel.locationId,
        quantity: stockLevel.quantity,
        quantityReserved: stockLevel.quantityReserved || 0,
      });
    } else {
      form.reset({
        productId: "",
        locationId: "",
        quantity: 0,
        quantityReserved: 0,
      });
    }
  }, [stockLevel, form, open]);

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      
      const stockLevelData = {
        productId: data.productId,
        locationId: data.locationId,
        quantity: data.quantity,
        quantityReserved: data.quantityReserved,
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
    } catch (error) {
      console.error('Error saving stock level:', error);
      toast({
        title: "Error",
        description: "Failed to save stock level",
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
      <DialogContent className="sm:max-w-[500px]">
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
                      />
                    </FormControl>
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
