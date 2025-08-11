
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getSaleInvoices } from "@/lib/api";

interface SalesReportProps {
  dateRange: DateRange;
  isActive?: boolean;
  registerDataProvider?: (provider: () => { title: string; columns: { key: string; label: string }[]; rows: any[] }) => void;
}

export function SalesReport({ dateRange, isActive, registerDataProvider }: SalesReportProps) {
  const { currency } = useCurrencyStore();
  const [rows, setRows] = useState<{ id: string; date: string; customer: string; amount: number; status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getSaleInvoices().catch(() => []);
        const from = dateRange.from ? new Date(dateRange.from) : null;
        const to = dateRange.to ? new Date(dateRange.to) : null;
        if (from) {
          from.setHours(0, 0, 0, 0);
        }
        if (to) {
          to.setHours(23, 59, 59, 999);
        }
        const filtered = (Array.isArray(data) ? data : [])
          .filter((si: any) => {
            const d = new Date(si.invoiceDate || si.createdAt || 0);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
          })
          .map((si: any) => ({
            id: si.invoiceNumber || si.id,
            date: (si.invoiceDate ? new Date(si.invoiceDate) : new Date(si.createdAt || 0)).toISOString().slice(0, 10),
            customer: si.customer?.name || "—",
            amount: Number(si.totalAmount || 0),
            status: String(si.status || "draft").toLowerCase(),
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
      title: 'Sales Report',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    }));
  }, [registerDataProvider, isActive, rows]);

  const totalSales = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);
  const completedSales = useMemo(
    () => rows.filter((r) => ["paid", "completed", "sent"].includes(r.status)).length,
    [rows]
  );
  const dateRangeText = dateRange.from && dateRange.to ? 
    `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}` : 
    "All time";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales</CardDescription>
          <CardTitle className="text-3xl">{isLoading ? '—' : formatCurrency(totalSales, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">For period: {dateRangeText}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales Count</CardDescription>
            <CardTitle className="text-3xl">{isLoading ? '—' : rows.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{isLoading ? '—' : completedSales} completed orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Sale</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading || rows.length === 0 ? '—' : formatCurrency(totalSales / rows.length, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Loading…</TableCell>
            </TableRow>
          ) : rows.length > 0 ? (
            rows.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{sale.date}</TableCell>
                <TableCell>{sale.customer}</TableCell>
                <TableCell>{formatCurrency(sale.amount, currency)}</TableCell>
                <TableCell>{sale.status}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No results</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
