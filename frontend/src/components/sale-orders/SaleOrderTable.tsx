
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
import { Edit, Eye, Trash2, FileText } from "lucide-react";
import { type SalesOrder } from "@/types/sales-order";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SaleOrderTableProps {
  orders: SalesOrder[];
  loading: boolean;
  onView: (order: SalesOrder) => void;
  onEdit?: (order: SalesOrder) => void;
  onDelete?: (id: string) => void;
  onPrint?: (order: SalesOrder) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function SaleOrderTable({ 
  orders, 
  loading,
  onView, 
  onEdit, 
  onDelete, 
  onPrint,
  canEdit, 
  canDelete 
}: SaleOrderTableProps) {
  // Ensure orders is always an array
  const safeOrders = Array.isArray(orders) ? orders : [];
  
  const [sortColumn, setSortColumn] = useState<string>("orderDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency } = useCurrencyStore();



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

  const sortedOrders = [...safeOrders].sort((a: any, b: any) => {
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
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No sale orders found.
              </TableCell>
            </TableRow>
          ) : (
            sortedOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.orderNumber || 'N/A'}</TableCell>
                <TableCell>{order.customer?.name || 'N/A'}</TableCell>
                <TableCell>{order.orderDate ? formatDate(order.orderDate) : 'N/A'}</TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    order.status === "fulfilled" ? "bg-green-100 text-green-800" :
                    order.status === "partial" ? "bg-orange-100 text-orange-800" :
                    order.status === "sent" ? "bg-blue-100 text-blue-800" : 
                    order.status === "overdue" ? "bg-red-100 text-red-800" :
                    order.status === "cancelled" ? "bg-gray-100 text-gray-800" :
                    order.status === "approved" ? "bg-purple-100 text-purple-800" :
                    order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(order.totalAmount, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(order)}
                      disabled={order.status === 'draft'}
                      title={order.status === 'draft' 
                        ? `Cannot view ${order.status} sale order` 
                        : "View Sale Order"}
                      className={order.status === 'draft' 
                        ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit && onEdit(order)}
                        disabled={order.status === 'fulfilled' || order.status === 'cancelled'}
                        title={order.status === 'fulfilled' || order.status === 'cancelled' 
                          ? `Cannot edit ${order.status} sale order` 
                          : "Edit Sale Order"}
                        className={order.status === 'fulfilled' || order.status === 'cancelled' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Edit Sale Order">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to edit sale orders
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {onPrint && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPrint(order)}
                        disabled={order.status === 'draft'}
                        title={order.status === 'draft' 
                          ? `Cannot print ${order.status} sale order` 
                          : "Print Sale Order"}
                        className={order.status === 'draft' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete && onDelete(order.id)}
                        disabled={order.status === 'sent' || order.status === 'fulfilled' || order.status === 'partial' || order.status === 'overdue' || order.status === 'cancelled'}
                        title={order.status === 'sent' || order.status === 'fulfilled' || order.status === 'partial' || order.status === 'overdue' || order.status === 'cancelled' 
                          ? `Cannot delete ${order.status} sale order` 
                          : "Delete Sale Order"}
                        className={order.status === 'sent' || order.status === 'fulfilled' || order.status === 'partial' || order.status === 'overdue' || order.status === 'cancelled' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Delete Sale Order">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to delete sale orders
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
