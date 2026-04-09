
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Customer, Address } from "@/types/customer";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerCredit } from "./CustomerCredit";

const addressSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["billing", "shipping", "both"]).optional(),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  country: z.string().min(1, "Country is required"),
});

const defaultAddress: Address = {
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: ""
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  billingAddress: addressSchema,
  useShippingAsBilling: z.boolean().default(false),
  shippingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  additionalAddresses: z.array(addressSchema).default([]),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  creditLimit: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Credit limit must be non-negative").default(0)
  ),
  customerType: z.enum(["retail", "wholesale", "distributor"]).default("retail"),
  isActive: z.boolean().default(true),
});

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (customer: Customer) => void;
  customer?: Customer;
}

export function CustomerDialog({
  open,
  onOpenChange,
  onSubmit,
  customer,
}: CustomerDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      billingAddress: customer?.billingAddress || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      useShippingAsBilling: false,
      shippingAddress: customer?.shippingAddress || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      taxId: customer?.taxId || "",
      notes: customer?.notes || "",
      creditLimit: customer?.creditLimit || 0,
      customerType: customer?.customerType || "retail",
      isActive: customer?.isActive ?? true,
    },
  });

  const useShippingAsBilling = form.watch("useShippingAsBilling");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additionalAddresses",
  });

  React.useEffect(() => {
    if (open) {
      if (customer) {
        // Check if billing and shipping addresses are the same
        const billingAddress: Address = customer.billingAddress || defaultAddress;
        const shippingAddress: Address = customer.shippingAddress || defaultAddress;
        const addressesAreSame = 
          billingAddress.street === shippingAddress.street &&
          billingAddress.city === shippingAddress.city &&
          billingAddress.state === shippingAddress.state &&
          billingAddress.zipCode === shippingAddress.zipCode &&
          billingAddress.country === shippingAddress.country;

        form.reset({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          billingAddress: billingAddress,
          useShippingAsBilling: addressesAreSame,
          shippingAddress: shippingAddress,
          taxId: customer.taxId || "",
          notes: customer.notes || "",
          creditLimit: customer.creditLimit || 0,
          customerType: customer.customerType || "retail",
          isActive: customer.isActive ?? true,
          additionalAddresses: customer.additionalAddresses || [],
        });
      } else {
        form.reset({
          name: "",
          email: "",
          phone: "",
          billingAddress: defaultAddress,
          useShippingAsBilling: false,
          shippingAddress: defaultAddress,
          taxId: "",
          notes: "",
          creditLimit: 0,
          customerType: "retail",
          isActive: true,
          additionalAddresses: [],
        });
      }
    }
  }, [open, customer, form]);

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    console.log("CustomerDialog - Form submitted:", data);
    
    // If using billing as shipping, copy billing to shipping
    const finalData = {
      ...data,
      shippingAddress: data.useShippingAsBilling 
        ? data.billingAddress 
        : {
            street: data.shippingAddress?.street || "",
            city: data.shippingAddress?.city || "",
            state: data.shippingAddress?.state || "",
            zipCode: data.shippingAddress?.zipCode || "",
            country: data.shippingAddress?.country || "",
          },
    };
    delete finalData.useShippingAsBilling;
    
    // Convert form data to Customer object
    const customerData: Customer = {
      id: customer?.id || "",
      name: finalData.name,
      email: finalData.email,
      phone: finalData.phone,
      billingAddress: finalData.billingAddress as Address,
      shippingAddress: finalData.shippingAddress as Address,
      taxId: finalData.taxId,
      notes: finalData.notes,
      creditLimit: finalData.creditLimit || 0,
      currentCredit: customer?.currentCredit || 0,
      customerType: finalData.customerType,
      isActive: finalData.isActive,
      additionalAddresses: finalData.additionalAddresses as Address[],
      createdAt: customer?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    console.log("CustomerDialog - Customer data to submit:", customerData);
    await onSubmit(customerData);
    // Let CustomersPage handle success/error toasts and dialog closure
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit" : "Add"} Customer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">


            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="shipping">Shipping</TabsTrigger>
                <TabsTrigger value="additional">More Addresses</TabsTrigger>
                <TabsTrigger value="credit">Credit</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer name" {...field} />
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
                          <Input placeholder="customer@example.com" {...field} />
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
                          <Input placeholder="+1 (555) 123-4567" {...field} />
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
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value || "0"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Type</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="retail">Retail</option>
                            <option value="wholesale">Wholesale</option>
                            <option value="distributor">Distributor</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Status</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Enable or disable this customer
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
                          placeholder="Additional notes about this customer"
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="billingAddress.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Anytown" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} />
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
                  name="useShippingAsBilling"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
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
                
                {!useShippingAsBilling && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="shippingAddress.street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingAddress.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Anytown" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingAddress.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingAddress.zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingAddress.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium leading-none">Additional Locations</h3>
                    <p className="text-sm border-b pb-2 pt-1 text-muted-foreground">Add multiple tracking addresses for this customer.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ type: "both", label: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false })}>
                    Add Location
                  </Button>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-md border p-4 bg-muted/20 relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:text-red-700" onClick={() => remove(index)}>
                      &times;
                    </Button>
                    <FormField control={form.control} name={`additionalAddresses.${index}.label`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Label</FormLabel>
                        <FormControl><Input placeholder="Warehouse B, Main HQ" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.type`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="both">Both Billing & Shipping</option>
                            <option value="billing">Billing Only</option>
                            <option value="shipping">Shipping Only</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.street`} render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Street</FormLabel>
                        <FormControl><Input placeholder="123 Storage St" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.city`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl><Input placeholder="City" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.state`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl><Input placeholder="State" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.zipCode`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl><Input placeholder="12345" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`additionalAddresses.${index}.country`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl><Input placeholder="Country" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                ))}
                {fields.length === 0 && (
                  <div className="text-sm text-center py-6 text-muted-foreground italic border border-dashed rounded-md">
                    No additional addresses saved.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="credit">
                {customer && <CustomerCredit customerId={customer.id} />}
              </TabsContent>
            </Tabs>



            <DialogFooter>
              <Button type="submit">
                {customer ? "Update Customer" : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
