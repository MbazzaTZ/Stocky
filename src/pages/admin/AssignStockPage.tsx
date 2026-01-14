import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Package,
  Search,
  Users,
  UserPlus,
  User,
  Send,
  History,
  Edit,
  Trash2,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  zone_id: string | null;
  region_id: string | null;
}

interface TeamLeader {
  id: string;
  name: string;
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

interface AssignmentStats {
  total: number;
  available: number;
  assignedTL: number;
  assignedCaptain: number;
  assignedDSR: number;
  sold: number;
}

export default function AssignStockPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);

  const [assignmentData, setAssignmentData] = useState({
    assign_type: 'team_leader',
    assign_to_id: '',
  });

  const [bulkEditData, setBulkEditData] = useState({
    status: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, tlRes, captainRes, dsrRes] = await Promise.all([
        supabase.from('inventory').select('*').order('created_at', { ascending: false }),
        supabase.from('team_leaders').select('id, name').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id').order('name'),
      ]);

      if (invRes.data) setInventory(invRes.data);
      if (tlRes.data) setTeamLeaders(tlRes.data);
      if (captainRes.data) setCaptains(captainRes.data);
      if (dsrRes.data) setDsrs(dsrRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getAssigneeName = (item: InventoryItem) => {
    if (!item.assigned_to_type || !item.assigned_to_id) return null;
    switch (item.assigned_to_type) {
      case 'team_leader':
        return teamLeaders.find((t) => t.id === item.assigned_to_id)?.name;
      case 'captain':
        return captains.find((c) => c.id === item.assigned_to_id)?.name;
      case 'dsr':
        return dsrs.find((d) => d.id === item.assigned_to_id)?.name;
      default:
        return null;
    }
  };

  const getAssigneeOptions = () => {
    switch (assignmentData.assign_type) {
      case 'team_leader':
        return teamLeaders;
      case 'captain':
        return captains;
      case 'dsr':
        return dsrs;
      default:
        return [];
    }
  };

  const handleAssign = async () => {
    if (selectedItems.length === 0) {
      toast({ title: 'No items selected', variant: 'destructive' });
      return;
    }

    if (!assignmentData.assign_to_id) {
      toast({ title: 'Please select who to assign to', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('inventory')
      .update({
        assigned_to_type: assignmentData.assign_type,
        assigned_to_id: assignmentData.assign_to_id,
        status: 'assigned',
      })
      .in('id', selectedItems);

    if (!error) {
      toast({ title: 'Success', description: `${selectedItems.length} items assigned.` });
      setAssignDialogOpen(false);
      setSelectedItems([]);
      setAssignmentData({ assign_type: 'team_leader', assign_to_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUnassign = async () => {
    if (selectedItems.length === 0) return;

    const { error } = await supabase
      .from('inventory')
      .update({
        assigned_to_type: null,
        assigned_to_id: null,
        status: 'available',
      })
      .in('id', selectedItems);

    if (!error) {
      toast({ title: 'Success', description: `${selectedItems.length} items unassigned.` });
      setSelectedItems([]);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkEdit = async () => {
    if (selectedItems.length === 0) return;

    const updateData: any = {};
    if (bulkEditData.status) {
      updateData.status = bulkEditData.status;
    }

    if (Object.keys(updateData).length === 0) {
      toast({ title: 'No changes to apply', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('inventory').update(updateData).in('id', selectedItems);

    if (!error) {
      toast({ title: 'Success', description: `${selectedItems.length} items updated.` });
      setBulkEditDialogOpen(false);
      setSelectedItems([]);
      setBulkEditData({ status: '' });
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

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    let matchesAssigned = true;
    if (assignedFilter === 'unassigned') {
      matchesAssigned = !item.assigned_to_id;
    } else if (assignedFilter === 'assigned') {
      matchesAssigned = !!item.assigned_to_id;
    } else if (assignedFilter === 'team_leader') {
      matchesAssigned = item.assigned_to_type === 'team_leader';
    } else if (assignedFilter === 'captain') {
      matchesAssigned = item.assigned_to_type === 'captain';
    } else if (assignedFilter === 'dsr') {
      matchesAssigned = item.assigned_to_type === 'dsr';
    }

    return matchesSearch && matchesStatus && matchesAssigned;
  });

  const stats: AssignmentStats = {
    total: inventory.length,
    available: inventory.filter((i) => i.status === 'available' && !i.assigned_to_id).length,
    assignedTL: inventory.filter((i) => i.assigned_to_type === 'team_leader').length,
    assignedCaptain: inventory.filter((i) => i.assigned_to_type === 'captain').length,
    assignedDSR: inventory.filter((i) => i.assigned_to_type === 'dsr').length,
    sold: inventory.filter((i) => i.status === 'sold').length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
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
                Assign Stock
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Assign inventory to TL, Captain, or DSR with tracking</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <GlassCard className="text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Package className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-xl font-bold text-green-500">{stats.available}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <p className="text-xl font-bold text-blue-500">{stats.assignedTL}</p>
            <p className="text-xs text-muted-foreground">With TL</p>
          </GlassCard>
          <GlassCard className="text-center">
            <UserPlus className="h-6 w-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xl font-bold text-purple-500">{stats.assignedCaptain}</p>
            <p className="text-xs text-muted-foreground">With Captain</p>
          </GlassCard>
          <GlassCard className="text-center">
            <User className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold text-orange-500">{stats.assignedDSR}</p>
            <p className="text-xs text-muted-foreground">With DSR</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Package className="h-6 w-6 mx-auto text-secondary mb-1" />
            <p className="text-xl font-bold text-secondary">{stats.sold}</p>
            <p className="text-xs text-muted-foreground">Sold</p>
          </GlassCard>
        </div>

        {/* Filters & Actions */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by smartcard or serial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] glass-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="w-[160px] glass-input">
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="team_leader">With TL</SelectItem>
                <SelectItem value="captain">With Captain</SelectItem>
                <SelectItem value="dsr">With DSR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
              <Badge className="py-2 px-3">{selectedItems.length} selected</Badge>
              <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
                <Send className="w-4 h-4 mr-2" /> Assign Stock
              </Button>
              <Button size="sm" variant="outline" onClick={handleUnassign}>
                <ArrowRight className="w-4 h-4 mr-2" /> Unassign
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" /> Bulk Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          )}
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
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No inventory items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.slice(0, 100).map((item) => {
                  const assigneeName = getAssigneeName(item);
                  return (
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
                        <Badge
                          className={
                            item.status === 'available'
                              ? 'bg-green-500/20 text-green-500 border-green-500/30'
                              : item.status === 'assigned'
                              ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                              : 'bg-secondary/20 text-secondary border-secondary/30'
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.assigned_to_type && assigneeName ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                item.assigned_to_type === 'team_leader'
                                  ? 'bg-blue-500/20 text-blue-500 text-xs'
                                  : item.assigned_to_type === 'captain'
                                  ? 'bg-purple-500/20 text-purple-500 text-xs'
                                  : 'bg-orange-500/20 text-orange-500 text-xs'
                              }
                            >
                              {item.assigned_to_type === 'team_leader'
                                ? 'TL'
                                : item.assigned_to_type === 'captain'
                                ? 'Cpt'
                                : 'DSR'}
                            </Badge>
                            <span className="text-sm">{assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredInventory.length > 100 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Showing 100 of {filteredInventory.length} items
            </div>
          )}
        </GlassCard>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Assign Stock ({selectedItems.length} items)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Assign To</Label>
                <Select
                  value={assignmentData.assign_type}
                  onValueChange={(v) => setAssignmentData({ assign_type: v, assign_to_id: '' })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="captain">Captain</SelectItem>
                    <SelectItem value="dsr">DSR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Person</Label>
                <Select
                  value={assignmentData.assign_to_id}
                  onValueChange={(v) => setAssignmentData({ ...assignmentData, assign_to_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAssigneeOptions().map((person: any) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} className="bg-gradient-to-r from-primary to-secondary">
                <Send className="w-4 h-4 mr-2" /> Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Edit Dialog */}
        <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Bulk Edit ({selectedItems.length} items)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={bulkEditData.status}
                  onValueChange={(v) => setBulkEditData({ ...bulkEditData, status: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkEdit} className="bg-gradient-to-r from-primary to-secondary">
                <Edit className="w-4 h-4 mr-2" /> Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
