import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Package,
  Search,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
import {
  STOCK_TYPES,
  validateSmartcard,
  validateSerialNumber,
  formatSmartcardHint,
  formatSerialHint,
} from '@/lib/validation';

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  notes: string | null;
  created_at: string;
  zone_id: string | null;
  region_id: string | null;
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

export default function InventoryPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    smartcard_number: '',
    serial_number: '',
    stock_type: 'Full Set',
    notes: '',
    zone_id: '',
    region_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, zoneRes, regionRes] = await Promise.all([
        supabase.from('inventory').select('*').order('created_at', { ascending: false }),
        supabase.from('zones').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
      ]);

      if (invRes.data) setInventory(invRes.data);
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

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      smartcard_number: '',
      serial_number: '',
      stock_type: 'Full Set',
      notes: '',
      zone_id: '',
      region_id: '',
    });
  };

  const handleSubmit = async () => {
    // Validate smartcard
    const scValidation = validateSmartcard(formData.smartcard_number);
    if (!scValidation.valid) {
      toast({
        title: 'Validation Error',
        description: scValidation.message,
        variant: 'destructive',
      });
      return;
    }

    // Validate serial number
    const snValidation = validateSerialNumber(formData.serial_number);
    if (!snValidation.valid) {
      toast({
        title: 'Validation Error',
        description: snValidation.message,
        variant: 'destructive',
      });
      return;
    }

    const itemData = {
      smartcard_number: formData.smartcard_number,
      serial_number: formData.serial_number.toUpperCase(),
      stock_type: formData.stock_type,
      notes: formData.notes || null,
      zone_id: formData.zone_id || null,
      region_id: formData.region_id || null,
    };

    const { error } = editingItem
      ? await supabase.from('inventory').update(itemData).eq('id', editingItem.id)
      : await supabase.from('inventory').insert([itemData]);

    if (!error) {
      toast({ title: 'Success', description: editingItem ? 'Stock updated!' : 'Stock added!' });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkUpload = async () => {
    const items = bulkInput
      .trim()
      .split('\n')
      .map((line) => {
        const [sc, sn, type] = line.split(',').map((s) => s.trim());
        return {
          smartcard_number: sc,
          serial_number: sn,
          stock_type: type || 'Full Set',
          zone_id: formData.zone_id || null,
          region_id: formData.region_id || null,
        };
      })
      .filter((item) => item.smartcard_number && item.serial_number);

    if (items.length === 0) {
      toast({ title: 'No valid items', description: 'Please enter valid data.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('inventory').insert(items);
    if (!error) {
      toast({ title: 'Success', description: `${items.length} items added.` });
      setBulkDialogOpen(false);
      setBulkInput('');
      resetForm();
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const items = rows
        .slice(1)
        .map((row) => ({
          smartcard_number: String(row[0] || ''),
          serial_number: String(row[1] || ''),
          stock_type: row[2] || 'Full Set',
          zone_id: formData.zone_id || null,
          region_id: formData.region_id || null,
        }))
        .filter((i) => i.smartcard_number && i.serial_number && i.smartcard_number !== 'undefined');

      if (items.length === 0) {
        toast({ title: 'No valid items found', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('inventory').insert(items);
      if (!error) {
        toast({ title: 'Excel Import Success', description: `${items.length} items added.` });
        fetchData();
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from('inventory').delete().eq('id', deleteItem.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Stock item removed.' });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    const { error } = await supabase.from('inventory').delete().in('id', selectedItems);
    if (!error) {
      toast({ title: 'Deleted', description: `${selectedItems.length} items removed.` });
      setSelectedItems([]);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      smartcard_number: item.smartcard_number,
      serial_number: item.serial_number,
      stock_type: item.stock_type,
      notes: item.notes || '',
      zone_id: item.zone_id || '',
      region_id: item.region_id || '',
    });
    setDialogOpen(true);
  };

  const exportToExcel = () => {
    const exportData = filteredInventory.map((item) => ({
      'Smartcard Number': item.smartcard_number,
      'Serial Number': item.serial_number,
      'Stock Type': item.stock_type,
      Status: item.status,
      'Payment Status': item.payment_status,
      'Package Status': item.package_status,
      Zone: zones.find((z) => z.id === item.zone_id)?.name || '',
      Region: regions.find((r) => r.id === item.region_id)?.name || '',
      Notes: item.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredInventory = inventory.filter((i) => {
    const matchesSearch =
      i.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.serial_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesZone = zoneFilter === 'all' || i.zone_id === zoneFilter;
    return matchesSearch && matchesStatus && matchesZone;
  });

  const filteredRegions = formData.zone_id
    ? regions.filter((r) => r.zone_id === formData.zone_id)
    : regions;

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
    total: inventory.length,
    available: inventory.filter((i) => i.status === 'available').length,
    sold: inventory.filter((i) => i.status === 'sold').length,
    assigned: inventory.filter((i) => i.assigned_to_id).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Inventory Management
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Add, edit, and manage stock</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="glass-button" onClick={() => setBulkDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Bulk Upload
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel Import
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleExcelUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <Button variant="outline" className="glass-button" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Stock
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center">
            <Package className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Stock</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-500">{stats.available}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </GlassCard>
          <GlassCard className="text-center">
            <X className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-2xl font-bold text-secondary">{stats.sold}</p>
            <p className="text-xs text-muted-foreground">Sold</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Package className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </GlassCard>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search serial or smartcard..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[150px] glass-input">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] glass-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
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
                    checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                    onCheckedChange={(val) =>
                      setSelectedItems(val ? filteredInventory.map((i) => i.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Smartcard / Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Zone / Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No inventory items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.slice(0, 50).map((item) => (
                  <TableRow key={item.id} className="border-border/30 hover:bg-primary/5">
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() =>
                          setSelectedItems((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.smartcard_number}</div>
                      <div className="text-xs text-muted-foreground">{item.serial_number}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.stock_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{zones.find((z) => z.id === item.zone_id)?.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">
                        {regions.find((r) => r.id === item.region_id)?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.status === 'available'
                            ? 'bg-green-500/20 text-green-500 border-green-500/30'
                            : 'bg-secondary/20 text-secondary border-secondary/30'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteItem(item);
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
          {filteredInventory.length > 50 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Showing 50 of {filteredInventory.length} items
            </div>
          )}
        </GlassCard>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Stock' : 'Add Stock'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Smartcard Number *</Label>
                  <Input
                    value={formData.smartcard_number}
                    onChange={(e) => setFormData({ ...formData, smartcard_number: e.target.value })}
                    className="glass-input"
                    placeholder="8212345678"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formatSmartcardHint()}
                  </p>
                </div>
                <div>
                  <Label>Serial Number *</Label>
                  <Input
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.toUpperCase() })}
                    className="glass-input"
                    placeholder="S07512345678"
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formatSerialHint()}
                  </p>
                </div>
              </div>
              <div>
                <Label>Stock Type</Label>
                <Select
                  value={formData.stock_type}
                  onValueChange={(v) => setFormData({ ...formData, stock_type: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={formData.zone_id}
                    onValueChange={(v) => setFormData({ ...formData, zone_id: v, region_id: '' })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
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
                    value={formData.region_id}
                    onValueChange={(v) => setFormData({ ...formData, region_id: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
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
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingItem ? 'Update' : 'Add Stock'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Bulk Upload Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter one item per line: smartcard, serial, type (optional)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={formData.zone_id}
                    onValueChange={(v) => setFormData({ ...formData, zone_id: v, region_id: '' })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
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
                    value={formData.region_id}
                    onValueChange={(v) => setFormData({ ...formData, region_id: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="123456789, SN001, Full Set&#10;987654321, SN002, Decoder Only"
                className="glass-input"
                rows={8}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkUpload} className="bg-gradient-to-r from-primary to-secondary">
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Stock</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete stock <strong>{deleteItem?.smartcard_number}</strong>?
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
