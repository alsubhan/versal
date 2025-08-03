
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
import { Edit, Eye, Trash2 } from "lucide-react";
import { type WholesaleOrder } from "@/types/wholesale-order";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SaleOrderTableProps {
  orders: WholesaleOrder[];
  onView: (order: WholesaleOrder) => void;
  onEdit?: (order: WholesaleOrder) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function SaleOrderTable({
  orders,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete
}: SaleOrderTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>("orderDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
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
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedOrders = [...orders].sort((a: any, b: any) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort("orderNumber")}
            >
              Order #
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("customer.name")}
            >
              Customer
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("orderDate")}
            >
              Order Date
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
              Total
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No wholesale orders found.
              </TableCell>
            </TableRow>
          ) : (
            sortedOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.orderNumber}</TableCell>
                <TableCell>{order.customer.name}</TableCell>
                <TableCell>{formatDate(order.orderDate)}</TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    order.status === "delivered" ? "bg-green-100 text-green-800" :
                    order.status === "confirmed" ? "bg-blue-100 text-blue-800" : 
                    order.status === "processing" ? "bg-purple-100 text-purple-800" :
                    order.status === "shipped" ? "bg-indigo-100 text-indigo-800" :
                    order.status === "cancelled" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(order.totalAmount, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(order)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onEdit && onEdit(order)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to edit wholesale orders
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onDelete && onDelete(order.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to delete wholesale orders
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
