import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Package, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut, 
  MenuIcon,
  User,
  Shield,
  Home,
  Boxes,
  FolderTree,
  Ruler,
  FileText,
  Truck,
  ShoppingCart,
  ClipboardCheck,
  CreditCard,
  Barcode,
  UploadCloud,
  Receipt,
  Calculator
} from "lucide-react";

// Add prop for performance dashboard toggle
type SidebarProps = {
  onPerformanceToggle?: () => void;
};

const sidebarLinks = [{
  name: "Dashboard",
  href: "/",
  icon: Home,
  permission: 'dashboard_view'
}, {
  name: "Products",
  href: "/products",
  icon: Boxes,
  permission: 'products_view'
}, {
  name: "Categories",
  href: "/categories",
  icon: FolderTree,
  permission: 'categories_view'
}, {
  name: "Units",
  href: "/units",
  icon: Ruler,
  permission: 'units_view'
}, {
  name: "Taxes",
  href: "/taxes",
  icon: Calculator,
  permission: 'taxes_view'
}, {
  name: "Suppliers",
  href: "/suppliers",
  icon: Truck,
  permission: 'suppliers_view'
}, {
  name: "Customers",
  href: "/customers",
  icon: Users,
  permission: 'customers_view'
}, {
  name: "Inventory",
  href: "/inventory",
  icon: Package,
  permission: 'inventory_view'
}, {
  name: "Purchase Orders",
  href: "/purchase-orders",
  icon: ShoppingCart,
  permission: 'purchase_orders_view'
}, {
  name: "Goods Receive Notes",
  href: "/grns",
  icon: ClipboardCheck,
  permission: 'grn_view'
}, {
  name: "Sale Orders",
  href: "/sale-orders",
  icon: FileText,
  permission: 'sale_orders_view'
}, {
  name: "Sale Invoices",
  href: "/sale-invoices",
  icon: Receipt,
  permission: 'sale_invoices_view'
}, {
  name: "Credit Notes",
  href: "/credit-notes",
  icon: CreditCard,
  permission: 'credit_notes_view'
}, {
  name: "Reports",
  href: "/reports",
  icon: BarChart3,
  permission: 'reports_view'
}, {
  name: "Barcode Printing",
  href: "/barcodes",
  icon: Barcode,
  permission: 'barcode_view'
}, {
  name: "Backup & Restore",
  href: "/backup",
  icon: UploadCloud,
  permission: 'backup_view'
}, {
  name: "Users & Roles",
  href: "/users",
  icon: User,
  permission: 'users_view'
}, {
  name: "Settings",
  href: "/settings",
  icon: Settings,
  permission: 'settings_view'
}
];

export const Sidebar = ({ onPerformanceToggle }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    user,
    signOut,
    hasPermission
  } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => {
      clearInterval(timer);
    };
  }, []);
  
  const handleLogout = () => {
    signOut();
  };

  const formattedDate = currentTime.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
  
  const initials = user?.user_metadata?.full_name ? `${user.user_metadata.full_name.split(' ')[0][0]}${user.user_metadata.full_name.split(' ')[1]?.[0] || ''}` : user?.email?.[0]?.toUpperCase() || 'U';
  
  // Filter navigation items based on user permissions
  const filteredSidebarLinks = sidebarLinks.filter(link => {
    // If no permission is required, show the item
    if (!link.permission) return true;
    
    // Check if user has the required permission
    return hasPermission(link.permission);
  });
  
  return <div className={cn("flex flex-col border-r bg-card border-border h-screen transition-all duration-300", collapsed ? "w-16" : "w-64")}>
      <div className="flex items-center justify-between p-4 border-b border-border h-16">
        {!collapsed && (
          <div 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onPerformanceToggle}
            title="Click to open Performance Dashboard"
          >
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Versal WMS</h1>
              <p className="text-xs text-muted-foreground">Warehouse Management</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="h-8 w-8">
            <MenuIcon size={20} />
          </Button>
        </div>
      </div>

      {!collapsed && <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {formattedDate}
        </div>}
      
      <ScrollArea className="flex-1">
        <div className={cn("flex flex-col gap-1 p-2")}>
          {filteredSidebarLinks.map(link => {
          const isActive = location.pathname === link.href;
          return <Link key={link.name} to={link.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                <link.icon className={collapsed ? "h-7 w-7" : "h-5 w-5"} />
                {!collapsed && <span>{link.name}</span>}
              </Link>;
        })}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-start gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src="" />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && <div className="flex flex-col items-start text-sm">
                  <span className="font-medium">{user?.user_metadata?.full_name || user?.email || 'User'}</span>
                </div>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/user-settings" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>;
}; 