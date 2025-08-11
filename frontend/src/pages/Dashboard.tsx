import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Users,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';
import { PermissionGuard } from '@/components/ui/permission-guard';
import {
  getProducts,
  getPurchaseOrders,
  getSalesOrders,
  getSaleInvoices,
  getCreditNotes,
  getCustomers,
  getSuppliers,
} from '@/lib/api';
import { useCurrencyStore } from '@/stores/currencyStore';
import { formatCurrency } from '@/lib/utils';

export default function Dashboard() {
  const { hasPermission, loading } = useAuth();
  const canViewDashboard = hasPermission('dashboard_view');
  const { currency } = useCurrencyStore();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [activeSalesOrders, setActiveSalesOrders] = useState(0);
  const [recentPurchaseOrders, setRecentPurchaseOrders] = useState<any[]>([]);
  const [lowStockList, setLowStockList] = useState<{ name: string; current: number; minimum: number }[]>([]);
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [activeSuppliers, setActiveSuppliers] = useState(0);
  const [salesThisMonth, setSalesThisMonth] = useState(0);
  const [returnsThisMonth, setReturnsThisMonth] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoadingData(true);
        const [productsRes, soRes, poRes, siRes, cnRes, customersRes, suppliersRes] = await Promise.all([
          getProducts().catch(() => []),
          getSalesOrders().catch(() => []),
          getPurchaseOrders().catch(() => []),
          getSaleInvoices().catch(() => []),
          getCreditNotes().catch(() => []),
          getCustomers().catch(() => []),
          getSuppliers().catch(() => []),
        ]);

        const products = Array.isArray(productsRes) ? productsRes : [];
        setTotalProducts(products.length);

        // Inventory valuation: sum(quantity_on_hand or quantity_available) * cost_price
        const inventoryValue = products.reduce((sum: number, p: any) => {
          const stockLevels = Array.isArray(p.stock_levels) ? p.stock_levels : [];
          const quantity = stockLevels.reduce((q: number, lvl: any) => {
            const qa = Number(lvl.quantity_available ?? 0);
            const qh = Number(lvl.quantity_on_hand ?? 0);
            return q + (Number.isFinite(qa) && qa > 0 ? qa : qh);
          }, 0);
          const cost = Number(p.cost_price ?? 0) || 0;
          return sum + quantity * cost;
        }, 0);
        setTotalInventoryValue(inventoryValue);

        const activeStatuses = new Set(['draft', 'pending', 'approved', 'sent', 'partial']);
        const salesOrders = Array.isArray(soRes) ? soRes : [];
        setActiveSalesOrders(salesOrders.filter((so: any) => activeStatuses.has(String(so.status || ''))).length);

        const purchaseOrders = Array.isArray(poRes) ? poRes : [];
        const recentPOs = [...purchaseOrders]
          .sort((a: any, b: any) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime())
          .slice(0, 3)
          .map((po: any) => ({
            id: po.orderNumber,
            supplier: po.supplier?.name || '—',
            amount: formatCurrency(Number(po.totalAmount || 0), currency),
            status: po.status || '—',
          }));
        setRecentPurchaseOrders(recentPOs);

        // Low stock detection from product minimums/reorder points
        const lowStock = products
          .map((p: any) => {
            const stockLevels = Array.isArray(p.stock_levels) ? p.stock_levels : [];
            const qty = stockLevels.reduce((q: number, lvl: any) => {
              const qa = Number(lvl.quantity_available ?? 0);
              const qh = Number(lvl.quantity_on_hand ?? 0);
              return q + (Number.isFinite(qa) && qa > 0 ? qa : qh);
            }, 0);
            const threshold = Number(p.reorder_point ?? p.minimum_stock ?? 0) || 0;
            return { name: p.name || 'Unnamed', current: qty, minimum: threshold };
          })
          .filter((i: any) => i.minimum > 0 && i.current <= i.minimum)
          .sort((a: any, b: any) => a.current - b.current)
          .slice(0, 6);
        setLowStockList(lowStock);

        setActiveCustomers(Array.isArray(customersRes) ? customersRes.filter((c: any) => c.isActive !== false).length : 0);
        setActiveSuppliers(Array.isArray(suppliersRes) ? suppliersRes.filter((s: any) => s.isActive !== false).length : 0);

        // This month sales and returns
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const salesInvoices = Array.isArray(siRes) ? siRes : [];
        const monthlySales = salesInvoices
          .filter((si: any) => {
            const d = new Date(si.invoiceDate || si.createdAt || 0);
            return d >= monthStart && d <= monthEnd && ['sent', 'partial', 'paid'].includes(String(si.status || ''));
          })
          .reduce((sum: number, si: any) => sum + Number(si.totalAmount || 0), 0);
        setSalesThisMonth(monthlySales);

        const creditNotes = Array.isArray(cnRes) ? cnRes : [];
        const monthlyReturns = creditNotes
          .filter((cn: any) => {
            const d = new Date(cn.creditDate || cn.createdAt || 0);
            return d >= monthStart && d <= monthEnd && String(cn.status || '') !== 'cancelled';
          })
          .reduce((sum: number, cn: any) => sum + Number(cn.totalAmount || 0), 0);
        setReturnsThisMonth(monthlyReturns);
      } catch (e) {
        // Fail silently; UI will show zeros/empty
      } finally {
        setIsLoadingData(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }



  return (
    <PermissionGuard 
      requiredPermission="dashboard_view"
      fallbackMessage="You do not have permission to view the dashboard. Please contact an administrator."
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
          Welcome to your warehouse management dashboard
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingData ? '—' : totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Products in catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingData ? '—' : formatCurrency(totalInventoryValue, currency)}</div>
            <p className="text-xs text-muted-foreground">Based on cost price</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingData ? '—' : activeSalesOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Open sales orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingData ? '—' : lowStockList.length}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Purchase Orders</CardTitle>
            <CardDescription>
              Latest purchase orders in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isLoadingData ? Array.from({ length: 3 }) : recentPurchaseOrders).map((order: any, idx: number) => (
                <div key={order?.id || idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{order?.id || '—'}</p>
                    <p className="text-xs text-muted-foreground">{order?.supplier || '—'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">{order?.amount || '—'}</p>
                    {order && (
                      <Badge variant={order.status === 'pending' ? 'default' : order.status === 'approved' ? 'secondary' : 'outline'}>
                        {String(order.status || '—')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>
              Overview of key metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Customers</span>
              </div>
              <span className="text-sm font-medium">{isLoadingData ? '—' : activeCustomers}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Suppliers</span>
              </div>
              <span className="text-sm font-medium">{isLoadingData ? '—' : activeSuppliers}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">Sales This Month</span>
              </div>
              <span className="text-sm font-medium text-green-600">{isLoadingData ? '—' : formatCurrency(salesThisMonth, currency)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm">Returns This Month</span>
              </div>
              <span className="text-sm font-medium text-red-600">{isLoadingData ? '—' : formatCurrency(returnsThisMonth, currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
            <AlertTriangle className="h-5 w-5" />
            <span>Low Stock Alert</span>
          </CardTitle>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            The following items are running low and need restocking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {(isLoadingData ? [] : lowStockList).map((item) => (
              <div key={item.name} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.current}/{item.minimum}</span>
              </div>
            ))}
            {!isLoadingData && lowStockList.length === 0 && (
              <div className="text-sm text-muted-foreground">No low stock items</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </PermissionGuard>
  );
}