
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

interface PurchaseReportProps {
  dateRange: DateRange;
}

export function PurchaseReport({ dateRange }: PurchaseReportProps) {
  const { currency } = useCurrencyStore();
  
  // Mock data for demonstration
  const purchaseData = [
    { id: "PO-001", date: "2025-05-10", supplier: "Main Supplier Co", amount: 5200, status: "Received" },
    { id: "PO-002", date: "2025-05-12", supplier: "Quality Goods Inc", amount: 3400, status: "Pending" },
    { id: "PO-003", date: "2025-05-14", supplier: "Fast Delivery LLC", amount: 1800, status: "Received" },
    { id: "PO-004", date: "2025-05-15", supplier: "Main Supplier Co", amount: 2700, status: "Processing" },
    { id: "PO-005", date: "2025-05-17", supplier: "Wholesale Direct", amount: 6100, status: "Received" },
  ];

  const totalSpent = purchaseData.reduce((sum, order) => sum + order.amount, 0);
  const receivedOrders = purchaseData.filter(po => po.status === "Received");
  const dateRangeText = dateRange.from && dateRange.to ? 
    `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}` : 
    "All time";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Purchases</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(totalSpent, currency)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">For period: {dateRangeText}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orders</CardDescription>
            <CardTitle className="text-3xl">{purchaseData.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{receivedOrders.length} received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Order</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(totalSpent / purchaseData.length, currency)}
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
          {purchaseData.map((order) => (
            <TableRow key={order.id}>
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.date}</TableCell>
              <TableCell>{order.supplier}</TableCell>
              <TableCell>{formatCurrency(order.amount, currency)}</TableCell>
              <TableCell>
                <span 
                  className={
                    order.status === "Received" ? "text-green-500 font-medium" : 
                    order.status === "Pending" ? "text-amber-500 font-medium" :
                    "text-blue-500 font-medium"
                  }
                >
                  {order.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
