import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Public Pages
import PublicDashboard from "./pages/PublicDashboard";
import SearchStock from "./pages/SearchStock";
import UnpaidPage from "./pages/UnpaidPage";
import NoPackagePage from "./pages/NoPackagePage";
import UnassignedPage from "./pages/UnassignedPage";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminRegister from "./pages/admin/AdminRegister";
import AdminDashboard from "./pages/admin/AdminDashboard";
import InventoryPage from "./pages/admin/InventoryPage";
import SalesTeamPage from "./pages/admin/SalesTeamPage";
import SalesReportPage from "./pages/admin/SalesReportPage";
import RecordSalePage from "./pages/admin/RecordSalePage";
import AssignStockPage from "./pages/admin/AssignStockPage";
import ZonesRegionsPage from "./pages/admin/ZonesRegionsPage";
import SettingsPage from "./pages/admin/SettingsPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicDashboard />} />
            <Route path="/search" element={<SearchStock />} />
            <Route path="/unpaid" element={<UnpaidPage />} />
            <Route path="/no-package" element={<NoPackagePage />} />
            <Route path="/unassigned" element={<UnassignedPage />} />
            
            {/* Admin Auth */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            
            {/* Admin Protected Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/inventory" element={<InventoryPage />} />
            <Route path="/admin/assign-stock" element={<AssignStockPage />} />
            <Route path="/admin/record-sales" element={<RecordSalePage />} />
            <Route path="/admin/sales-team" element={<SalesTeamPage />} />
            <Route path="/admin/zones-regions" element={<ZonesRegionsPage />} />
            <Route path="/admin/reports" element={<SalesReportPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
