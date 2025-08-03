
import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createInventoryMovement, getProducts, getStockLevels, getLocations } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  type: z.enum(["purchase", "sale", "adjustment", "transfer"], {
    required_error: "Movement type is required",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
}).refine((data) => {
  // For transfer type, both locations are required
  if (data.type === "transfer") {
    return data.fromLocationId && data.toLocationId && data.fromLocationId !== data.toLocationId;
  }
  return true;
}, {
  message: "For transfers, both locations are required and must be different",
  path: ["fromLocationId"], // This will show the error on the fromLocationId field
});

type FormValues = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku_code: string;
}

interface InventoryMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const InventoryMovementDialog: React.FC<InventoryMovementDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(0);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      type: "purchase",
      quantity: 1,
      fromLocationId: "",
      toLocationId: "",
      notes: "",
      reference: "",
    },
  });

  const fetchData = useCallback(async () => {
    try {
      setFetchingData(true);
      const [productsData, stockLevelsData, locationsData] = await Promise.all([
        getProducts(),
        getStockLevels(),
        getLocations()
      ]);
      setProducts(productsData || []);
      setStockLevels(stockLevelsData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load products, stock levels, and locations",
        variant: "destructive"
      });
    } finally {
      setFetchingData(false);
    }
  }, [toast]);

  // Calculate current stock when product or type changes
  const calculateStockLevels = useCallback((productId: string, type: string, quantity: number) => {
    if (!productId) {
      setCurrentStock(0);
      setNewStock(0);
      return;
    }

    // Find the stock level for this product (sum across all locations)
    const productStockLevels = stockLevels.filter(sl => sl.productId === productId);
    const currentStockValue = productStockLevels.reduce((total, sl) => total + (sl.quantity || 0), 0);
    setCurrentStock(currentStockValue);

    // Calculate new stock based on movement type
    let newStockValue = currentStockValue;
    if (type === "purchase" || type === "adjustment") {
      newStockValue = currentStockValue + quantity;
    } else if (type === "sale") {
      newStockValue = currentStockValue - quantity;
    } else if (type === "transfer") {
      // Transfer doesn't change total stock, just moves between locations
      newStockValue = currentStockValue;
    }

    setNewStock(Math.max(0, newStockValue)); // Ensure new stock is not negative
  }, [stockLevels]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Watch for changes in product, type, and quantity to recalculate stock levels
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'productId' || name === 'type' || name === 'quantity') {
        calculateStockLevels(value.productId || '', value.type || 'purchase', value.quantity || 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, calculateStockLevels]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      // Validate if we're trying to sell more than available stock
      if (values.type === "sale" && currentStock < values.quantity) {
        toast({
          title: "Error",
          description: `Cannot sell ${values.quantity} units. Only ${currentStock} units available.`,
          variant: "destructive",
        });
        return;
      }

      // Validate if new stock would be negative
      if (newStock < 0) {
        toast({
          title: "Error",
          description: "This movement would result in negative stock. Please adjust the quantity.",
          variant: "destructive",
        });
        return;
      }
      
      // Format the reference code by capitalizing first letter and rest lowercase
      let reference = values.reference;
      if (reference) {
        reference = typeof reference === 'string' 
          ? reference.charAt(0).toUpperCase() + reference.slice(1).toLowerCase()
          : reference;
      }

      const movementData: any = {
        product_id: values.productId,
        type: values.type,
        quantity: values.type === "sale" ? -values.quantity : values.quantity, // Negative for sales
        previous_stock: currentStock,
        new_stock: newStock,
        reference: reference,
        notes: values.notes,
      };

      // Only include location fields if they have values (for transfer movements)
      if (values.fromLocationId && values.fromLocationId.trim() !== "") {
        movementData.from_location_id = values.fromLocationId;
      }
      if (values.toLocationId && values.toLocationId.trim() !== "") {
        movementData.to_location_id = values.toLocationId;
      }

      await createInventoryMovement(movementData);

      toast({
        title: "Success",
        description: `Inventory movement recorded: ${values.type} of ${values.quantity} units`,
      });
      
      onOpenChange(false);
      form.reset();
      onSuccess?.(); // Callback to refresh the table
    } catch (error) {
      console.error('Error creating inventory movement:', error);
      toast({
        title: "Error",
        description: "Failed to record inventory movement",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Record Inventory Movement</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Record manual inventory movements for direct transactions, stock corrections, and location transfers. 
            For formal orders, use Purchase Orders/GRN or Sale Orders/Invoices instead.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Product</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select movement type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="purchase">Direct Purchase (Cash/Manual)</SelectItem>
                        <SelectItem value="sale">Direct Sale (Cash/Manual)</SelectItem>
                        <SelectItem value="adjustment">Stock Adjustment (Correction)</SelectItem>
                        <SelectItem value="transfer">Location Transfer</SelectItem>
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
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current Stock</Label>
                <div className="p-2 bg-muted rounded-md border text-sm">
                  {currentStock} units
                </div>
              </div>
            </div>

            {/* Location fields - show based on movement type */}
            {form.watch("type") === "transfer" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source location" />
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
                
                <FormField
                  control={form.control}
                  name="toLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination location" />
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
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">New Stock</Label>
              <div className={`p-2 rounded-md border text-sm ${
                newStock < currentStock ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 
                newStock > currentStock ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 
                'bg-muted'
              }`}>
                {newStock} units
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : null}
                Save Movement
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
