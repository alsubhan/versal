
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { type InventoryMovement } from "@/types/inventory";
import { getInventoryMovements } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";

export const InventoryMovementsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchMovements = async () => {
    try {
      setLoading(true);
      const data = await getInventoryMovements();
      setMovements(data || []);
    } catch (error) {
      console.error('Error fetching inventory movements:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory movements",
        variant: "destructive"
      });
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);
  
  const filteredMovements = movements.filter(movement => 
    (movement.productName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (movement.skuCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (movement.reference?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (movement.type?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const getMovementTypeBadge = (type: InventoryMovement["type"]) => {
    switch (type) {
      case "purchase":
        return <Badge className="bg-green-100 text-green-800">Purchase</Badge>;
      case "sale":
        return <Badge className="bg-blue-100 text-blue-800">Sale</Badge>;
      case "adjustment":
        return <Badge className="bg-yellow-100 text-yellow-800">Adjustment</Badge>;
      case "transfer":
        return <Badge className="bg-purple-100 text-purple-800">Transfer</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search movements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            disabled
          />
        </div>
        
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search movements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Previous Stock</TableHead>
              <TableHead>New Stock</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMovements.length > 0 ? (
              filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{format(new Date(movement.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{movement.productName || 'N/A'}</TableCell>
                  <TableCell>{getMovementTypeBadge(movement.type)}</TableCell>
                  <TableCell className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                  </TableCell>
                  <TableCell>{movement.previousStock}</TableCell>
                  <TableCell>{movement.newStock}</TableCell>
                  <TableCell>
                    {movement.type === "transfer" && movement.fromLocationName && movement.toLocationName 
                      ? `${movement.fromLocationName} → ${movement.toLocationName}`
                      : movement.fromLocationName || movement.toLocationName || "-"
                    }
                  </TableCell>
                  <TableCell>{movement.reference || "-"}</TableCell>
                  <TableCell>{movement.createdBy}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-4">
                  {searchTerm ? "No movements found matching your search" : "No movements found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
