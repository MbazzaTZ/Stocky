import { useEffect, useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  CreditCard, 
  PackageX, 
  Users, 
  BarChart3,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import StatsCard from '@/components/ui/StatsCard';
import GlassCard from '@/components/ui/GlassCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import TLStockTable from '@/components/TLStockTable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
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

interface DailyTrend {
  date: string;
  sales: number;
}

export default function PublicDashboard() {
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
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];

      // Fetch counts in parallel
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

      // Fetch daily trends (last 7 days)
      const trends: DailyTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const { count } = await supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('sale_date', dateStr);
        
        trends.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
          sales: count || 0,
        });
      }
      setDailyTrends(trends);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  const stockUtilization = stats.totalStock > 0 
    ? Math.round(((stats.totalStock - stats.availableStock) / stats.totalStock) * 100) 
    : 0;

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Stock Dashboard
            </span>
          </h1>
          <p className="text-muted-foreground">
            Real-time inventory and sales overview
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
            subtitle="Units sold"
            icon={TrendingUp}
            variant="gold"
          />
          <StatsCard
            title="This Month"
            value={stats.soldThisMonth}
            subtitle="Total sales"
            icon={BarChart3}
            variant="blue"
          />
          <StatsCard
            title="Unpaid Orders"
            value={stats.unpaidCount}
            subtitle="Pending payment"
            icon={CreditCard}
            variant="warning"
          />
          <StatsCard
            title="No Package"
            value={stats.noPackageCount}
            subtitle="Awaiting package"
            icon={PackageX}
            variant="destructive"
          />
          <StatsCard
            title="Unassigned Sales"
            value={stats.unassignedSold}
            subtitle="Need assignment"
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
            subtitle="Active reps"
            icon={Activity}
            variant="gold"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Chart */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              7-Day Sales Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-glass)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--secondary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Stock Utilization */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Stock Utilization
            </h3>
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="text-6xl font-bold font-display bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {stockUtilization}%
                </div>
                <p className="text-muted-foreground mt-2">of inventory utilized</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available Stock</span>
                  <span className="font-medium">{stats.availableStock}</span>
                </div>
                <Progress value={100 - stockUtilization} className="h-3" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sold/Assigned</span>
                  <span className="font-medium">{stats.totalStock - stats.availableStock}</span>
                </div>
                <Progress value={stockUtilization} className="h-3 progress-gold" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* TL Stock Table */}
        <TLStockTable />

        {/* Quick Stats Bar */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Paid: {stats.soldThisMonth - stats.unpaidCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning" />
              <span className="text-sm text-muted-foreground">Unpaid: {stats.unpaidCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">No Package: {stats.noPackageCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Unassigned: {stats.unassignedSold}</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
