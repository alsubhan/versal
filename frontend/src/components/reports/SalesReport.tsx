
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
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";

interface SalesReportProps {
  dateRange: DateRange;
}

export function SalesReport({ dateRange }: SalesReportProps) {
  const { currency } = useCurrencyStore();
  
  // Mock data for demonstration
  const salesData = [
    { id: 1, date: "2025-05-12", customer: "ABC Company", amount: 1500, status: "Completed" },
    { id: 2, date: "2025-05-13", customer: "XYZ Corp", amount: 2300, status: "Completed" },
    { id: 3, date: "2025-05-15", customer: "123 Industries", amount: 900, status: "Pending" },
    { id: 4, date: "2025-05-16", customer: "Global Traders", amount: 3200, status: "Completed" },
    { id: 5, date: "2025-05-17", customer: "Local Shop", amount: 450, status: "Completed" },
  ];

  const totalSales = salesData.reduce((sum, sale) => sum + sale.amount, 0);
  const completedSales = salesData.filter(sale => sale.status === "Completed").length;
  const dateRangeText = dateRange.from && dateRange.to ? 
    `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}` : 
    "All time";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(totalSales, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">For period: {dateRangeText}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales Count</CardDescription>
            <CardTitle className="text-3xl">{salesData.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{completedSales} completed orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Sale</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(totalSales / salesData.length, currency)}
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
          {salesData.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell>{sale.date}</TableCell>
              <TableCell>{sale.customer}</TableCell>
              <TableCell>{formatCurrency(sale.amount, currency)}</TableCell>
              <TableCell>{sale.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
