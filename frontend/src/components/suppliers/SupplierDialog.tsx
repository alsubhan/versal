
import { useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { type Supplier } from "@/types/supplier";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  billingStreet: z.string().min(1, "Billing street is required"),
  billingCity: z.string().min(1, "Billing city is required"),
  billingState: z.string().min(1, "Billing state is required"),
  billingZipCode: z.string().min(1, "Billing zip code is required"),
  billingCountry: z.string().min(1, "Billing country is required"),
  shippingStreet: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZipCode: z.string().optional(),
  shippingCountry: z.string().optional(),
  useBillingAsShipping: z.boolean().default(false),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  isActive: z.boolean(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSubmit?: (supplier: Supplier) => Promise<void>;
}

export function SupplierDialog({ open, onOpenChange, supplier, onSubmit }: SupplierDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contactName: "",
      email: "",
      phone: "",
      billingStreet: "",
      billingCity: "",
      billingState: "",
      billingZipCode: "",
      billingCountry: "",
      shippingStreet: "",
      shippingCity: "",
      shippingState: "",
      shippingZipCode: "",
      shippingCountry: "",
      useBillingAsShipping: false,
      paymentTerms: "Net 30",
      isActive: true,
      taxId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      // Check if billing and shipping addresses are the same
      const billingAddress = supplier.billingAddress || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: ""
      };
      const shippingAddress = supplier.shippingAddress || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: ""
      };
      const addressesAreSame = 
        billingAddress.street === shippingAddress.street &&
        billingAddress.city === shippingAddress.city &&
        billingAddress.state === shippingAddress.state &&
        billingAddress.zipCode === shippingAddress.zipCode &&
        billingAddress.country === shippingAddress.country;

      form.reset({
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        billingStreet: billingAddress.street || "",
        billingCity: billingAddress.city || "",
        billingState: billingAddress.state || "",
        billingZipCode: billingAddress.zipCode || "",
        billingCountry: billingAddress.country || "",
        shippingStreet: shippingAddress.street || billingAddress.street || "",
        shippingCity: shippingAddress.city || billingAddress.city || "",
        shippingState: shippingAddress.state || billingAddress.state || "",
        shippingZipCode: shippingAddress.zipCode || billingAddress.zipCode || "",
        shippingCountry: shippingAddress.country || billingAddress.country || "",
        useBillingAsShipping: addressesAreSame,
        paymentTerms: supplier.paymentTerms,
        isActive: supplier.isActive,
        taxId: supplier.taxId || "",
        notes: supplier.notes || "",
      });
    } else {
      form.reset({
        name: "",
        contactName: "",
        email: "",
        phone: "",
        billingStreet: "",
        billingCity: "",
        billingState: "",
        billingZipCode: "",
        billingCountry: "",
        shippingStreet: "",
        shippingCity: "",
        shippingState: "",
        shippingZipCode: "",
        shippingCountry: "",
        useBillingAsShipping: false,
        paymentTerms: "Net 30",
        isActive: true,
        taxId: "",
        notes: "",
      });
    }
  }, [supplier, form]);

  const handleSubmit = async (data: FormValues) => {
    console.log("Form submitted:", data);
    
    if (onSubmit) {
      // Build address objects
      const billingAddress = {
        street: data.billingStreet,
        city: data.billingCity,
        state: data.billingState,
        zipCode: data.billingZipCode,
        country: data.billingCountry
      };

      const shippingAddress = data.useBillingAsShipping ? billingAddress : {
        street: data.shippingStreet || "",
        city: data.shippingCity || "",
        state: data.shippingState || "",
        zipCode: data.shippingZipCode || "",
        country: data.shippingCountry || ""
      };

      // Convert form data to Supplier type
      const supplierData: Supplier = {
        id: supplier?.id || "",
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        billingAddress: billingAddress,
        shippingAddress: shippingAddress,
        address: data.billingStreet, // Keep for backward compatibility
        paymentTerms: data.paymentTerms,
        isActive: data.isActive,
        taxId: data.taxId,
        notes: data.notes,
        createdAt: supplier?.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      console.log("Supplier data to submit:", supplierData);
      await onSubmit(supplierData);
    } else {
      // Fallback to toast notification
      toast({
        title: `Supplier ${supplier ? "updated" : "created"} successfully`,
        description: data.name,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit" : "Add"} Supplier</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">


            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Details</TabsTrigger>
                <TabsTrigger value="billing">Billing Address</TabsTrigger>
                <TabsTrigger value="shipping">Shipping Address</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Office Supplies Co." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. contact@supplier.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 555-123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Net 30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Tax ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Status</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Enable or disable this supplier
                          </div>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this supplier"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              
              <TabsContent value="billing" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingStreet"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input placeholder="NY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingZipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP/Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="shipping" className="space-y-4">
                <FormField
                  control={form.control}
                  name="useBillingAsShipping"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Use billing address as shipping address</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Check this if the shipping address is the same as billing address
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                
                {!form.watch("useBillingAsShipping") && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shippingStreet"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingZipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP/Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="United States" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>



            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {supplier ? "Update" : "Create"} Supplier
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
