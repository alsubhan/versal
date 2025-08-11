
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProducts } from "@/lib/api";

interface InventoryReportProps {
  dateRange: DateRange;
  isActive?: boolean;
  registerDataProvider?: (provider: () => { title: string; columns: { key: string; label: string }[]; rows: any[] }) => void;
}

export function InventoryReport({ dateRange, isActive, registerDataProvider }: InventoryReportProps) {
  const [rows, setRows] = useState<{
    id: string;
    product: string;
    sku: string;
    inStock: number;
    reorderPoint: number;
    lastUpdated: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const productsRes = await getProducts().catch(() => []);
        const products = Array.isArray(productsRes) ? productsRes : [];
        const mapped = products.map((p: any) => {
          const stockLevels = Array.isArray(p.stock_levels) ? p.stock_levels : [];
          const totalQty = stockLevels.reduce((q: number, lvl: any) => {
            const qa = Number(lvl.quantity_available ?? 0);
            const qh = Number(lvl.quantity_on_hand ?? 0);
            return q + (Number.isFinite(qa) && qa > 0 ? qa : qh);
          }, 0);
          const threshold = Number(p.reorder_point ?? p.minimum_stock ?? 0) || 0;
          return {
            id: p.id,
            product: p.name || 'Unnamed',
            sku: p.sku_code || '',
            inStock: totalQty,
            reorderPoint: threshold,
            lastUpdated: p.updated_at || p.created_at || '',
          };
        });
        setRows(mapped);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Register export data provider
  useEffect(() => {
    if (!registerDataProvider || !isActive) return;
    registerDataProvider(() => ({
      title: 'Inventory Report',
      columns: [
        { key: 'product', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'inStock', label: 'In Stock' },
        { key: 'reorderPoint', label: 'Reorder Point' },
        { key: 'status', label: 'Status' },
        { key: 'lastUpdated', label: 'Last Updated' },
      ],
      rows: rows.map((r) => ({
        ...r,
        status: r.inStock <= r.reorderPoint ? 'Low Stock' : 'Ok',
        lastUpdated: r.lastUpdated ? new Date(r.lastUpdated).toISOString().slice(0, 10) : '',
      })),
    }));
  }, [registerDataProvider, isActive, rows]);

  const totalItems = useMemo(() => rows.reduce((sum, item) => sum + item.inStock, 0), [rows]);
  const lowStockItems = useMemo(() => rows.filter((item) => item.inStock <= item.reorderPoint), [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Inventory</CardDescription>
          <CardTitle className="text-3xl">{isLoading ? '—' : totalItems.toLocaleString()} units</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across {isLoading ? '—' : rows.length} products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Stock Items</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '—' : lowStockItems.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Products below reorder point</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Stock Level</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading || rows.length === 0
                ? '—'
                : (totalItems / rows.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Loading…</TableCell>
            </TableRow>
          ) : rows.length > 0 ? (
            rows.map((item) => (
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
                <TableCell>{item.lastUpdated ? new Date(item.lastUpdated).toISOString().slice(0, 10) : ''}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No results</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
