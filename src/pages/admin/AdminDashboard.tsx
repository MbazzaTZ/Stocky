import { useEffect, useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  CreditCard, 
  PackageX, 
  Users,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/layout/AdminLayout';
import StatsCard from '@/components/ui/StatsCard';
import GlassCard from '@/components/ui/GlassCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  totalStock: number;
  availableStock: number;
  soldToday: number;
  soldThisMonth: number;
  unpaidCount: number;
  noPackageCount: number;
  unassignedSold: number;
  teamLeaders: number;
  captains: number;
  dsrs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStock: 0,
    availableStock: 0,
    soldToday: 0,
    soldThisMonth: 0,
    unpaidCount: 0,
    noPackageCount: 0,
    unassignedSold: 0,
    teamLeaders: 0,
    captains: 0,
    dsrs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];

      const [
        inventoryRes,
        availableRes,
        salesTodayRes,
        salesMonthRes,
        unpaidRes,
        noPackageRes,
        unassignedRes,
        tlRes,
        captainRes,
        dsrRes,
      ] = await Promise.all([
        supabase.from('inventory').select('id', { count: 'exact', head: true }),
        supabase.from('inventory').select('id', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('sales_records').select('id', { count: 'exact', head: true }).eq('sale_date', today),
        supabase.from('sales_records').select('id', { count: 'exact', head: true }).gte('sale_date', startOfMonth),
        supabase.from('sales_records').select('id', { count: 'exact', head: true }).eq('payment_status', 'Unpaid'),
        supabase.from('sales_records').select('id', { count: 'exact', head: true }).eq('package_status', 'No Package'),
        supabase.from('sales_records').select('id', { count: 'exact', head: true })
          .is('team_leader_id', null)
          .is('captain_id', null)
          .is('dsr_id', null),
        supabase.from('team_leaders').select('id', { count: 'exact', head: true }),
        supabase.from('captains').select('id', { count: 'exact', head: true }),
        supabase.from('dsrs').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalStock: inventoryRes.count || 0,
        availableStock: availableRes.count || 0,
        soldToday: salesTodayRes.count || 0,
        soldThisMonth: salesMonthRes.count || 0,
        unpaidCount: unpaidRes.count || 0,
        noPackageCount: noPackageRes.count || 0,
        unassignedSold: unassignedRes.count || 0,
        teamLeaders: tlRes.count || 0,
        captains: captainRes.count || 0,
        dsrs: dsrRes.count || 0,
      });

      // Weekly data
      const weekly: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const { count } = await supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('sale_date', dateStr);
        
        weekly.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: count || 0,
        });
      }
      setWeeklyData(weekly);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Admin Dashboard
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your inventory and sales team
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Inventory"
            value={stats.totalStock.toLocaleString()}
            subtitle={`${stats.availableStock} available`}
            icon={Package}
            variant="blue"
          />
          <StatsCard
            title="Sales Today"
            value={stats.soldToday}
            icon={TrendingUp}
            variant="gold"
          />
          <StatsCard
            title="This Month"
            value={stats.soldThisMonth}
            icon={BarChart3}
            variant="blue"
          />
          <StatsCard
            title="Unpaid"
            value={stats.unpaidCount}
            icon={CreditCard}
            variant="warning"
          />
          <StatsCard
            title="No Package"
            value={stats.noPackageCount}
            icon={PackageX}
            variant="destructive"
          />
          <StatsCard
            title="Unassigned"
            value={stats.unassignedSold}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatsCard
            title="Team Leaders"
            value={stats.teamLeaders}
            subtitle={`${stats.captains} captains`}
            icon={Users}
            variant="blue"
          />
          <StatsCard
            title="DSRs"
            value={stats.dsrs}
            icon={Users}
            variant="gold"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly Sales
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <a href="/admin/inventory" className="glass-button text-center py-6 hover:shadow-blue">
                <Package className="h-8 w-8 mx-auto text-primary mb-2" />
                <span className="font-medium">Add Stock</span>
              </a>
              <a href="/admin/sales-team" className="glass-button text-center py-6 hover:shadow-gold">
                <Users className="h-8 w-8 mx-auto text-secondary mb-2" />
                <span className="font-medium">Manage Team</span>
              </a>
              <a href="/admin/import" className="glass-button text-center py-6 hover:shadow-blue">
                <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
                <span className="font-medium">Import Data</span>
              </a>
              <a href="/admin/settings" className="glass-button text-center py-6 hover:shadow-gold">
                <BarChart3 className="h-8 w-8 mx-auto text-secondary mb-2" />
                <span className="font-medium">Settings</span>
              </a>
            </div>
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  );
}
