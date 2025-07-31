
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layouts/MainLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ProductsPage from "@/pages/ProductsPage";
import InventoryPage from "@/pages/InventoryPage";
import NotFound from "./pages/NotFound";
import CategoriesPage from "@/pages/CategoriesPage";
import UnitsPage from "@/pages/UnitsPage";
import SuppliersPage from "@/pages/SuppliersPage";
import CustomersPage from "@/pages/CustomersPage";
import TaxesPage from "@/pages/TaxesPage";
import ReportsPage from "@/pages/ReportsPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import GRNsPage from "@/pages/GRNsPage";
import WholesaleOrdersPage from "@/pages/WholesaleOrdersPage";
import WholesaleBillingPage from "@/pages/WholesaleBillingPage";
import CreditNotesPage from "@/pages/CreditNotesPage";
import BackupPage from "@/pages/BackupPage";
import BarcodePage from "@/pages/BarcodePage";
import UsersPage from "@/pages/UsersPage";
import SettingsPage from "@/pages/SettingsPage";
import UserSettingsPage from "@/pages/UserSettingsPage";

const App = () => {
  // Create a client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="taxes" element={<TaxesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="grns" element={<GRNsPage />} />
              <Route path="sale-orders" element={<WholesaleOrdersPage />} />
              <Route path="sale-invoices" element={<WholesaleBillingPage />} />
              <Route path="credit-notes" element={<CreditNotesPage />} />
              <Route path="backup" element={<BackupPage />} />
              <Route path="barcodes" element={<BarcodePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="user-settings" element={<UserSettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
