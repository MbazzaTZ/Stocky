import { useState } from 'react';
import { Search, Package, User, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SearchResult {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  sale_date?: string;
  customer_name?: string;
  team_leader?: { name: string } | null;
  captain?: { name: string } | null;
  dsr?: { name: string } | null;
  zone?: { name: string } | null;
  region?: { name: string } | null;
}

export default function SearchStock() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'smartcard' | 'serial' | 'person'>('smartcard');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      let data: any[] = [];

      if (searchType === 'smartcard' || searchType === 'serial') {
        // Search in inventory
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select(`
            id, smartcard_number, serial_number, stock_type, status, payment_status, package_status,
            zones:zone_id(name),
            regions:region_id(name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(50);

        // Search in sales
        const { data: salesData } = await supabase
          .from('sales_records')
          .select(`
            id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name,
            team_leaders:team_leader_id(name),
            captains:captain_id(name),
            dsrs:dsr_id(name),
            zones:zone_id(name),
            regions:region_id(name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(50);

        data = [
          ...(inventoryData || []).map((item: any) => ({
            ...item,
            zone: item.zones,
            region: item.regions,
          })),
          ...(salesData || []).map((item: any) => ({
            ...item,
            status: 'sold',
            team_leader: item.team_leaders,
            captain: item.captains,
            dsr: item.dsrs,
            zone: item.zones,
            region: item.regions,
          })),
        ];
      } else {
        // Search by person name
        const { data: tlData } = await supabase
          .from('team_leaders')
          .select('id')
          .ilike('name', `%${searchQuery}%`);

        const { data: captainData } = await supabase
          .from('captains')
          .select('id')
          .ilike('name', `%${searchQuery}%`);

        const { data: dsrData } = await supabase
          .from('dsrs')
          .select('id')
          .ilike('name', `%${searchQuery}%`);

        const tlIds = tlData?.map(t => t.id) || [];
        const captainIds = captainData?.map(c => c.id) || [];
        const dsrIds = dsrData?.map(d => d.id) || [];

        if (tlIds.length || captainIds.length || dsrIds.length) {
          let query = supabase
            .from('sales_records')
            .select(`
              id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name,
              team_leaders:team_leader_id(name),
              captains:captain_id(name),
              dsrs:dsr_id(name),
              zones:zone_id(name),
              regions:region_id(name)
            `)
            .limit(50);

          if (tlIds.length) query = query.in('team_leader_id', tlIds);
          else if (captainIds.length) query = query.in('captain_id', captainIds);
          else if (dsrIds.length) query = query.in('dsr_id', dsrIds);

          const { data: salesData } = await query;

          data = (salesData || []).map((item: any) => ({
            ...item,
            status: 'sold',
            team_leader: item.team_leaders,
            captain: item.captains,
            dsr: item.dsrs,
            zone: item.zones,
            region: item.regions,
          }));
        }
      }

      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="badge-success">Available</Badge>;
      case 'assigned':
        return <Badge className="badge-blue">Assigned</Badge>;
      case 'sold':
        return <Badge className="badge-gold">Sold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    return status === 'Paid' 
      ? <Badge className="badge-success"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>
      : <Badge className="badge-warning"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>;
  };

  const getPackageBadge = (status: string) => {
    return status === 'Packaged'
      ? <Badge className="badge-success"><Package className="h-3 w-3 mr-1" />Packaged</Badge>
      : <Badge className="badge-destructive"><XCircle className="h-3 w-3 mr-1" />No Package</Badge>;
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Search Stock
            </span>
          </h1>
          <p className="text-muted-foreground">
            Find inventory and sales records by smartcard, serial number, or person
          </p>
        </div>

        {/* Search Form */}
        <GlassCard>
          <form onSubmit={handleSearch} className="space-y-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)}>
              <TabsList className="grid w-full grid-cols-3 glass-card">
                <TabsTrigger value="smartcard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Smartcard
                </TabsTrigger>
                <TabsTrigger value="serial" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Serial Number
                </TabsTrigger>
                <TabsTrigger value="person" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Person
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'smartcard' 
                      ? 'Enter smartcard number...'
                      : searchType === 'serial'
                      ? 'Enter serial number...'
                      : 'Enter team leader, captain, or DSR name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 input-glass h-12"
                />
              </div>
              <Button type="submit" className="btn-primary-gradient h-12 px-8" disabled={isLoading}>
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {results.length} Result{results.length !== 1 ? 's' : ''} Found
              </h2>
            </div>

            {results.length === 0 ? (
              <GlassCard className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">No records found matching your search</p>
              </GlassCard>
            ) : (
              <div className="grid gap-4">
                {results.map((item) => (
                  <GlassCard key={item.id}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-bold text-primary">
                            {item.smartcard_number}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Serial: <span className="font-mono">{item.serial_number}</span>
                          </p>
                          <p>Type: {item.stock_type}</p>
                          {item.zone && <p>Zone: {item.zone.name}</p>}
                          {item.region && <p>Region: {item.region.name}</p>}
                          {item.customer_name && (
                            <p className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Customer: {item.customer_name}
                            </p>
                          )}
                          {item.sale_date && (
                            <p className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Sale Date: {new Date(item.sale_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.payment_status && getPaymentBadge(item.payment_status)}
                        {item.package_status && getPackageBadge(item.package_status)}
                      </div>
                    </div>
                    {(item.team_leader || item.captain || item.dsr) && (
                      <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4 text-sm">
                        {item.team_leader && (
                          <span className="badge-blue">TL: {item.team_leader.name}</span>
                        )}
                        {item.captain && (
                          <span className="badge-gold">Captain: {item.captain.name}</span>
                        )}
                        {item.dsr && (
                          <span className="bg-muted px-3 py-1 rounded-full">DSR: {item.dsr.name}</span>
                        )}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
