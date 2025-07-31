
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
import { createInventoryMovement, getProducts } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const formSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  type: z.enum(["purchase", "sale", "adjustment", "transfer"], {
    required_error: "Movement type is required",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  previousStock: z.number().min(0, "Previous stock cannot be negative"),
  notes: z.string().optional(),
  reference: z.string().optional(),
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
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      type: "purchase",
      quantity: 1,
      previousStock: 0,
      notes: "",
      reference: "",
    },
  });

  const fetchProducts = useCallback(async () => {
    try {
      setFetchingData(true);
      const data = await getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setFetchingData(false);
    }
  }, [toast]);

  // Fetch products when dialog opens
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open, fetchProducts]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      // Convert quantity to number if it's a string
      const quantity = typeof values.quantity === 'string' 
        ? parseInt(values.quantity, 10) 
        : values.quantity;

      // Validate if previousStock is less than quantity for sales
      if (values.type === "sale" && values.previousStock < quantity) {
        toast({
          title: "Error",
          description: "Cannot sell more than available stock",
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

      const movementData = {
        product_id: values.productId,
        type: values.type,
        quantity: values.type === "sale" ? -quantity : quantity, // Negative for sales
        previous_stock: values.previousStock,
        new_stock: values.type === "sale" ? values.previousStock - quantity : values.previousStock + quantity,
        reference: reference,
        notes: values.notes,
      };

      await createInventoryMovement(movementData);

      toast({
        title: "Success",
        description: "Inventory movement has been recorded",
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
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
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
              
              <FormField
                control={form.control}
                name="previousStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
