import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, FileText, Trash2, RotateCcw } from "lucide-react";
import { type WholesaleBill } from "@/types/wholesale-billing";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WholesaleBillingTableProps {
  bills: WholesaleBill[];
  onView: (bill: WholesaleBill) => void;
  onEdit?: (bill: WholesaleBill) => void;
  onDelete?: (id: string) => void;
  onPrintInvoice: (bill: WholesaleBill) => void;
  onProcessReturn?: (bill: WholesaleBill) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canPrintInvoice?: boolean;
  canProcessReturn?: boolean;
}
export function WholesaleBillingTable({
  bills,
  onView,
  onEdit,
  onDelete,
  onPrintInvoice,
  onProcessReturn,
  canEdit,
  canDelete,
  canPrintInvoice,
  canProcessReturn
}: WholesaleBillingTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>("billingDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const {
    currency
  } = useCurrencyStore();

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
              <TableHead>Bill #</TableHead>
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
  const sortedBills = [...bills].sort((a: any, b: any) => {
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
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Cancelled</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Draft</Badge>;
    }
  };
  return <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("billNumber")}>Invoice #</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("customer.name")}>
              Customer
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("billingDate")}>Invoice Date</TableHead>
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBills.length === 0 ? <TableRow>
              <TableCell colSpan={8} className="text-center">
                No bills found.
              </TableCell>
            </TableRow> : sortedBills.map(bill => <TableRow key={bill.id}>
                <TableCell>{bill.billNumber}</TableCell>
                <TableCell>{bill.customer.name}</TableCell>
                <TableCell>{formatDate(bill.billingDate)}</TableCell>
                <TableCell>{formatDate(bill.dueDate)}</TableCell>
                <TableCell>
                  {getStatusBadge(bill.status)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(bill.totalAmount, currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(bill.amountDue || 0, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(bill)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                      <Button variant="ghost" size="icon" onClick={() => onEdit && onEdit(bill)} title="Edit" disabled={bill.status === "cancelled"}>
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
                            You do not have permission to edit wholesale bills
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onPrintInvoice(bill)} title="Print Invoice">
                      <FileText className="h-4 w-4" />
                    </Button>
                    {onProcessReturn && bill.status !== "draft" && bill.status !== "cancelled" && <Button variant="ghost" size="icon" onClick={() => onProcessReturn(bill)} title="Process Return/Exchange">
                        <RotateCcw className="h-4 w-4" />
                      </Button>}
                    {canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => onDelete && onDelete(bill.id)} title="Delete" disabled={bill.status !== "draft"}>
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
                            You do not have permission to delete wholesale bills
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