
import { DateRange } from "react-day-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InventoryReportProps {
  dateRange: DateRange;
}

export function InventoryReport({ dateRange }: InventoryReportProps) {
  // Mock data for demonstration
  const inventoryData = [
    { id: 1, product: "Widget A", sku: "WID-001", inStock: 120, reorderPoint: 20, lastUpdated: "2025-05-15" },
    { id: 2, product: "Widget B", sku: "WID-002", inStock: 85, reorderPoint: 15, lastUpdated: "2025-05-16" },
    { id: 3, product: "Gadget X", sku: "GAD-001", inStock: 45, reorderPoint: 10, lastUpdated: "2025-05-14" },
    { id: 4, product: "Gadget Y", sku: "GAD-002", inStock: 12, reorderPoint: 25, lastUpdated: "2025-05-17" },
    { id: 5, product: "Tool Z", sku: "TL-100", inStock: 56, reorderPoint: 15, lastUpdated: "2025-05-13" },
  ];

  const totalItems = inventoryData.reduce((sum, item) => sum + item.inStock, 0);
  const lowStockItems = inventoryData.filter(item => item.inStock <= item.reorderPoint);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Inventory</CardDescription>
            <CardTitle className="text-3xl">{totalItems.toLocaleString()} units</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across {inventoryData.length} products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Stock Items</CardDescription>
            <CardTitle className="text-3xl">{lowStockItems.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Products below reorder point</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Stock Level</CardDescription>
            <CardTitle className="text-3xl">
              {(totalItems / inventoryData.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Units per product</p>
          </CardContent>
        </Card>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>In Stock</TableHead>
            <TableHead>Reorder Point</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventoryData.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.product}</TableCell>
              <TableCell>{item.sku}</TableCell>
              <TableCell>{item.inStock}</TableCell>
              <TableCell>{item.reorderPoint}</TableCell>
              <TableCell>
                {item.inStock <= item.reorderPoint ? (
                  <span className="text-red-500 font-medium">Low Stock</span>
                ) : (
                  <span className="text-green-500 font-medium">Ok</span>
                )}
              </TableCell>
              <TableCell>{item.lastUpdated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
