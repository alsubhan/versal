import { useState, useEffect } from "react";
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { getProductSerials } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";

export const ProductSerialsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [serials, setSerials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchSerials = async () => {
    try {
      setLoading(true);
      const data = await getProductSerials();
      setSerials(data || []);
    } catch (error) {
      console.error('Error fetching serials:', error);
      toast({
        title: "Error",
        description: "Failed to load product serials",
        variant: "destructive"
      });
      setSerials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSerials();
  }, []);

  const filteredSerials = serials.filter(item => {
    const searchStr = searchTerm.toLowerCase();
    return (
      (item.serial_number?.toLowerCase() || '').includes(searchStr) ||
      (item.products?.name?.toLowerCase() || '').includes(searchStr) ||
      (item.products?.sku_code?.toLowerCase() || '').includes(searchStr) ||
      (item.status?.toLowerCase() || '').includes(searchStr)
    );
  });
  
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800">Available</Badge>;
      case 'reserved':
        return <Badge className="bg-blue-100 text-blue-800">Reserved</Badge>;
      case 'sold':
        return <Badge className="bg-gray-100 text-gray-800">Sold</Badge>;
      case 'returned':
        return <Badge className="bg-orange-100 text-orange-800">Returned</Badge>;
      case 'scrapped':
        return <Badge className="bg-red-100 text-red-800">Scrapped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search serials, products, or SKU..."
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
          placeholder="Search serials, products, or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSerials.length > 0 ? (
              filteredSerials.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium font-mono">{item.serial_number}</TableCell>
                  <TableCell>{item.products?.name || 'Unknown Product'}</TableCell>
                  <TableCell>{item.products?.sku_code || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>{item.created_at ? format(new Date(item.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  {searchTerm ? "No serials found matching your search" : "No serialized products found in inventory"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
