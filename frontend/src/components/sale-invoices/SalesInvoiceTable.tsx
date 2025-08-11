import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, FileText, Trash2, RotateCcw } from "lucide-react";
import { type SaleInvoice } from "@/types/sale-invoice";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SalesInvoiceTableProps {
  invoices: SaleInvoice[];
  loading: boolean;
  onView: (invoice: SaleInvoice) => void;
  onEdit?: (invoice: SaleInvoice) => void;
  onDelete?: (id: string) => void;
  onPrintInvoice: (invoice: SaleInvoice) => void;
  onProcessReturn?: (invoice: SaleInvoice) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canPrintInvoice?: boolean;
  canProcessReturn?: boolean;
}
export function SalesInvoiceTable({
  invoices,
  loading,
  onView,
  onEdit,
  onDelete,
  onPrintInvoice,
  onProcessReturn,
  canEdit,
  canDelete,
  canPrintInvoice,
  canProcessReturn
}: SalesInvoiceTableProps) {
  // Ensure invoices is always an array
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  
  // Move all hooks to the top
  const [sortColumn, setSortColumn] = useState<string>("invoiceDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const {
    currency
  } = useCurrencyStore();

  // Now do the conditional render
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
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
  const sortedInvoices = [...safeInvoices].sort((a: any, b: any) => {
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
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Cancelled</Badge>;
      case "sent":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sent</Badge>;
      case "partial":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Partial</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Draft</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{status || 'Unknown'}</Badge>;
    }
  };
  return <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("invoiceNumber")}>Invoice #</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("customer.name")}>
              Customer
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("invoiceDate")}>Invoice Date</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("dueDate")}>
              Due Date
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
              Status
            </TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("totalAmount")}>
              Total
            </TableHead>
            <TableHead className="text-right">
              Amount Due
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInvoices.length === 0 ? <TableRow>
              <TableCell colSpan={8} className="text-center">
                No invoices found.
              </TableCell>
            </TableRow> : sortedInvoices.map(invoice => <TableRow key={invoice.id}>
                <TableCell>{invoice.invoiceNumber || 'N/A'}</TableCell>
                <TableCell>{invoice.customer?.name || 'N/A'}</TableCell>
                <TableCell>{invoice.invoiceDate ? formatDate(invoice.invoiceDate) : 'N/A'}</TableCell>
                <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}</TableCell>
                <TableCell>
                  {getStatusBadge(invoice.status)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(invoice.totalAmount, currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(invoice.amountDue || 0, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(invoice)} 
                      disabled={invoice.status === 'draft'}
                      title={invoice.status === 'draft' 
                        ? `Cannot view ${invoice.status} invoice` 
                        : "View"}
                      className={invoice.status === 'draft' 
                        ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit && onEdit(invoice)} 
                        disabled={invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled'}
                        title={invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled' 
                          ? `Cannot edit ${invoice.status} invoice` 
                          : "Edit"}
                        className={invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to edit sale invoices
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onPrintInvoice(invoice)} 
                      disabled={invoice.status === 'draft'}
                      title={invoice.status === 'draft' 
                        ? `Cannot print ${invoice.status} invoice` 
                        : "Print Invoice"}
                      className={invoice.status === 'draft' 
                        ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    {onProcessReturn && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onProcessReturn(invoice)}
                        disabled={invoice.status !== "paid"}
                        title={invoice.status !== "paid" 
                          ? `Cannot process return for ${invoice.status} invoice` 
                          : "Process Return/Exchange"}
                        className={invoice.status !== "paid" 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onDelete && onDelete(invoice.id)} 
                        disabled={invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled'}
                        title={invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled' 
                          ? `Cannot delete ${invoice.status} invoice` 
                          : "Delete"}
                        className={invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            You do not have permission to delete sale invoices
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>)}
        </TableBody>
      </Table>
    </div>;
}