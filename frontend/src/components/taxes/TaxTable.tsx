
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from "react";
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Search } from "lucide-react";
import { type Tax } from "@/types/tax";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTaxes } from "@/lib/api";

interface TaxTableProps {
  onEdit: (tax: Tax) => void;
}

export function TaxTable({ onEdit }: TaxTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const { hasPermission } = useAuth();
  const canEditTaxes = hasPermission('taxes_edit');
  
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
  
  const filteredTaxes = taxes.filter(tax => 
    tax.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tax.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tax rates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate (%)</TableHead>
              <TableHead>Applied To</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTaxes.length > 0 ? (
              filteredTaxes.map((tax) => (
                <TableRow key={tax.id}>
                  <TableCell className="font-medium">{tax.name}</TableCell>
                  <TableCell>{tax.rate}%</TableCell>
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
                    {tax.isDefault && (
                      <Badge className="bg-green-100 text-green-800">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tax.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
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
    </div>
  );
};
