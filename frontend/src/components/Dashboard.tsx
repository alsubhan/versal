
import { 
  BarChart3, 
  BoxIcon, 
  ShoppingCart, 
  TrendingUp, 
  Users 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrencyStore } from "@/stores/currencyStore";
import { formatCurrency } from "@/lib/utils";

export const Dashboard = () => {
  const { currency } = useCurrencyStore();
  
  // This would be replaced with actual data from your backend
  const stats = [
    { 
      title: "Total Products", 
      value: "1,284", 
      change: "+12.5%", 
      icon: BoxIcon 
    },
    { 
      title: "Active Orders", 
      value: "32", 
      change: "+8.2%", 
      icon: ShoppingCart 
    },
    { 
      title: "Total Customers", 
      value: "384", 
      change: "+3.1%", 
      icon: Users 
    },
    { 
      title: "Revenue (MTD)", 
      value: formatCurrency(12743, currency),
      change: "+18.2%", 
      icon: TrendingUp 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>
              Monthly sales performance
            </CardDescription>
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
            <CardDescription>
              Latest warehouse operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div>
                  <div>
                    <p className="text-sm font-medium">Activity {i}</p>
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>
              Items that need reordering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">Product {i}</p>
                    <p className="text-xs text-gray-500">SKU-00{i}</p>
                  </div>
                  <div>
                    <span className="text-red-500 font-medium text-sm">
                      {i} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>
              Best performing products this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">Top Product {i}</p>
                    <p className="text-xs text-gray-500">SKU-10{i}</p>
                  </div>
                  <div>
                    <span className="text-green-500 font-medium text-sm">
                      {100 - i * 10} units
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
