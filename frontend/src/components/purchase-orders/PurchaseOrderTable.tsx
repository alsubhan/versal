
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from "react";
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
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
  onView?: (purchaseOrder: PurchaseOrder) => void;
  onEdit?: (purchaseOrder: PurchaseOrder) => void;
  onDelete?: (id: string) => void;
  onPrint?: (purchaseOrder: PurchaseOrder) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}



export function PurchaseOrderTable({ 
  purchaseOrders, 
  loading, 
  onView,
  onEdit, 
  onDelete, 
  onPrint,
  canEdit, 
  canDelete 
}: PurchaseOrderTableProps) {
  // Ensure purchaseOrders is always an array
  const safePurchaseOrders = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  
  const [sortColumn, setSortColumn] = useState<string>("orderDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency } = useCurrencyStore();

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedPurchaseOrders = [...safePurchaseOrders].sort((a: any, b: any) => {
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    // Handle nested properties like supplier.name
    if (sortColumn === "supplier.name") {
      aValue = a.supplier?.name;
      bValue = b.supplier?.name;
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Now do the conditional render
  if (loading) {
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
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-4 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort("orderNumber")}
            >
              PO #
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("supplier.name")}
            >
              Supplier
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("orderDate")}
            >
              Order Date
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("expectedDeliveryDate")}
            >
              Delivery Date
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("status")}
            >
              Status
            </TableHead>
            <TableHead
              className="cursor-pointer text-right"
              onClick={() => handleSort("totalAmount")}
            >
              Amount
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPurchaseOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-6">
                No purchase orders found
              </TableCell>
            </TableRow>
          ) : (
            sortedPurchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.orderNumber || 'N/A'}</TableCell>
                <TableCell>{po.supplier?.name || 'N/A'}</TableCell>
                <TableCell>{po.orderDate ? formatDate(po.orderDate) : 'N/A'}</TableCell>
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
                    {onView && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onView(po)}
                        disabled={po.status === 'draft' || po.status === 'pending'}
                        title={po.status === 'draft' || po.status === 'pending' 
                          ? `Cannot view ${po.status} purchase order` 
                          : "View Purchase Order"}
                        className={po.status === 'draft' || po.status === 'pending' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && onEdit && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(po)}
                        disabled={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received'}
                        title={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received' 
                          ? `Cannot edit ${po.status} purchase order` 
                          : "Edit Purchase Order"}
                        className={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onPrint && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onPrint(po)}
                        disabled={po.status === 'draft' || po.status === 'pending'}
                        title={po.status === 'draft' || po.status === 'pending' 
                          ? `Cannot print ${po.status} purchase order` 
                          : "Print Purchase Order"}
                        className={po.status === 'draft' || po.status === 'pending' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && onDelete && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(po.id)}
                        disabled={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received'}
                        title={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received' 
                          ? `Cannot delete ${po.status} purchase order` 
                          : "Delete Purchase Order"}
                        className={po.status === 'approved' || po.status === 'cancelled' || po.status === 'received' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
