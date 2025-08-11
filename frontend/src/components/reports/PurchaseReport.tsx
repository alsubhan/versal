
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getPurchaseOrders } from "@/lib/api";

interface PurchaseReportProps {
  dateRange: DateRange;
  isActive?: boolean;
  registerDataProvider?: (provider: () => { title: string; columns: { key: string; label: string }[]; rows: any[] }) => void;
}

export function PurchaseReport({ dateRange, isActive, registerDataProvider }: PurchaseReportProps) {
  const { currency } = useCurrencyStore();
  const [rows, setRows] = useState<{ id: string; date: string; supplier: string; amount: number; status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getPurchaseOrders().catch(() => []);
        const from = dateRange.from ? new Date(dateRange.from) : null;
        const to = dateRange.to ? new Date(dateRange.to) : null;
        if (from) {
          from.setHours(0, 0, 0, 0);
        }
        if (to) {
          to.setHours(23, 59, 59, 999);
        }
        const filtered = (Array.isArray(data) ? data : [])
          .filter((po: any) => {
            const d = new Date(po.orderDate || po.createdAt || 0);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
          })
          .map((po: any) => ({
            id: po.orderNumber || po.id,
            date: (po.orderDate ? new Date(po.orderDate) : new Date(po.createdAt || 0)).toISOString().slice(0, 10),
            supplier: po.supplier?.name || '—',
            amount: Number(po.totalAmount || 0),
            status: String(po.status || '').toLowerCase(),
          }));
        setRows(filtered);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [dateRange.from, dateRange.to]);

  // Register export data provider
  useEffect(() => {
    if (!registerDataProvider || !isActive) return;
    registerDataProvider(() => ({
      title: 'Purchase Report',
      columns: [
        { key: 'id', label: 'PO Number' },
        { key: 'date', label: 'Date' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    }));
  }, [registerDataProvider, isActive, rows]);

  const totalSpent = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);
  const receivedOrders = useMemo(() => rows.filter((r) => r.status === 'received'), [rows]);
  const dateRangeText = dateRange.from && dateRange.to ? 
    `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}` : 
    "All time";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Purchases</CardDescription>
          <CardTitle className="text-3xl">{isLoading ? '—' : formatCurrency(totalSpent, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">For period: {dateRangeText}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orders</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '—' : rows.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{isLoading ? '—' : receivedOrders.length} received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Order</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading || rows.length === 0 ? '—' : formatCurrency(totalSpent / rows.length, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Per purchase order</p>
          </CardContent>
        </Card>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Loading…</TableCell>
            </TableRow>
          ) : rows.length > 0 ? (
            rows.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>{order.supplier}</TableCell>
                <TableCell>{formatCurrency(order.amount, currency)}</TableCell>
                <TableCell>
                  <span
                    className={
                      order.status === 'received'
                        ? 'text-green-500 font-medium'
                        : order.status === 'pending'
                        ? 'text-amber-500 font-medium'
                        : 'text-blue-500 font-medium'
                    }
                  >
                    {order.status}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No results</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
