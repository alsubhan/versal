
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { type PurchaseOrder } from "@/types/purchase-order";
import { useCurrencyStore } from "@/stores/currencyStore";

interface PurchaseOrderTableProps {
  onEdit: (purchaseOrder: PurchaseOrder) => void;
}

// Sample data for demonstration
const purchaseOrderData: PurchaseOrder[] = [
  {
    id: "1",
    orderNumber: "PO-0001",
    supplierId: "1",
    supplier: {
      id: "1",
      name: "ABC Electronics",
      contactName: "John Smith",
      email: "john@abcelectronics.com",
      phone: "1234567890",
      address: "123 Main St",
      taxId: "TAX12345",
      paymentTerms: "Net 30",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    orderDate: new Date(),
    expectedDeliveryDate: new Date(),
    status: "pending",
    subtotal: 3500,
    taxAmount: 630,
    discountAmount: 0,
    totalAmount: 4130,
    notes: "Please deliver as soon as possible",
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    orderNumber: "PO-0002",
    supplierId: "2",
    supplier: {
      id: "2",
      name: "XYZ Appliances",
      contactName: "Jane Doe",
      email: "jane@xyzappliances.com",
      phone: "0987654321",
      address: "456 Oak St",
      taxId: "TAX67890",
      paymentTerms: "Net 15",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    orderDate: new Date(),
    expectedDeliveryDate: new Date(),
    status: "approved",
    subtotal: 7200,
    taxAmount: 1296,
    discountAmount: 720,
    totalAmount: 7776,
    notes: "",
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function PurchaseOrderTable({ onEdit }: PurchaseOrderTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(purchaseOrderData);
  const { currency } = useCurrencyStore();

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  // Now do the conditional render
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    setPurchaseOrders(purchaseOrders.filter((po) => po.id !== id));
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Delivery Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-6">
                No purchase orders found
              </TableCell>
            </TableRow>
          ) : (
            purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.orderNumber}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>{formatDate(po.orderDate)}</TableCell>
                <TableCell>{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : "N/A"}</TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    po.status === "approved" ? "bg-green-100 text-green-800" :
                    po.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    po.status === "cancelled" ? "bg-red-100 text-red-800" :
                    po.status === "received" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {po.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(po.totalAmount, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(po)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(po.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
