
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { type Tax } from "@/types/tax";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rate: z.coerce.number()
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100%"),
  isDefault: z.boolean(),
  appliedTo: z.enum(["products", "services", "both"]),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface TaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tax: Tax | null;
  onSubmit: (tax: Tax) => Promise<void>;
}

export function TaxDialog({ open, onOpenChange, tax, onSubmit }: TaxDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      rate: 0,
      isDefault: false,
      appliedTo: "both",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (tax) {
      form.reset({
        name: tax.name,
        rate: tax.rate,
        isDefault: tax.isDefault,
        appliedTo: tax.appliedTo,
        description: tax.description || "",
        isActive: tax.isActive,
      });
    } else {
      form.reset({
        name: "",
        rate: 0,
        isDefault: false,
        appliedTo: "both",
        description: "",
        isActive: true,
      });
    }
  }, [tax, form]);

  const handleSubmit = async (data: FormValues) => {
    try {
      const taxData: Tax = {
        id: tax?.id || "",
        name: data.name,
        rate: data.rate,
        isDefault: data.isDefault,
        appliedTo: data.appliedTo,
        description: data.description,
        isActive: data.isActive,
        createdAt: tax?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      
      await onSubmit(taxData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting tax:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{tax ? "Edit" : "Add"} Tax Rate</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Standard VAT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 20" 
                        {...field} 
                        min={0}
                        max={100}
                        step={0.01}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="appliedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applied To</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select what this tax applies to" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="products">Products Only</SelectItem>
                      <SelectItem value="services">Services Only</SelectItem>
                      <SelectItem value="both">Both Products & Services</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter a description of this tax rate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Rate</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Set as the default tax rate
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                        Enable or disable this tax rate
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {tax ? "Update" : "Create"} Tax Rate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
