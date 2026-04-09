import { useState, useEffect, useMemo } from "react";
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
  Menu,
  User,
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
  Calculator,
  SearchCheck,
  PackageOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type SidebarProps = {
  onPerformanceToggle?: () => void;
};

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard",  href: "/",           icon: Home,          permission: "dashboard_view" },
      { name: "Reports",    href: "/reports",     icon: BarChart3,     permission: "reports_view" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { name: "Products",   href: "/products",   icon: Boxes,         permission: "products_view" },
      { name: "Categories", href: "/categories", icon: FolderTree,    permission: "categories_view" },
      { name: "Units",      href: "/units",       icon: Ruler,         permission: "units_view" },
      { name: "Taxes",      href: "/taxes",       icon: Calculator,    permission: "taxes_view" },
    ],
  },
  {
    label: "Parties",
    items: [
      { name: "Suppliers",  href: "/suppliers",  icon: Truck,         permission: "suppliers_view" },
      { name: "Customers",  href: "/customers",  icon: Users,         permission: "customers_view" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { name: "Inventory",  href: "/inventory",  icon: Package,       permission: "inventory_view" },
      { name: "Barcode Printing", href: "/barcodes", icon: Barcode,   permission: "barcode_view" },
    ],
  },
  {
    label: "Purchase",
    items: [
      { name: "Indent Orders",      href: "/purchase-indents",   icon: ClipboardCheck, permission: "purchase_indents_view" },
      { name: "Purchase Orders",    href: "/purchase-orders",    icon: ShoppingCart,   permission: "purchase_orders_view" },
      { name: "Goods Receive Notes",href: "/grns",               icon: PackageOpen,    permission: "grn_view" },
      { name: "Quality Checks",     href: "/quality-checks",     icon: SearchCheck,    permission: "quality_checks_view" },
      { name: "Put Aways",          href: "/put-aways",          icon: PackageOpen,    permission: "put_aways_view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { name: "Sale Quotations",     href: "/sale-quotations",         icon: FileText,      permission: "sale_quotations_view" },
      { name: "Sales Orders",        href: "/sale-orders",             icon: FileText,      permission: "sale_orders_view" },
      { name: "Sales Invoices",      href: "/sale-invoices",           icon: Receipt,       permission: "sale_invoices_view" },
      { name: "Pick Lists",          href: "/pick-lists",              icon: ShoppingCart,  permission: "pick_lists_view" },
      { name: "Delivery Challans",   href: "/delivery-challans",       icon: ClipboardCheck,permission: "delivery_challans_view" },
      { name: "Return DCs",          href: "/return-delivery-challans",icon: UploadCloud,   permission: "return_delivery_challans_view" },
      { name: "Credit Notes",        href: "/credit-notes",            icon: CreditCard,    permission: "credit_notes_view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Users & Roles",   href: "/users",    icon: User,         permission: "users_view" },
      { name: "Backup & Restore",href: "/backup",   icon: UploadCloud,  permission: "backup_view" },
      { name: "Settings",        href: "/settings", icon: Settings,     permission: "settings_view" },
    ],
  },
];

/** Persist open/closed state for each group across renders */
const STORAGE_KEY = "sidebar_group_state";

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export const Sidebar = ({ onPerformanceToggle }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    const saved = loadGroupState();
    // Default: all groups open
    const defaults: Record<string, boolean> = {};
    navGroups.forEach(g => { defaults[g.label] = true; });
    return { ...defaults, ...saved };
  });

  const location = useLocation();
  const { user, signOut, hasPermission } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleGroup = (label: string) => {
    setGroupOpen(prev => {
      const next = { ...prev, [label]: !prev[label] };
      saveGroupState(next);
      return next;
    });
  };

  const handleLogout = () => signOut();

  const formattedDate = currentTime.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  const userInitials = useMemo(() => {
    try {
      if (!user) return '??';
      const name = user.user_metadata?.full_name || (user.email === 'admin@versal.com' ? 'Administrator' : user.email) || 'User';
      const parts = name.split(/[\s.@]+/).filter(Boolean);
      if (parts.length === 0) return 'U';
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    } catch {
      return '??';
    }
  }, [user]);

  // Filter groups — remove items user can't see; skip empty groups
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.permission || hasPermission(item.permission)),
    }))
    .filter(group => group.items.length > 0);

  // Is any item in a group active? (used to auto-highlight group label)
  const isGroupActive = (group: NavGroup) =>
    group.items.some(item => location.pathname === item.href);

  return (
    <div className={cn(
      "flex flex-col border-r bg-card border-border h-screen transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
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
            <Menu size={20} />
          </Button>
        </div>
      </div>

      {/* Date/time */}
      {!collapsed && (
        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {formattedDate}
        </div>
      )}

      {/* Nav */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {visibleGroups.map(group => {
            const open = groupOpen[group.label] !== false; // default open
            const active = isGroupActive(group);

            return (
              <div key={group.label}>
                {/* Group header — hidden when sidebar is icon-only */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 mt-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors select-none",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span>{group.label}</span>
                    {open
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />
                    }
                  </button>
                )}

                {/* Items — always shown in icon-only mode; toggled in expanded mode */}
                {(open || collapsed) && (
                  <div className={cn("flex flex-col gap-0.5", !collapsed && "mt-0.5 mb-1")}>
                    {group.items.map(item => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          title={collapsed ? item.name : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className={collapsed ? "h-7 w-7" : "h-4 w-4 shrink-0"} />
                          {!collapsed && <span>{item.name}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* User menu */}
      <div className="border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-start gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src="" />
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium">{user?.user_metadata?.full_name || (user?.email === 'admin@versal.com' ? 'Administrator' : user?.email) || 'User'}</span>
                </div>
              )}
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
    </div>
  );
};