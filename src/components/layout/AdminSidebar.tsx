import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Upload, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Home,
  BarChart3,
  MapPin,
} from 'lucide-react';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/inventory', label: 'Inventory', icon: Package },
  { href: '/admin/assign-stock', label: 'Assign Stock', icon: Upload },
  { href: '/admin/record-sales', label: 'Record Sales', icon: BarChart3 },
  { href: '/admin/sales-team', label: 'Sales Team', icon: Users },
  { href: '/admin/zones-regions', label: 'Zones & Regions', icon: MapPin },
  { href: '/admin/reports', label: 'Sales Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminSidebarProps {
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  setCollapsed?: (v: boolean) => void;
}

export default function AdminSidebar({ mobile = false, open = false, onClose, collapsed = false, setCollapsed }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, adminUser } = useAuth();
  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const baseDesktop = cn(
    "hidden sm:fixed sm:left-0 sm:top-0 sm:h-full sm:z-40 sm:sidebar-glass sm:transition-all sm:duration-300",
    collapsed ? "sm:w-20" : "sm:w-64"
  );

  const mobileClasses = cn(
    "fixed inset-y-0 left-0 z-50 w-64 sidebar-glass transition-transform duration-200",
    open ? "translate-x-0" : "-translate-x-full"
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={baseDesktop}>
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="icon-container-gold">
                <Package className="h-5 w-5 text-foreground" />
              </div>
              <span className="font-display text-lg font-bold">StockFlow</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed?.(!collapsed)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Back to Public */}
        <Link
          to="/"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl mb-4 text-sm font-medium transition-all duration-200 glass-button",
            collapsed && "justify-center"
          )}
        >
          <Home className="h-5 w-5 text-primary" />
          {!collapsed && <span>Public Site</span>}
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-blue"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="mt-auto pt-4 border-t border-border/50">
          {!collapsed && adminUser && (
            <div className="mb-3 px-3">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{adminUser.email}</p>
              <span className="badge-gold text-xs mt-1 inline-block">
                {adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          )}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              "w-full flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
      </aside>

      {/* Mobile overlay sidebar */}
      {mobile && (
        <aside className={mobileClasses}>
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="icon-container-gold">
                  <Package className="h-5 w-5 text-foreground" />
                </div>
                <span className="font-display text-lg font-bold">StockFlow</span>
              </div>
              <button
                onClick={() => onClose?.()}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            <Link
              to="/"
              onClick={() => onClose?.()}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl mb-4 text-sm font-medium transition-all duration-200 glass-button"
              )}
            >
              <Home className="h-5 w-5 text-primary" />
              <span>Public Site</span>
            </Link>

            <nav className="flex-1 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => onClose?.()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-blue"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-border/50">
              {adminUser && (
                <div className="mb-3 px-3">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium truncate">{adminUser.email}</p>
                  <span className="badge-gold text-xs mt-1 inline-block">
                    {adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
              )}
              <Button
                onClick={() => {
                  handleSignOut();
                  onClose?.();
                }}
                variant="ghost"
                className="w-full flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
