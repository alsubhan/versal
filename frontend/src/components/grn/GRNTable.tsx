
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
import { Edit, Eye, Trash2, FileText, RotateCcw } from "lucide-react";
import { type GoodsReceiveNote } from "@/types/grn";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';

interface GRNTableProps {
  grns: GoodsReceiveNote[];
  loading: boolean;
  onView: (grn: GoodsReceiveNote) => void;
  onEdit?: (grn: GoodsReceiveNote) => void;
  onDelete?: (id: string) => void;
  onPrint?: (grn: GoodsReceiveNote) => void;
  onProcessReturn?: (grn: GoodsReceiveNote) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canProcessReturn?: boolean;
}

export function GRNTable({ grns, loading, onView, onEdit, onDelete, onPrint, onProcessReturn, canEdit, canDelete, canProcessReturn }: GRNTableProps) {
  // Ensure grns is always an array
  const safeGrns = Array.isArray(grns) ? grns : [];
  
  const [sortColumn, setSortColumn] = useState<string>("receivedDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency } = useCurrencyStore();

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN #</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Received Date</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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

  const sortedGrns = [...safeGrns].sort((a: any, b: any) => {
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
              onClick={() => handleSort("isDirect")}
            >
              Type
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("receivedDate")}
            >
              Received Date
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("receivedBy")}
            >
              Received By
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
          {sortedGrns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                No goods receive notes found.
              </TableCell>
            </TableRow>
          ) : (
            sortedGrns.map((grn) => (
                <TableRow key={grn.id}>
                  <TableCell>{grn.grnNumber || 'N/A'}</TableCell>
                  <TableCell>{grn.purchaseOrder?.orderNumber || "N/A"}</TableCell>
                  <TableCell>{grn.isDirect ? 'Direct' : 'Linked'}</TableCell>
                  <TableCell>{grn.receivedDate ? formatDate(grn.receivedDate) : 'N/A'}</TableCell>
                  <TableCell>
                    {grn.receivedByUser?.fullName || 
                     grn.receivedByUser?.name || 
                     grn.receivedByUser?.username || 
                     grn.receivedBy || 
                     'N/A'}
                  </TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    grn.status === "completed" ? "bg-green-100 text-green-800" :
                    grn.status === "partial" ? "bg-blue-100 text-blue-800" : 
                    grn.status === "rejected" ? "bg-red-100 text-red-800" : 
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {grn.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    grn.items?.reduce((sum, item) => {
                      const quantity = item.receivedQuantity || 0;
                      const unitCost = item.unitCost || 0;
                      const discount = item.discount || 0;
                      const tax = item.tax || 0;
                      const taxType = item.purchaseTaxType || 'exclusive';
                      
                      const subtotal = quantity * unitCost;
                      const amountAfterDiscount = subtotal - discount;
                      
                      let itemTotal;
                      if (taxType === 'inclusive') {
                        // For inclusive tax, total is the unit cost minus discount (tax is already included)
                        itemTotal = amountAfterDiscount;
                      } else {
                        // For exclusive tax, add tax on top
                        itemTotal = amountAfterDiscount + tax;
                      }
                      
                      return sum + itemTotal;
                    }, 0) || 0, 
                    currency
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(grn)}
                      disabled={grn.status === 'draft' || grn.status === 'partial'}
                      title={grn.status === 'draft' || grn.status === 'partial' 
                        ? `Cannot view ${grn.status} GRN` 
                        : "View GRN"}
                      className={grn.status === 'draft' || grn.status === 'partial' 
                        ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit && onEdit(grn)}
                        disabled={grn.status === 'completed' || grn.status === 'rejected'}
                        title={grn.status === 'completed' || grn.status === 'rejected' 
                          ? `Cannot edit ${grn.status} GRN` 
                          : "Edit GRN"}
                        className={grn.status === 'completed' || grn.status === 'rejected' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Edit GRN">
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
                     {onPrint && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPrint(grn)}
                        disabled={grn.status === 'draft' || grn.status === 'partial'}
                        title={grn.status === 'draft' || grn.status === 'partial' 
                          ? `Cannot print ${grn.status} GRN` 
                          : "Print GRN"}
                        className={grn.status === 'draft' || grn.status === 'partial' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {onProcessReturn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onProcessReturn(grn)}
                        disabled={grn.status !== "completed"}
                        title={grn.status !== "completed" 
                          ? `Cannot process return for ${grn.status} GRN` 
                          : "Process Return"}
                        className={grn.status !== "completed" 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete && onDelete(grn.id)}
                        disabled={grn.status === 'completed' || grn.status === 'rejected'}
                        title={grn.status === 'completed' || grn.status === 'rejected' 
                          ? `Cannot delete ${grn.status} GRN` 
                          : "Delete GRN"}
                        className={grn.status === 'completed' || grn.status === 'rejected' 
                          ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="icon" disabled title="Delete GRN">
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
