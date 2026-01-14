import { useEffect, useState } from 'react';
import { CreditCard, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface UnpaidSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  amount: number;
  team_leader: { name: string } | null;
  captain: { name: string } | null;
  dsr: { name: string } | null;
}

export default function UnpaidPage() {
  const [sales, setSales] = useState<UnpaidSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<UnpaidSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnpaidSales();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredSales(
        sales.filter(
          (s) =>
            s.smartcard_number.toLowerCase().includes(query) ||
            s.serial_number.toLowerCase().includes(query) ||
            s.customer_name?.toLowerCase().includes(query) ||
            s.team_leader?.name.toLowerCase().includes(query) ||
            s.captain?.name.toLowerCase().includes(query) ||
            s.dsr?.name.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredSales(sales);
    }
  }, [searchQuery, sales]);

  const fetchUnpaidSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_records')
        .select(`
          id, smartcard_number, serial_number, stock_type, customer_name, customer_phone, sale_date, amount,
          team_leaders:team_leader_id(name),
          captains:captain_id(name),
          dsrs:dsr_id(name)
        `)
        .eq('payment_status', 'Unpaid')
        .order('sale_date', { ascending: false });

      if (!error && data) {
        setSales(
          data.map((item: any) => ({
            ...item,
            team_leader: item.team_leaders,
            captain: item.captains,
            dsr: item.dsrs,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching unpaid sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithStripe = (saleId: string) => {
    // TODO: Implement Stripe payment
    console.log('Pay with Stripe:', saleId);
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              <span className="bg-gradient-to-r from-warning to-secondary bg-clip-text text-transparent">
                Unpaid Stock
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredSales.length} stock item{filteredSales.length !== 1 ? 's' : ''} pending payment
            </p>
          </div>
          <Badge className="badge-warning text-lg py-2 px-4 self-start">
            <CreditCard className="h-5 w-5 mr-2" />
            {filteredSales.length} Unpaid
          </Badge>
        </div>

        {/* Search */}
        <GlassCard className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, customer, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-glass"
            />
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No unpaid stock found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-medium">
                        {sale.smartcard_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {sale.serial_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.stock_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {sale.customer_name || '-'}
                        {sale.customer_phone && (
                          <span className="block text-xs text-muted-foreground">
                            {sale.customer_phone}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${sale.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {sale.team_leader && (
                            <span className="badge-blue block w-fit">TL: {sale.team_leader.name}</span>
                          )}
                          {sale.dsr && (
                            <span className="bg-muted px-2 py-0.5 rounded-full block w-fit">
                              DSR: {sale.dsr.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="btn-gold-gradient"
                          onClick={() => handlePayWithStripe(sale.id)}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Pay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
