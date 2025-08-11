
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from "react";
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Search, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { type Tax } from "@/types/tax";
import { formatTaxRate } from "@/lib/number-utils";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTaxes, deleteTax } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TaxTableProps {
  onEdit: (tax: Tax) => void;
  searchTerm?: string;
  onRefresh?: () => void;
}

export function TaxTable({ onEdit, searchTerm = "", onRefresh }: TaxTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<Tax | undefined>(undefined);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { hasPermission } = useAuth();
  const canEditTaxes = hasPermission('taxes_edit');
  const canDeleteTaxes = hasPermission('taxes_delete');
  
  // Fetch taxes from backend
  useEffect(() => {
    const fetchTaxes = async () => {
      try {
        const data = await getTaxes();
        setTaxes(data);
      } catch (error) {
        console.error('Error fetching taxes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxes();
  }, []);

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sortable header component
  const SortableHeader = ({ 
    field, 
    children, 
    className = "" 
  }: {
    field: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const isActive = sortField === field;
    
    return (
      <TableHead 
        className={`cursor-pointer select-none hover:bg-gray-50 ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${isActive && sortDirection === "asc" ? "text-blue-600" : "text-gray-400"}`} 
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${isActive && sortDirection === "desc" ? "text-blue-600" : "text-gray-400"}`} 
            />
          </div>
        </div>
      </TableHead>
    );
  };

  // Now do the conditional render
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  
  const handleOpenDeleteDialog = (tax: Tax) => {
    setSelectedTax(tax);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTax = async () => {
    if (!selectedTax) return;
    
    try {
      await deleteTax(selectedTax.id);
      setTaxes(taxes.filter((tax) => tax.id !== selectedTax.id));
      setDeleteDialogOpen(false);
      toast.success("Tax deleted successfully");
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting tax:', error);
      toast.error('Failed to delete tax');
    }
  };

  // Filter and sort taxes
  const filteredAndSortedTaxes = taxes
    .filter(tax => 
      tax.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue = "";
      let bValue = "";
      
      switch (sortField) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "rate":
          // For numeric sorting
          return sortDirection === "asc" ? a.rate - b.rate : b.rate - a.rate;
        default:
          return 0;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="name">Name</SortableHeader>
              <SortableHeader field="rate">Rate (%)</SortableHeader>
              <TableHead>Applied To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTaxes.length > 0 ? (
              filteredAndSortedTaxes.map((tax) => (
                <TableRow key={tax.id}>
                  <TableCell className="font-medium">{tax.name}</TableCell>
                  <TableCell>{formatTaxRate(tax.rate)}%</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {tax.appliedTo === "both" 
                        ? "Products & Services" 
                        : tax.appliedTo === "products" 
                          ? "Products" 
                          : "Services"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {tax.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {canEditTaxes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(tax)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to edit tax rates
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {canDeleteTaxes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(tax)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to delete tax rates
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  No tax rates found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tax rate "{selectedTax?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTax}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
