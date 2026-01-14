import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Search,
  ShoppingCart,
  Package,
  Save,
  X,
  CreditCard,
  User,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { STOCK_TYPES, validateSerialNumber, formatSerialHint } from '@/lib/validation';

interface SaleRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  amount: number | null;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  notes: string | null;
  zone_id: string | null;
  region_id: string | null;
  inventory_id: string | null;
}

interface TeamLeader {
  id: string;
  name: string;
  region_id?: string | null;
}

interface Captain {
  id: string;
  name: string;
  team_leader_id: string | null;
}

interface DSR {
  id: string;
  name: string;
  captain_id: string | null;
}

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  assigned_to_type?: string | null;
  assigned_to_id?: string | null;
}

interface Zone {
  id: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
}

const PAYMENT_STATUSES = ['Paid', 'Unpaid', 'Partial'];
const PACKAGE_STATUSES = ['Packaged', 'No Package'];

export default function RecordSalePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
  const [assignedInventory, setAssignedInventory] = useState<InventoryItem[]>([]);
  const [entryMode, setEntryMode] = useState<'auto' | 'manual'>('auto');
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    inventory_id: '',
    smartcard_number: '',
    serial_number: '',
    stock_type: '',
    customer_name: '',
    sale_date: new Date().toISOString().split('T')[0],
    payment_status: 'Unpaid',
    package_status: 'No Package',
    team_leader_id: '',
    captain_id: '',
    dsr_id: '',
    notes: '',
    zone_id: '',
    region_id: '',
  });

  // Track whether to search all inventory or only assigned
  const [searchAllInventory, setSearchAllInventory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, tlRes, captainRes, dsrRes, invRes, zoneRes, regionRes] = await Promise.all([
        supabase.from('sales_records').select('*').order('sale_date', { ascending: false }),
        supabase.from('team_leaders').select('id, name, region_id').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id').order('name'),
        supabase.from('inventory').select('id, smartcard_number, serial_number, stock_type, status, assigned_to_type, assigned_to_id').eq('status', 'available'),
        supabase.from('zones').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
      ]);

      if (salesRes.data) setSales(salesRes.data);
      if (tlRes.data) setTeamLeaders(tlRes.data);
      if (captainRes.data) setCaptains(captainRes.data);
      if (dsrRes.data) setDsrs(dsrRes.data);
      if (invRes.data) setAvailableInventory(
        invRes.data.map((it:any) => ({
          ...it,
          serial_number: it.serial_number?.toUpperCase().trim(),
          smartcard_number: it.smartcard_number?.trim(),
        }))
      );
      if (zoneRes.data) setZones(zoneRes.data);
      if (regionRes.data) setRegions(regionRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset form when dialog opens/closes or when mode changes
  useEffect(() => {
    if (dialogOpen && !editingSale) {
      resetForm();
    }
  }, [dialogOpen, editingSale]);

  // Fetch assigned inventory when assignment changes in auto mode
  useEffect(() => {
    if (!dialogOpen || editingSale || entryMode !== 'auto') return;

    const assignmentId = formData.dsr_id || formData.captain_id || formData.team_leader_id;
    const assignmentType = formData.dsr_id ? 'dsr' : formData.captain_id ? 'captain' : formData.team_leader_id ? 'team_leader' : null;

    if (assignmentId && assignmentType && formData.stock_type) {
      fetchAssignedInventory(assignmentType, assignmentId, formData.stock_type);
    } else if (formData.region_id && formData.stock_type) {
      // no direct assignment: fetch available inventory in selected region
      fetchInventoryByRegion(formData.region_id, formData.stock_type);
    } else {
      setAssignedInventory([]);
    }
  }, [formData.dsr_id, formData.captain_id, formData.team_leader_id, formData.stock_type, dialogOpen, editingSale, entryMode]);

  const fetchAssignedInventory = async (assignedType: string, assignedId: string, stockType: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type, status, assigned_to_type, assigned_to_id')
        .in('status', ['available', 'assigned'])
        .eq('assigned_to_type', assignedType)
        .eq('assigned_to_id', assignedId)
        .eq('stock_type', stockType)
        .order('smartcard_number');

      if (error) throw error;
      setAssignedInventory((data || []).map((it:any) => ({
        ...it,
        serial_number: it.serial_number?.toUpperCase().trim(),
        smartcard_number: it.smartcard_number?.trim(),
      })));
    } catch (error) {
      console.error('Error fetching assigned inventory', error);
      setAssignedInventory([]);
    }
  };

  const fetchInventoryByRegion = async (regionId: string, stockType: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type, status, assigned_to_type, assigned_to_id, region_id')
        .eq('status', 'available')
        .eq('region_id', regionId)
        .eq('stock_type', stockType)
        .order('smartcard_number');

      if (error) throw error;
      setAssignedInventory((data || []).map((it:any) => ({
        ...it,
        serial_number: it.serial_number?.toUpperCase().trim(),
        smartcard_number: it.smartcard_number?.trim(),
      })));
      setSearchAllInventory(false);
    } catch (error) {
      console.error('Error fetching inventory by region', error);
      setAssignedInventory([]);
    }
  };

  const resetForm = () => {
    setEditingSale(null);
    setFormData({
      inventory_id: '',
      smartcard_number: '',
      serial_number: '',
      stock_type: '',
      customer_name: '',
      sale_date: new Date().toISOString().split('T')[0],
      payment_status: 'Unpaid',
      package_status: 'No Package',
      team_leader_id: '',
      captain_id: '',
      dsr_id: '',
      notes: '',
      zone_id: '',
      region_id: '',
    });
    setAssignedInventory([]);
    setEntryMode('auto');
  };

  const handleEntryModeChange = (mode: 'auto' | 'manual') => {
    setEntryMode(mode);
    
    // Clear inventory-related fields when switching modes
    setFormData(prev => ({
      ...prev,
      inventory_id: '',
      smartcard_number: mode === 'manual' ? prev.smartcard_number : '',
      serial_number: mode === 'manual' ? prev.serial_number : '',
    }));
    
    setAssignedInventory([]);
  };

  const handleInventorySelect = (inventoryId: string) => {
    if (!inventoryId || inventoryId === '__none__') {
      setFormData(prev => ({
        ...prev,
        inventory_id: '',
        smartcard_number: '',
        serial_number: '',
        stock_type: '',
        team_leader_id: '',
        captain_id: '',
        dsr_id: '',
      }));
      return;
    }

    const inv = assignedInventory.find((i) => i.id === inventoryId);
    if (inv) {
      const update: any = {
        inventory_id: inventoryId,
        smartcard_number: inv.smartcard_number,
        serial_number: inv.serial_number?.toUpperCase(),
        stock_type: inv.stock_type,
      };

      // Clear assignment fields first
      update.team_leader_id = '';
      update.captain_id = '';
      update.dsr_id = '';

      // Set assignment based on inventory
      if (inv.assigned_to_type && inv.assigned_to_id) {
        if (inv.assigned_to_type === 'team_leader') {
          update.team_leader_id = inv.assigned_to_id;
        } else if (inv.assigned_to_type === 'captain') {
          update.captain_id = inv.assigned_to_id;
        } else if (inv.assigned_to_type === 'dsr') {
          update.dsr_id = inv.assigned_to_id;
        }
      }

      setFormData((prev) => ({ ...prev, ...update }));
    }
  };

  const handleTeamAssignmentChange = (type: 'team_leader' | 'captain' | 'dsr', id: string) => {
    if (entryMode === 'auto' && formData.inventory_id) {
      // If inventory is already selected, changing assignment is not allowed
      toast({
        title: 'Cannot change assignment',
        description: 'Please clear the inventory selection first to change assignment',
        variant: 'destructive',
      });
      return;
    }

    const updates: any = {};
    if (type === 'team_leader') {
      updates.team_leader_id = id || '';
      updates.captain_id = '';
      updates.dsr_id = '';
    } else if (type === 'captain') {
      updates.captain_id = id || '';
      updates.dsr_id = '';
      // also set the team_leader_id based on captain
      const cap = captains.find(c => c.id === id);
      updates.team_leader_id = cap?.team_leader_id || '';
    } else if (type === 'dsr') {
      updates.dsr_id = id || '';
      // also set captain based on dsr
      const dsr = dsrs.find(d => d.id === id);
      updates.captain_id = dsr?.captain_id || '';
      // and set team leader based on the captain
      const cap = updates.captain_id ? captains.find(c => c.id === updates.captain_id) : undefined;
      updates.team_leader_id = cap?.team_leader_id || '';
    }

    setFormData(prev => ({ ...prev, ...updates }));
    
    // Clear inventory selection when assignment changes
    if (entryMode === 'auto') {
      setFormData(prev => ({ ...prev, ...updates, inventory_id: '', smartcard_number: '', serial_number: '' }));
    }

    // Derive Team Leader id for the selected assignee so we can auto-fill region/zone
    let derivedTLId: string | null = null;
    if (type === 'team_leader') {
      derivedTLId = id || null;
    } else if (type === 'captain') {
      const cap = captains.find(c => c.id === id);
      derivedTLId = cap?.team_leader_id || null;
    } else if (type === 'dsr') {
      const dsr = dsrs.find(d => d.id === id);
      const cap = dsr ? captains.find(c => c.id === dsr.captain_id) : undefined;
      derivedTLId = cap?.team_leader_id || null;
    }

    if (derivedTLId) {
      const tl = teamLeaders.find(t => t.id === derivedTLId);
      const regionId = tl?.region_id || '';
      const region = regions.find(r => r.id === regionId);
      const zoneId = region?.zone_id || '';

      setFormData(prev => ({ ...prev, region_id: regionId, zone_id: zoneId }));
    } else {
      // clear region/zone if no derived TL
      setFormData(prev => ({ ...prev, region_id: '', zone_id: '' }));
    }
  };

  const handleStockTypeChange = (stockType: string) => {
    if (entryMode === 'auto' && formData.inventory_id) {
      // If inventory is already selected, changing stock type is not allowed
      toast({
        title: 'Cannot change stock type',
        description: 'Please clear the inventory selection first to change stock type',
        variant: 'destructive',
      });
      return;
    }

    setFormData(prev => ({ 
      ...prev, 
      stock_type: stockType,
      inventory_id: '',
      smartcard_number: '',
      serial_number: ''
    }));
  };

  const validateForm = (): boolean => {
    // Common validation for both modes
    if (!formData.stock_type) {
      toast({ title: 'Validation Error', description: 'Stock Type is required.', variant: 'destructive' });
      return false;
    }

    if (!formData.smartcard_number || !formData.serial_number) {
      toast({ title: 'Validation Error', description: 'Smartcard and Serial numbers are required.', variant: 'destructive' });
      return false;
    }

    // Validate serial number format
    const serialValidation = validateSerialNumber(formData.serial_number);
    if (!serialValidation.valid) {
      toast({ title: 'Validation Error', description: serialValidation.message, variant: 'destructive' });
      return false;
    }

    // Mode-specific validation
    if (entryMode === 'auto') {
      if (!formData.inventory_id) {
        toast({ title: 'Validation Error', description: 'Please select an inventory item.', variant: 'destructive' });
        return false;
      }

      const inv = assignedInventory.find(i => i.id === formData.inventory_id);
      if (!inv) {
        toast({ title: 'Validation Error', description: 'Selected inventory item not found.', variant: 'destructive' });
        return false;
      }

      // Verify data consistency (compare normalized values)
      const invSmart = (inv.smartcard_number || '').trim();
      const invSerial = (inv.serial_number || '').toUpperCase().trim();
      const formSmart = (formData.smartcard_number || '').trim();
      const formSerial = (formData.serial_number || '').toUpperCase().trim();
      if (invSmart !== formSmart || invSerial !== formSerial || inv.stock_type !== formData.stock_type) {
        toast({ title: 'Validation Error', description: 'Inventory data mismatch. Please reselect.', variant: 'destructive' });
        return false;
      }
    } else {
      // Manual mode: inventory_id must be null
      if (formData.inventory_id) {
        toast({ title: 'Validation Error', description: 'Manual entry cannot link to inventory.', variant: 'destructive' });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    // Normalize keys for server checks
    const formSmart = (formData.smartcard_number || '').trim();
    const formSerial = (formData.serial_number || '').toUpperCase().trim();

    try {
      // Auto-mode: ensure inventory still available and not denied/sold
      if (entryMode === 'auto' && formData.inventory_id) {
        const { data: invRec, error: invErr } = await supabase
          .from('inventory')
          .select('id, status')
          .eq('id', formData.inventory_id)
          .single();
        if (invErr) throw invErr;
        if (!invRec) {
          toast({ title: 'Validation Error', description: 'Selected inventory item not found.', variant: 'destructive' });
          return;
        }
        if (invRec.status === 'sold') {
          toast({ title: 'Validation Error', description: 'Selected inventory has already been sold.', variant: 'destructive' });
          return;
        }
        if (invRec.status === 'denied') {
          toast({ title: 'Validation Error', description: 'Selected inventory is denied and cannot be sold.', variant: 'destructive' });
          return;
        }
      }

      // Prevent duplicates in sales_records (serial or smartcard)
      const { data: salesBySerial } = await supabase
        .from('sales_records')
        .select('id')
        .eq('serial_number', formSerial);
      const { data: salesBySmart } = await supabase
        .from('sales_records')
        .select('id')
        .eq('smartcard_number', formSmart);

      const dupSales = [...(salesBySerial || []), ...(salesBySmart || [])];
      if (dupSales.length > 0) {
        // If editing, allow match only if the found record is the same one
        if (!editingSale || dupSales.some((d:any) => d.id !== editingSale.id)) {
          toast({ title: 'Duplicate Sale', description: 'A sale with this smartcard or serial already exists.', variant: 'destructive' });
          return;
        }
      }

      // Also check inventory table for sold/denied items that match this serial/smartcard (manual mode)
      if (entryMode === 'manual') {
        const { data: invBySerial } = await supabase
          .from('inventory')
          .select('id,status')
          .eq('serial_number', formSerial)
          .limit(1);
        const { data: invBySmart } = await supabase
          .from('inventory')
          .select('id,status')
          .eq('smartcard_number', formSmart)
          .limit(1);

        const invCheck = (invBySerial && invBySerial[0]) || (invBySmart && invBySmart[0]);
        if (invCheck) {
          if (invCheck.status === 'sold') {
            toast({ title: 'Validation Error', description: 'Matching inventory has already been sold.', variant: 'destructive' });
            return;
          }
          if (invCheck.status === 'denied') {
            toast({ title: 'Validation Error', description: 'Matching inventory is denied and cannot be sold.', variant: 'destructive' });
            return;
          }
        }
      }

      const saleData = {
        smartcard_number: formSmart,
        serial_number: formSerial,
        stock_type: formData.stock_type,
        customer_name: formData.customer_name || null,
        sale_date: formData.sale_date,
        payment_status: formData.payment_status,
        package_status: formData.package_status,
        team_leader_id: formData.team_leader_id || null,
        captain_id: formData.captain_id || null,
        dsr_id: formData.dsr_id || null,
        notes: formData.notes || null,
        zone_id: formData.zone_id || null,
        region_id: formData.region_id || null,
        inventory_id: entryMode === 'auto' ? formData.inventory_id || null : null,
      };

      if (editingSale) {
        const { error } = await supabase.from('sales_records').update(saleData).eq('id', editingSale.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Sale updated!' });
      } else {
        const { error } = await supabase.from('sales_records').insert([saleData]);
        if (error) throw error;

        // Mark inventory as sold if linked (auto mode only)
        if (entryMode === 'auto' && formData.inventory_id) {
          await supabase.from('inventory').update({ status: 'sold' }).eq('id', formData.inventory_id);
        }

        toast({ title: 'Success', description: 'Sale recorded!' });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || String(error), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteSale) return;
    const { error } = await supabase.from('sales_records').delete().eq('id', deleteSale.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Sale record removed.' });
      setDeleteDialogOpen(false);
      setDeleteSale(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    const { error } = await supabase.from('sales_records').delete().in('id', selectedItems);
    if (!error) {
      toast({ title: 'Deleted', description: `${selectedItems.length} sales removed.` });
      setSelectedItems([]);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditClick = (sale: SaleRecord) => {
    setEditingSale(sale);
    setFormData({
      inventory_id: sale.inventory_id || '',
      smartcard_number: sale.smartcard_number,
      serial_number: sale.serial_number,
      stock_type: sale.stock_type,
      customer_name: sale.customer_name || '',
      sale_date: sale.sale_date,
      payment_status: sale.payment_status,
      package_status: sale.package_status,
      team_leader_id: sale.team_leader_id || '',
      captain_id: sale.captain_id || '',
      dsr_id: sale.dsr_id || '',
      notes: sale.notes || '',
      zone_id: sale.zone_id || '',
      region_id: sale.region_id || '',
    });
    // Editing uses manual mode by default unless there's an inventory link
    setEntryMode(sale.inventory_id ? 'auto' : 'manual');
    setDialogOpen(true);
  };

  // Filter captains based on selected TL
  const filteredCaptains = formData.team_leader_id
    ? captains.filter((c) => c.team_leader_id === formData.team_leader_id)
    : captains;

  // Filter DSRs based on selected Captain
  const filteredDsrs = formData.captain_id
    ? dsrs.filter((d) => d.captain_id === formData.captain_id)
    : dsrs;

  // Filter regions based on selected Zone
  const filteredRegions = formData.zone_id
    ? regions.filter((r) => r.zone_id === formData.zone_id)
    : regions;

  // Get unassigned smartcards for manual mode dropdown
  const unassignedInventory = availableInventory.filter(
    inv => !inv.assigned_to_type && !inv.assigned_to_id
  );

  const filteredSales = sales.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.smartcard_number.toLowerCase().includes(query) ||
      s.serial_number.toLowerCase().includes(query) ||
      s.customer_name?.toLowerCase().includes(query)
    );
  });

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
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  const stats = {
    total: sales.length,
    paid: sales.filter((s) => s.payment_status === 'Paid').length,
    unpaid: sales.filter((s) => s.payment_status === 'Unpaid').length,
    noPackage: sales.filter((s) => s.package_status === 'No Package').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Record Sales
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Log and manage sales with team assignment</p>
          </div>
          <Button
            className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Record Sale
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center">
            <ShoppingCart className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </GlassCard>
          <GlassCard className="text-center">
            <CreditCard className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-500">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </GlassCard>
          <GlassCard className="text-center">
            <CreditCard className="h-8 w-8 mx-auto text-warning mb-2" />
            <p className="text-2xl font-bold text-warning">{stats.unpaid}</p>
            <p className="text-xs text-muted-foreground">Unpaid</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Package className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-2xl font-bold text-destructive">{stats.noPackage}</p>
            <p className="text-xs text-muted-foreground">No Package</p>
          </GlassCard>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by smartcard, serial, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            {selectedItems.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedItems.length})
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedItems.length === filteredSales.length && filteredSales.length > 0}
                    onCheckedChange={(val) =>
                      setSelectedItems(val ? filteredSales.map((s) => s.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Smartcard / Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No sales recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.slice(0, 50).map((sale) => (
                  <TableRow key={sale.id} className="border-border/30 hover:bg-primary/5">
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(sale.id)}
                        onCheckedChange={() =>
                          setSelectedItems((prev) =>
                            prev.includes(sale.id)
                              ? prev.filter((id) => id !== sale.id)
                              : [...prev, sale.id]
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.smartcard_number}</div>
                      <div className="text-xs text-muted-foreground">{sale.serial_number}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sale.stock_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{sale.customer_name || '-'}</div>
                      {sale.customer_phone && (
                        <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>
                      )}
                    </TableCell>
                    <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          sale.payment_status === 'Paid'
                            ? 'bg-green-500/20 text-green-500 border-green-500/30'
                            : sale.payment_status === 'Partial'
                            ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                            : 'bg-destructive/20 text-destructive border-destructive/30'
                        }
                      >
                        {sale.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          sale.package_status === 'Packaged'
                            ? 'bg-green-500/20 text-green-500 border-green-500/30'
                            : 'bg-destructive/20 text-destructive border-destructive/30'
                        }
                      >
                        {sale.package_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        {teamLeaders.find((t) => t.id === sale.team_leader_id)?.name && (
                          <Badge className="bg-primary/20 text-primary text-xs">
                            TL: {teamLeaders.find((t) => t.id === sale.team_leader_id)?.name}
                          </Badge>
                        )}
                        {captains.find((c) => c.id === sale.captain_id)?.name && (
                          <Badge variant="outline" className="text-xs ml-1">
                            Cpt: {captains.find((c) => c.id === sale.captain_id)?.name}
                          </Badge>
                        )}
                        {dsrs.find((d) => d.id === sale.dsr_id)?.name && (
                          <Badge variant="secondary" className="text-xs ml-1">
                            DSR: {dsrs.find((d) => d.id === sale.dsr_id)?.name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(sale)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteSale(sale);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredSales.length > 50 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Showing 50 of {filteredSales.length} sales
            </div>
          )}
        </GlassCard>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSale ? 'Edit Sale' : 'Record New Sale'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Entry Mode Selector - NEW */}
              <div className="border-b border-border/50 pb-4">
                <Label className="text-base font-semibold mb-2 block">Entry Mode</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={entryMode === 'auto' ? 'default' : 'outline'}
                    className={`flex-1 ${entryMode === 'auto' ? 'bg-primary text-primary-foreground' : ''}`}
                    onClick={() => handleEntryModeChange('auto')}
                  >
                    Auto Select
                  </Button>
                  <Button
                    type="button"
                    variant={entryMode === 'manual' ? 'default' : 'outline'}
                    className={`flex-1 ${entryMode === 'manual' ? 'bg-secondary text-secondary-foreground' : ''}`}
                    onClick={() => handleEntryModeChange('manual')}
                  >
                    Manual Entry
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {entryMode === 'auto' 
                    ? 'Inventory-driven: Select from assigned inventory. Smartcard & Serial auto-filled.'
                    : 'Free input: Enter details manually. No inventory link.'}
                </p>
              </div>

              {/* AUTO SELECT MODE */}
              {entryMode === 'auto' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Stock Type *</Label>
                      <Select
                        value={formData.stock_type}
                        onValueChange={handleStockTypeChange}
                        disabled={!!formData.inventory_id}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select stock type" />
                        </SelectTrigger>
                        <SelectContent>
                          {STOCK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.inventory_id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Stock type locked to selected inventory
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>Team Assignment</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Select
                            value={formData.team_leader_id || "__none__"}
                            onValueChange={(value) => handleTeamAssignmentChange('team_leader', value === '__none__' ? '' : value)}
                            disabled={!!formData.inventory_id}
                          >
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="TL" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {teamLeaders.map((tl) => (
                                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Select
                            value={formData.captain_id || "__none__"}
                            onValueChange={(value) => handleTeamAssignmentChange('captain', value === '__none__' ? '' : value)}
                            disabled={!formData.team_leader_id || !!formData.inventory_id}
                          >
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="Captain" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {filteredCaptains.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Select
                            value={formData.dsr_id || "__none__"}
                            onValueChange={(value) => handleTeamAssignmentChange('dsr', value === '__none__' ? '' : value)}
                            disabled={!formData.captain_id || !!formData.inventory_id}
                          >
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="DSR" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {filteredDsrs.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.inventory_id && (
                        <p className="text-xs text-muted-foreground mt-1">Assignment locked to selected inventory</p>
                      )}
                    </div>
                  </div>

                  {formData.stock_type && (formData.dsr_id || formData.captain_id || formData.team_leader_id) && (
                    <div>
                        <div className="flex items-center justify-between">
                          <Label>Select Inventory *</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const assignmentId = formData.dsr_id || formData.captain_id || formData.team_leader_id;
                                const assignmentType = formData.dsr_id ? 'dsr' : formData.captain_id ? 'captain' : formData.team_leader_id ? 'team_leader' : null;
                                if (assignmentId && assignmentType && formData.stock_type) {
                                  fetchAssignedInventory(assignmentType, assignmentId, formData.stock_type);
                                  setSearchAllInventory(false);
                                } else {
                                  setSearchAllInventory(true);
                                  setAssignedInventory(availableInventory);
                                }
                              }}
                            >
                              Refresh assigned
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSearchAllInventory(true); setAssignedInventory(availableInventory); }}>
                              Search stock
                            </Button>
                          </div>
                        </div>
                        <Select
                          value={formData.inventory_id}
                          onValueChange={handleInventorySelect}
                        >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder={
                            assignedInventory.length === 0
                              ? "No assigned inventory found"
                              : "Choose inventory item"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {assignedInventory.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              No inventory assigned for selected stock type and team
                            </SelectItem>
                          ) : (
                            assignedInventory.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.smartcard_number} - {inv.serial_number}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {assignedInventory.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Showing {assignedInventory.length} available items
                        </p>
                      )}
                    </div>
                  )}

                  {/* Read-only display of selected inventory details */}
                  {formData.inventory_id && (
                    <div className="grid grid-cols-2 gap-4 p-4 border border-border/30 rounded-lg bg-muted/20">
                      <div>
                        <Label className="text-sm font-medium">Smartcard Number</Label>
                        <Input value={formData.smartcard_number} readOnly className="glass-input" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Serial Number</Label>
                        <Input value={formData.serial_number} readOnly className="glass-input" />
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">
                          ✅ Smartcard and Serial are auto-filled from inventory and cannot be edited.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MANUAL ENTRY MODE */}
              {entryMode === 'manual' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Stock Type *</Label>
                      <Select
                        value={formData.stock_type}
                        onValueChange={(value) => setFormData({ ...formData, stock_type: value })}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select stock type" />
                        </SelectTrigger>
                        <SelectContent>
                          {STOCK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Smartcard Number *</Label>
                      <Select
                        value={formData.smartcard_number}
                        onValueChange={(value) => {
                          if (value === '__manual__') {
                            setFormData({ ...formData, smartcard_number: '' });
                          } else if (value && value !== '__none__') {
                            const inv = unassignedInventory.find(i => i.smartcard_number === value);
                            setFormData({ 
                              ...formData, 
                              smartcard_number: value,
                              serial_number: (inv?.serial_number || '').toUpperCase()
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder={
                            formData.smartcard_number 
                              ? formData.smartcard_number 
                              : "Select or enter manually"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__manual__">Enter manually...</SelectItem>
                          {unassignedInventory
                            .filter(inv => !formData.stock_type || inv.stock_type === formData.stock_type)
                            .slice(0, 50)
                            .map((inv) => (
                              <SelectItem key={inv.id} value={inv.smartcard_number}>
                                {inv.smartcard_number} ({inv.stock_type})
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Serial Number *</Label>
                      <Input
                        value={formData.serial_number}
                        onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.toUpperCase() })}
                        className="glass-input"
                        placeholder="S07512345678"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{formatSerialHint()}</p>
                    </div>
                    
                    <div>
                      <Label>Team Leader</Label>
                      <Select
                        value={formData.team_leader_id || "__none__"}
                        onValueChange={(value) => {
                          const updates: any = { team_leader_id: value === "__none__" ? "" : value };
                          if (value !== formData.team_leader_id) {
                            updates.captain_id = '';
                            updates.dsr_id = '';
                          }
                          setFormData(prev => ({ ...prev, ...updates }));
                        }}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select TL" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {teamLeaders.map((tl) => (
                            <SelectItem key={tl.id} value={tl.id}>
                              {tl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Captain</Label>
                      <Select
                        value={formData.captain_id || "__none__"}
                        onValueChange={(value) => {
                          const updates: any = { captain_id: value === "__none__" ? "" : value };
                          if (value !== formData.captain_id) {
                            updates.dsr_id = '';
                          }
                          setFormData(prev => ({ ...prev, ...updates }));
                        }}
                        disabled={!formData.team_leader_id}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select Captain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {filteredCaptains.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>DSR</Label>
                      <Select
                        value={formData.dsr_id || "__none__"}
                        onValueChange={(value) => setFormData({ ...formData, dsr_id: value === "__none__" ? "" : value })}
                        disabled={!formData.captain_id}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select DSR" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {filteredDsrs.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* COMMON FIELDS (Both Modes) */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="glass-input"
                    placeholder="Customer name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sale Date</Label>
                  <Input
                    type="date"
                    value={formData.sale_date}
                    onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                    className="glass-input"
                  />
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(v) => setFormData({ ...formData, payment_status: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Package Status</Label>
                  <Select
                    value={formData.package_status}
                    onValueChange={(v) => setFormData({ ...formData, package_status: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={formData.zone_id || "__none__"}
                    onValueChange={(v) => setFormData({ 
                      ...formData, 
                      zone_id: v === "__none__" ? "" : v,
                      region_id: '' 
                    })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Region</Label>
                  <Select
                    value={formData.region_id || "__none__"}
                    onValueChange={(v) => setFormData({ ...formData, region_id: v === "__none__" ? "" : v })}
                    disabled={!formData.zone_id}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {filteredRegions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="glass-input"
                  rows={2}
                />
              </div>

              {/* Mode Summary */}
              <div className={`p-3 rounded-lg border ${
                entryMode === 'auto' 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'bg-secondary/10 border-secondary/30'
              }`}>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  {entryMode === 'auto' ? '🔁 Auto Select Mode' : '✍️ Manual Entry Mode'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {entryMode === 'auto' 
                    ? 'Inventory-driven: Data is validated against inventory records. Inventory will be marked as sold upon save.'
                    : 'Manual entry: Free-form input. No inventory validation or status changes.'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-primary to-secondary">
                <Save className="w-4 h-4 mr-2" />
                {editingSale ? 'Update Sale' : 'Record Sale'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Sale</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete sale record <strong>{deleteSale?.smartcard_number}</strong>?
              This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}