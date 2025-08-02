
import { useState, useEffect } from "react";
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Search, Trash2 } from "lucide-react";
import { type StockLevel } from "@/types/inventory";
import { getStockLevels, deleteStockLevel } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
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

interface StockLevelTableProps {
  onEdit: (stockLevel: StockLevel) => void;
  canEdit?: boolean;
}

export const StockLevelTable = ({ onEdit, canEdit = true }: StockLevelTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockLevelToDelete, setStockLevelToDelete] = useState<StockLevel | null>(null);
  
  const fetchStockLevels = async () => {
    try {
      setLoading(true);
      const data = await getStockLevels();
      setStockLevels(data || []);
    } catch (error) {
      console.error('Error fetching stock levels:', error);
      toast({
        title: "Error",
        description: "Failed to load stock levels",
        variant: "destructive"
      });
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockLevels();
  }, []);

  const handleDelete = async (stockLevel: StockLevel) => {
    setStockLevelToDelete(stockLevel);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!stockLevelToDelete) return;
    
    try {
      await deleteStockLevel(stockLevelToDelete.id);
      toast({
        title: "Success",
        description: "Stock level deleted successfully"
      });
      fetchStockLevels(); // Refresh the list
    } catch (error) {
      console.error('Error deleting stock level:', error);
      toast({
        title: "Error",
        description: "Failed to delete stock level",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setStockLevelToDelete(null);
    }
  };
  
  const filteredStockLevels = stockLevels.filter(item => 
    (item.productName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (item.skuCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (item.locationName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const getStockStatusBadge = (stockLevel: StockLevel) => {
    if (stockLevel.quantityAvailable <= 0) {
      return <Badge className="bg-red-100 text-red-800">Out of Stock</Badge>;
    } else if (stockLevel.quantityAvailable <= 10) {
      return <Badge className="bg-yellow-100 text-yellow-800">Low Stock</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">In Stock</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products or locations..."
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
          placeholder="Search products or locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>On Hand</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStockLevels.length > 0 ? (
              filteredStockLevels.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName || 'N/A'}</TableCell>
                  <TableCell>{item.skuCode || 'N/A'}</TableCell>
                  <TableCell>{item.locationName || 'N/A'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.quantityReserved}</TableCell>
                  <TableCell>{item.quantityAvailable}</TableCell>
                  <TableCell>
                    {getStockStatusBadge(item)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  {searchTerm ? "No stock items found matching your search" : "No stock items found"}
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
            <AlertDialogTitle>Delete Stock Level</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the stock level for "{stockLevelToDelete?.productName || 'Unknown Product'}" at "{stockLevelToDelete?.locationName || 'Unknown Location'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
