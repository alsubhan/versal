
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BoxIcon, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatCurrency } from "@/lib/utils";
import { OverdueInvoices } from "./dashboard/OverdueInvoices";
import { getProducts, getSalesOrders, getSaleInvoices } from "@/lib/api";

export const Dashboard = () => {
  const { currency } = useCurrencyStore();

  const [productCount, setProductCount] = useState<number>(0);
  const [activeSalesOrders, setActiveSalesOrders] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [revenueMTD, setRevenueMTD] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, salesOrdersRes, saleInvoicesRes] = await Promise.all([
          getProducts().catch(() => []),
          getSalesOrders().catch(() => []),
          getSaleInvoices().catch(() => []),
        ]);

        const products = Array.isArray(productsRes) ? productsRes : [];
        setProductCount(products.length);

        const salesOrders = Array.isArray(salesOrdersRes) ? salesOrdersRes : [];
        const activeStatuses = new Set(["draft", "pending", "approved", "sent", "partial"]);
        setActiveSalesOrders(salesOrders.filter((so: any) => activeStatuses.has(String(so.status || ""))).length);

        // Customers count via products' joined customers is not reliable; skip unless an endpoint exists.
        setCustomerCount(0);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const invoices = Array.isArray(saleInvoicesRes) ? saleInvoicesRes : [];
        const revenue = invoices
          .filter((si: any) => {
            const d = new Date(si.invoiceDate || si.createdAt || 0);
            return d >= monthStart && d <= monthEnd && ["sent", "partial", "paid"].includes(String(si.status || ""));
          })
          .reduce((sum: number, si: any) => sum + Number(si.totalAmount || 0), 0);
        setRevenueMTD(revenue);
      } catch (e) {
        // Ignore; keep defaults
      }
    };
    load();
  }, []);

  const stats = useMemo(
    () => [
      { title: "Total Products", value: productCount.toLocaleString(), change: "", icon: BoxIcon },
      { title: "Active Orders", value: activeSalesOrders.toLocaleString(), change: "", icon: ShoppingCart },
      { title: "Total Customers", value: customerCount.toLocaleString(), change: "", icon: Users },
      { title: "Revenue (MTD)", value: formatCurrency(revenueMTD, currency), change: "", icon: TrendingUp },
    ],
    [productCount, activeSalesOrders, customerCount, revenueMTD, currency]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.change && (
                <p className={`text-xs ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{stat.change} from last month</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Monthly sales performance</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <div className="flex items-center justify-center h-full text-gray-500">
              <BarChart3 className="h-16 w-16" />
              <span className="ml-4 text-lg">Chart will be displayed here</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest warehouse operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Placeholder: wire to activity feed endpoint when available */}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>Items that need reordering</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* This component's page version shows low stock; keep this secondary card minimal for now */}
              <p className="text-sm text-muted-foreground">See Dashboard page for low stock details.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performing products this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Wire when an endpoint for top sellers is available */}
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        <OverdueInvoices />
      </div>
    </div>
  );
};
