
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
import { type GoodsReceiveNote } from "@/types/grn";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';

interface GRNTableProps {
  grns: GoodsReceiveNote[];
  onView: (grn: GoodsReceiveNote) => void;
  onEdit?: (grn: GoodsReceiveNote) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function GRNTable({ grns, onView, onEdit, onDelete, canEdit, canDelete }: GRNTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("receivedDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const { currency } = useCurrencyStore();

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN #</TableHead>
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedGrns = [...grns].sort((a: any, b: any) => {
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
              onClick={() => handleSort("grnNumber")}
            >
              GRN #
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("purchaseOrder.orderNumber")}
            >
              PO #
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("receivedDate")}
            >
              Received Date
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
          {sortedGrns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No goods receive notes found.
              </TableCell>
            </TableRow>
          ) : (
            sortedGrns.map((grn) => (
              <TableRow key={grn.id}>
                <TableCell>{grn.grnNumber}</TableCell>
                <TableCell>{grn.purchaseOrder?.orderNumber || "N/A"}</TableCell>
                <TableCell>{formatDate(grn.receivedDate)}</TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    grn.status === "completed" ? "bg-green-100 text-green-800" :
                    grn.status === "partial" ? "bg-blue-100 text-blue-800" : 
                    grn.status === "cancelled" ? "bg-red-100 text-red-800" : 
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {grn.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(grn.totalAmount, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(grn)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onEdit && onEdit(grn)}
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
                            You do not have permission to edit GRNs
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onDelete && onDelete(grn.id)}
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
                            You do not have permission to delete GRNs
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
