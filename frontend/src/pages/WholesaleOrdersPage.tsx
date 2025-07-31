import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type WholesaleOrder } from "@/types/wholesale-order";
import { WholesaleOrderTable } from "@/components/wholesale-orders/WholesaleOrderTable";
import { WholesaleOrderDialog } from "@/components/wholesale-orders/WholesaleOrderDialog";
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
import { toast } from "@/hooks/use-toast";
import { type Customer } from "@/types/customer";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

// Sample data for demonstration
const sampleOrders: WholesaleOrder[] = [
  {
    id: "1",
    orderNumber: "WS-0001",
    customerId: "1",
    customer: {
      id: "1",
      name: "ABC Corporation",
      email: "info@abccorp.com",
      phone: "555-1234",
      billingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA"
      },
      taxId: "TAX123456",
      notes: "Premium customer",
      creditLimit: 10000,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    orderDate: new Date(),
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: "confirmed",
    subtotal: 1500,
    taxAmount: 150,
    discountAmount: 50,
    shippingAmount: 25,
    totalAmount: 1625,
    notes: "Please deliver during business hours",
    items: [
      {
        id: "1",
        orderId: "1",
        productId: "1",
        productName: "Product One",
        skuCode: "PRD-001",
        quantity: 10,
        unitPrice: 150,
        discount: 5,
        tax: 10,
        total: 1625,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    orderNumber: "WS-0002",
    customerId: "2",
    customer: {
      id: "2",
      name: "XYZ Limited",
      email: "info@xyzlimited.com",
      phone: "555-5678",
      billingAddress: {
        street: "456 Market St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94103",
        country: "USA"
      },
      taxId: "TAX789012",
      notes: "New customer",
      creditLimit: 5000,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    status: "processing",
    subtotal: 750,
    taxAmount: 75,
    discountAmount: 0,
    shippingAmount: 15,
    totalAmount: 840,
    notes: "",
    items: [
      {
        id: "2",
        orderId: "2",
        productId: "2",
        productName: "Product Two",
        skuCode: "PRD-002",
        quantity: 5,
        unitPrice: 150,
        discount: 0,
        tax: 10,
        total: 825,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample customers for demonstration
const sampleCustomers = [
  { 
    id: "1", 
    name: "ABC Corporation",
    email: "info@abccorp.com",
    phone: "555-1234",
    billingAddress: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  { 
    id: "2", 
    name: "XYZ Limited",
    email: "info@xyzlimited.com",
    phone: "555-5678",
    billingAddress: {
      street: "456 Market St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94103",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  { 
    id: "3", 
    name: "123 Industries",
    email: "info@123industries.com",
    phone: "555-9012",
    billingAddress: {
      street: "789 Broadway",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      country: "USA"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
];

// Sample products for demonstration
const sampleProducts = [
  { id: "1", name: "Product One", skuCode: "PRD-001", price: 150, taxRate: 10 },
  { id: "2", name: "Product Two", skuCode: "PRD-002", price: 150, taxRate: 10 },
  { id: "3", name: "Product Three", skuCode: "PRD-003", price: 200, taxRate: 10 },
];

export default function WholesaleOrdersPage() {
  const [orders, setOrders] = useState<WholesaleOrder[]>(sampleOrders);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WholesaleOrder | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const canViewOrders = hasPermission('sale_orders_view');
  const canCreateOrders = hasPermission('sale_orders_create');
  const canEditOrders = hasPermission('sale_orders_edit');
  const canDeleteOrders = hasPermission('sale_orders_delete');

  if (!canViewOrders) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Sale Orders</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view sale orders. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAddNew = () => {
    setSelectedOrder(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (order: WholesaleOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleView = (order: WholesaleOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (itemToDeleteId) {
      setOrders(orders.filter((item) => item.id !== itemToDeleteId));
      toast({
        title: "Success",
        description: "Sale order deleted successfully",
      });
      setDeleteDialogOpen(false);
      setItemToDeleteId(null);
    }
  };

  const handleSave = (order: Partial<WholesaleOrder>) => {
    if (selectedOrder) {
      // Update existing order
      setOrders(orders.map((item) => (item.id === selectedOrder.id ? { ...item, ...order } : item)));
      toast({
        title: "Success",
        description: "Sale order updated successfully",
      });
    } else {
      // Create new order
      const newOrder: WholesaleOrder = {
        id: Date.now().toString(),
        orderNumber: order.orderNumber || "",
        customerId: order.customerId || "",
        customer: order.customer || sampleCustomers[0],
        orderDate: order.orderDate || new Date(),
        deliveryDate: order.deliveryDate,
        status: order.status || "draft",
        subtotal: order.subtotal || 0,
        taxAmount: order.taxAmount || 0,
        discountAmount: order.discountAmount || 0,
        shippingAmount: order.shippingAmount || 0,
        totalAmount: order.totalAmount || 0,
        notes: order.notes,
        items: order.items || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setOrders([...orders, newOrder]);
      toast({
        title: "Success",
        description: "Sale order created successfully",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sale Orders</h1>
        {canCreateOrders ? (
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <PlusCircle size={18} />
          New Order
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="flex items-center gap-2">
                    <PlusCircle size={18} />
                    New Order
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create sale orders
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <WholesaleOrderTable
        orders={orders}
        onView={handleView}
        onEdit={canEditOrders ? handleEdit : undefined}
        onDelete={canDeleteOrders ? handleDeleteClick : undefined}
        canEdit={canEditOrders}
        canDelete={canDeleteOrders}
      />

      <WholesaleOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onSave={handleSave}
        customers={sampleCustomers}
        products={sampleProducts}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              wholesale order and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
