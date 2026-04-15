
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
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Edit, Trash2 } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { type PurchaseIndent } from "@/types/purchase-indent";
import { useCurrencyStore } from "@/stores/currencyStore";

interface PurchaseIndentTableProps {
  indents: PurchaseIndent[];
  loading: boolean;
  onView?: (indent: PurchaseIndent) => void;
  onEdit?: (indent: PurchaseIndent) => void;
  onDelete?: (id: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function PurchaseIndentTable({ 
  indents, 
  loading, 
  onView,
  onEdit, 
  onDelete,
  selectedIds,
  onSelectionChange
}: PurchaseIndentTableProps) {
  const safeIndents = Array.isArray(indents) ? indents : [];
  const [sortColumn, setSortColumn] = useState<string>("createdAt");
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

  const sortedIndents = [...safeIndents].sort((a: any, b: any) => {
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    if (sortColumn === "requester.fullName") {
      aValue = a.requester?.fullName;
      bValue = b.requester?.fullName;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(safeIndents.filter(i => i.status === 'approved').map(i => i.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(i => i !== id));
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Indent #</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Required Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Est. Value</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox 
                checked={selectedIds.length > 0 && selectedIds.length === safeIndents.length}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("indentNumber")}>Indent #</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("requester.fullName")}>Requester</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("department")}>Department</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("requiredDate")}>Required Date</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>Status</TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("totalEstimatedValue")}>Est. Value</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIndents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                No purchase indents found
              </TableCell>
            </TableRow>
          ) : (
            sortedIndents.map((indent) => (
              <TableRow key={indent.id} className={selectedIds.includes(indent.id) ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(indent.id)}
                    onCheckedChange={(checked) => handleSelectOne(indent.id, !!checked)}
                    disabled={indent.status !== 'approved'}
                  />
                </TableCell>
                <TableCell className="font-medium">{indent.indentNumber}</TableCell>
                <TableCell>{indent.requester?.fullName || 'N/A'}</TableCell>
                <TableCell>{indent.department || 'General'}</TableCell>
                <TableCell>{formatDate(indent.requiredDate)}</TableCell>
                <TableCell>
                    <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                        indent.status === "approved" ? "bg-green-100 text-green-800" :
                        indent.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        indent.status === "rejected" ? "bg-red-100 text-red-800" :
                        indent.status === "converted" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-800"
                    }`}>
                        {indent.status}
                    </span>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(indent.totalEstimatedValue, currency)}</TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => onView?.(indent)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit?.(indent)}
                        disabled={indent.status !== 'draft' && indent.status !== 'pending'}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onDelete?.(indent.id)}
                        disabled={indent.status === 'approved' || indent.status === 'converted'}
                    >
                      <Trash2 className="h-4 w-4" />
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
