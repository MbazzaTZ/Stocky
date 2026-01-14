import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AdminSidebar from './AdminSidebar';
import { Loader2, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/admin/login');
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar (hidden on small screens) */}
      <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Mobile sidebar overlay */}
      <AdminSidebar mobile open={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className={cn("flex-1 p-6 overflow-auto", collapsed ? "sm:ml-20" : "sm:ml-64")}>
        <div className="max-w-7xl mx-auto animate-fade-in">
          {/* Top bar for small screens */}
          <div className="mb-4 sm:hidden flex items-center justify-between">
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-md hover:bg-muted"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {children}
        </div>
      </main>
      {/* Backdrop when mobile sidebar is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
