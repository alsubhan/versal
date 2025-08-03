
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { createLocation, updateLocation } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: any; // For editing existing location
  onSuccess?: () => void;
}

export function LocationDialog({ open, onOpenChange, location, onSuccess }: LocationDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: location?.name || "",
      description: location?.description || "",
      address: location?.address || "",
      isActive: location?.isActive ?? true,
    },
  });

  // Reset form when location changes
  useEffect(() => {
    if (location) {
      form.reset({
        name: location.name || "",
        description: location.description || "",
        address: location.address || "",
        isActive: location.isActive ?? true,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        address: "",
        isActive: true,
      });
    }
  }, [location, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      
      const locationData = {
        name: data.name,
        description: data.description,
        address: data.address,
        is_active: data.isActive,
      };

      if (location) {
        // Update existing location
        await updateLocation(location.id, locationData);
        toast({
          title: "Location updated successfully",
          description: data.name,
        });
      } else {
        // Create new location
        await createLocation(locationData);
        toast({
          title: "Location added successfully",
          description: data.name,
        });
      }
      
      onOpenChange(false);
      form.reset();
      onSuccess?.(); // Callback to refresh the table
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "Error",
        description: `Failed to ${location ? 'update' : 'create'} location`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{location ? "Edit" : "Add"} Inventory Location</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main Warehouse" {...field} />
                  </FormControl>
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
                      placeholder="Brief description of this location"
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Physical address of this location"
                      {...field} 
                    />
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
                      Enable or disable this location
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
                {location ? "Update" : "Save"} Location
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
