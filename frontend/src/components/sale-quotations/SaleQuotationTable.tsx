import { Skeleton } from "@/components/ui/skeleton";
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
import { Edit, Eye, Trash2, FileText, ArrowRightCircle } from "lucide-react";
import { type SaleQuotation } from "@/types/sale-quotation";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SaleQuotationTableProps {
  quotations: SaleQuotation[];
  loading: boolean;
  onView: (q: SaleQuotation) => void;
  onEdit?: (q: SaleQuotation) => void;
  onDelete?: (id: string) => void;
  onPrint?: (q: SaleQuotation) => void;
  onConvert?: (q: SaleQuotation) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const TERMINAL_STATUSES = ["accepted", "rejected", "expired", "cancelled"];

export function SaleQuotationTable({
  quotations,
  loading,
  onView,
  onEdit,
  onDelete,
  onPrint,
  onConvert,
  canEdit,
  canDelete,
}: SaleQuotationTableProps) {
  const safeQuotations = Array.isArray(quotations) ? quotations : [];
  const [sortColumn, setSortColumn] = useState<string>("quotationDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency } = useCurrencyStore();

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const sorted = [...safeQuotations].sort((a: any, b: any) => {
    const av = a[sortColumn];
    const bv = b[sortColumn];
    if (av < bv) return sortDirection === "asc" ? -1 : 1;
    if (av > bv) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const isExpired = (q: SaleQuotation) => {
    if (!q.validUntil || q.status !== "sent") return false;
    return new Date(q.validUntil) < new Date(new Date().toDateString());
  };

  const isTerminal = (q: SaleQuotation) =>
    TERMINAL_STATUSES.includes(q.status);

  const canConvert = (q: SaleQuotation) =>
    q.status === "sent" || q.status === "accepted";

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("quotationNumber")}>
              Quotation #
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("customer.name")}>
              Customer
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("quotationDate")}>
              Date
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("validUntil")}>
              Valid Until
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
              Status
            </TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("totalAmount")}>
              Total
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No quotations found. Create your first quotation to get started.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((q) => {
              const expired = isExpired(q);
              const displayStatus = expired ? "expired" : q.status;
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.quotationNumber || "N/A"}</TableCell>
                  <TableCell>{q.customer?.name || "N/A"}</TableCell>
                  <TableCell>{q.quotationDate ? formatDate(q.quotationDate) : "N/A"}</TableCell>
                  <TableCell>
                    <span className={expired ? "text-orange-600 font-medium" : ""}>
                      {q.validUntil ? formatDate(q.validUntil) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`capitalize px-2 py-1 rounded-full text-xs font-medium ${statusColors[displayStatus] || "bg-gray-100 text-gray-800"}`}>
                      {displayStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(q.totalAmount, currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center space-x-1">
                      {/* View */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(q)}
                        title="View Quotation"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit — blocked for terminal statuses */}
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit && onEdit(q)}
                          disabled={isTerminal(q)}
                          title={isTerminal(q) ? `Cannot edit ${q.status} quotation` : "Edit Quotation"}
                          className={isTerminal(q) ? "opacity-50 cursor-not-allowed" : ""}
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
                            <TooltipContent>No permission to edit quotations</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Convert to Order */}
                      {onConvert && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onConvert(q)}
                          disabled={!canConvert(q)}
                          title={
                            q.status === "accepted"
                              ? "Already converted to Sale Order"
                              : canConvert(q)
                              ? "Convert to Sale Order"
                              : `Cannot convert ${q.status} quotation`
                          }
                          className={!canConvert(q) ? "opacity-50 cursor-not-allowed" : "text-blue-600 hover:text-blue-700"}
                        >
                          <ArrowRightCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Print */}
                      {onPrint && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onPrint(q)}
                          disabled={q.status === "draft"}
                          title={q.status === "draft" ? "Cannot print draft quotation" : "Print Quotation"}
                          className={q.status === "draft" ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Delete */}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete && onDelete(q.id)}
                          disabled={isTerminal(q)}
                          title={isTerminal(q) ? `Cannot delete ${q.status} quotation` : "Delete Quotation"}
                          className={isTerminal(q) ? "opacity-50 cursor-not-allowed" : "text-red-500 hover:text-red-600"}
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
                            <TooltipContent>No permission to delete quotations</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
