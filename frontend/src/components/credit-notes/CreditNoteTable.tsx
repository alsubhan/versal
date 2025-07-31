
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
import { type CreditNote } from "@/types/credit-note";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCreditNotes } from "@/lib/api";
import { toast } from "sonner";

interface CreditNoteTableProps {
  onView: (creditNote: CreditNote) => void;
  onEdit?: (creditNote: CreditNote) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function CreditNoteTable({ 
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete
}: CreditNoteTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [sortColumn, setSortColumn] = useState<string>("creditDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { currency } = useCurrencyStore();

  // Fetch credit notes from backend
  useEffect(() => {
    const fetchCreditNotes = async () => {
      try {
        const data = await getCreditNotes();
        setCreditNotes(data);
      } catch (error) {
        console.error('Error fetching credit notes:', error);
        toast.error('Failed to fetch credit notes');
      } finally {
        setLoading(false);
      }
    };

    fetchCreditNotes();
  }, []);

  // Now do the conditional render
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credit Note #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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

  const sortedCreditNotes = [...creditNotes].sort((a: CreditNote, b: CreditNote) => {
    const aValue = a[sortColumn as keyof CreditNote];
    const bValue = b[sortColumn as keyof CreditNote];

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
              onClick={() => handleSort("creditNoteNumber")}
            >
              Credit Note #
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("customerName")}
            >
              Customer
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("creditDate")}
            >
              Date
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
          {sortedCreditNotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No credit notes found.
              </TableCell>
            </TableRow>
          ) : (
            sortedCreditNotes.map((creditNote) => (
              <TableRow key={creditNote.id}>
                <TableCell>{creditNote.creditNoteNumber}</TableCell>
                <TableCell>{creditNote.customerName}</TableCell>
                <TableCell>{formatDate(creditNote.creditDate)}</TableCell>
                <TableCell>
                  <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                    creditNote.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                    creditNote.status === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : 
                    creditNote.status === "processed" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" : 
                    creditNote.status === "cancelled" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}>
                    {creditNote.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(creditNote.totalAmount, currency)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(creditNote)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onEdit && onEdit(creditNote)}
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
                            You do not have permission to edit credit notes
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                        onClick={() => onDelete && onDelete(creditNote.id)}
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
                            You do not have permission to delete credit notes
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
