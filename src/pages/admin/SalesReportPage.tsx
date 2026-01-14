import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Users,
  Package,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface RegionSales {
  name: string;
  sales: number;
}

interface TLPerformance {
  name: string;
  sold: number;
  assigned: number;
  inHand: number;
}

interface InventoryTrend {
  date: string;
  available: number;
  sold: number;
  assigned: number;
}

interface StockTypeDist {
  name: string;
  value: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(47.9, 95.8%, 53.1%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)',
];

export default function SalesReportPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  
  const [regionSales, setRegionSales] = useState<RegionSales[]>([]);
  const [tlPerformance, setTLPerformance] = useState<TLPerformance[]>([]);
  const [inventoryTrend, setInventoryTrend] = useState<InventoryTrend[]>([]);
  const [stockTypeDist, setStockTypeDist] = useState<StockTypeDist[]>([]);
  const [totals, setTotals] = useState({
    totalSales: 0,
    totalRegions: 0,
    totalTLs: 0,
    avgPerTL: 0,
  });

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString().split('T')[0];
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        return monthAgo.toISOString().split('T')[0];
      case 'quarter':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return quarterAgo.toISOString().split('T')[0];
      case 'year':
        const yearAgo = new Date(now.getFullYear(), 0, 1);
        return yearAgo.toISOString().split('T')[0];
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startDate = getDateFilter();

      // Fetch all required data in parallel
      const [
        salesRes,
        regionsRes,
        teamLeadersRes,
        inventoryRes,
      ] = await Promise.all([
        supabase
          .from('sales_records')
          .select('*, regions:region_id(name), team_leaders:team_leader_id(name)')
          .gte('sale_date', startDate),
        supabase.from('regions').select('*'),
        supabase.from('team_leaders').select('*'),
        supabase.from('inventory').select('*'),
      ]);

      const sales = salesRes.data || [];
      const regions = regionsRes.data || [];
      const teamLeaders = teamLeadersRes.data || [];
      const inventory = inventoryRes.data || [];

      // Sales by Region
      const regionMap: Record<string, number> = {};
      sales.forEach((sale: any) => {
        const regionName = sale.regions?.name || 'Unassigned';
        regionMap[regionName] = (regionMap[regionName] || 0) + 1;
      });
      const regionData = Object.entries(regionMap)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);
      setRegionSales(regionData);

      // Team Leader Performance
      const tlData = teamLeaders.map((tl) => {
        const tlSales = sales.filter((s: any) => s.team_leader_id === tl.id);
        const tlInventory = inventory.filter((i) => i.assigned_to_id === tl.id && i.assigned_to_type === 'team_leader');
        
        return {
          name: tl.name,
          sold: tlSales.length,
          assigned: tlInventory.length,
          inHand: tlInventory.filter((i) => i.status === 'available').length,
        };
      }).sort((a, b) => b.sold - a.sold);
      setTLPerformance(tlData);

      // Inventory Trend (last 7 days)
      const trendData: InventoryTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const daySales = sales.filter((s: any) => s.sale_date === dateStr).length;
        
        trendData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
          available: inventory.filter((i) => i.status === 'available').length,
          sold: daySales,
          assigned: inventory.filter((i) => i.assigned_to_id).length,
        });
      }
      setInventoryTrend(trendData);

      // Stock Type Distribution
      const stockTypeMap: Record<string, number> = {};
      sales.forEach((sale: any) => {
        const type = sale.stock_type || 'Unknown';
        stockTypeMap[type] = (stockTypeMap[type] || 0) + 1;
      });
      const stockTypeData = Object.entries(stockTypeMap).map(([name, value]) => ({ name, value }));
      setStockTypeDist(stockTypeData);

      // Totals
      setTotals({
        totalSales: sales.length,
        totalRegions: regions.length,
        totalTLs: teamLeaders.length,
        avgPerTL: teamLeaders.length > 0 ? Math.round(sales.length / teamLeaders.length) : 0,
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Reports
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Analytics and performance insights</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px] glass-input">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{totals.totalSales}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </GlassCard>
          <GlassCard className="text-center">
            <MapPin className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-3xl font-bold">{totals.totalRegions}</p>
            <p className="text-xs text-muted-foreground">Active Regions</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{totals.totalTLs}</p>
            <p className="text-xs text-muted-foreground">Team Leaders</p>
          </GlassCard>
          <GlassCard className="text-center">
            <BarChart3 className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-3xl font-bold">{totals.avgPerTL}</p>
            <p className="text-xs text-muted-foreground">Avg. per TL</p>
          </GlassCard>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Region */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Sales by Region
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionSales} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Stock Type Distribution */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Stock Type Distribution
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockTypeDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stockTypeDist.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Leader Performance */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Leader Performance
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tlPerformance.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sold" name="Sold" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="assigned" name="Assigned" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inHand" name="In Hand" fill="hsl(142.1, 76.2%, 36.3%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Inventory Status Trend */}
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              7-Day Sales Trend
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sold" name="Daily Sales" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* TL Stock Details Table */}
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Team Leader Stock Overview
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Team Leader</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Assigned</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">In Hand</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Sold</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                </tr>
              </thead>
              <tbody>
                {tlPerformance.map((tl, idx) => (
                  <tr key={idx} className="border-b border-border/30 hover:bg-primary/5">
                    <td className="py-3 px-4 font-medium">{tl.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {tl.assigned}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                        {tl.inHand}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
                        {tl.sold}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                          style={{ width: `${tl.assigned > 0 ? Math.min((tl.sold / tl.assigned) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {tl.assigned > 0 ? Math.round((tl.sold / tl.assigned) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
                {tlPerformance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No team leaders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}
