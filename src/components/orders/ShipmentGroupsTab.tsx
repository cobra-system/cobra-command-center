import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ShipmentGroup } from "@/contexts/types";

import { format } from "date-fns";
const COLUMN_DEFS: ColDef[] = [
  { id: "name",           label: "שם קבוצה",       sortField: "name" },
  { id: "vessel_name",    label: "שם אונייה",       sortField: "vessel_name" },
  { id: "departure_date", label: "תאריך יציאה",     sortField: "departure_date" },
  { id: "arrival_date",   label: "תאריך הגעה",      sortField: "arrival_date" },
  { id: "booking_number", label: "מספר הזמנת מקום" },
  { id: "tclog_ref",      label: "אסמכתא TCLOG" },
  { id: "order_count",    label: 'מס׳ הזמנות' },
  { id: "notes",          label: "הערות" },
] as const;

type SortField = "name" | "vessel_name" | "departure_date" | "arrival_date";
type SortDir = "asc" | "desc" | null;

export function ShipmentGroupsTab() {
  const navigate = useNavigate();
  const { hasEdit } = usePermissions("shipment-groups");
  const [groups, setGroups] = useState<ShipmentGroup[]>([]);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>("departure_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ShipmentGroup | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formVessel, setFormVessel] = useState("");
  const [formDeparture, setFormDeparture] = useState<Date | undefined>();
  const [formArrival, setFormArrival] = useState<Date | undefined>();
  const [formBooking, setFormBooking] = useState("");
  const [formTclog, setFormTclog] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "shipment-groups:hidden-columns",
    COLUMN_DEFS,
    ["tclog_ref", "notes"]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const fetchData = useCallback(async () => {
    const [groupsRes, countsRes] = await Promise.all([
      supabase.from("shipment_groups").select("*").order("departure_date", { ascending: false }),
      supabase.from("orders").select("shipment_group_id").not("shipment_group_id", "is", null),
    ]);
    if (groupsRes.data) setGroups(groupsRes.data as ShipmentGroup[]);
    if (countsRes.data) {
      const counts: Record<string, number> = {};
      for (const row of countsRes.data) {
        if (row.shipment_group_id) counts[row.shipment_group_id] = (counts[row.shipment_group_id] || 0) + 1;
      }
      setOrderCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  const filtered = groups
    .filter(g => !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()) || (g.vessel_name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortField || !sortDir) return 0;
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name, "he");
      else if (sortField === "vessel_name") cmp = (a.vessel_name || "").localeCompare(b.vessel_name || "", "he");
      else if (sortField === "departure_date") cmp = (a.departure_date || "").localeCompare(b.departure_date || "");
      else if (sortField === "arrival_date") cmp = (a.arrival_date || "").localeCompare(b.arrival_date || "");
      return sortDir === "desc" ? -cmp : cmp;
    });

  const openAdd = () => {
    setEditingGroup(null);
    setFormName(""); setFormVessel(""); setFormDeparture(undefined);
    setFormArrival(undefined); setFormBooking(""); setFormTclog(""); setFormNotes("");
    setShowForm(true);
  };

  const openEdit = (g: ShipmentGroup) => {
    setEditingGroup(g);
    setFormName(g.name);
    setFormVessel(g.vessel_name || "");
    setFormDeparture(g.departure_date ? new Date(g.departure_date) : undefined);
    setFormArrival(g.arrival_date ? new Date(g.arrival_date) : undefined);
    setFormBooking(g.booking_number || "");
    setFormTclog(g.tclog_reference || "");
    setFormNotes(g.notes || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("יש להזין שם קבוצה"); return; }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      vessel_name: formVessel || null,
      departure_date: formDeparture ? formDeparture.toISOString().split("T")[0] : null,
      arrival_date: formArrival ? formArrival.toISOString().split("T")[0] : null,
      booking_number: formBooking || null,
      tclog_reference: formTclog || null,
      notes: formNotes || null,
    };
    const { error } = editingGroup
      ? await supabase.from("shipment_groups").update(payload).eq("id", editingGroup.id)
      : await supabase.from("shipment_groups").insert(payload);
    setSaving(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success(editingGroup ? "קבוצה עודכנה" : "קבוצה נוצרה");
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("shipment_groups").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("קבוצה נמחקה");
    fetchData();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="חיפוש לפי שם קבוצה או אונייה..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {hasEdit && (
          <Button onClick={openAdd} className="ms-auto">
            <Plus className="h-4 w-4 ml-1" />קבוצה חדשה
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => toggleSort(col.sortField as SortField)} className="flex items-center gap-1 hover:text-primary transition-colors">
                      {col.label} <SortIcon field={col.sortField as SortField} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
              {hasEdit && <th className="p-3 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={visibleCount + (hasEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">טוען...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={visibleCount + (hasEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">אין קבוצות משלוח</td></tr>
            ) : filtered.map(g => (
              <tr
                key={g.id}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/orders?shipment_group=${g.id}`)}
              >
                {isVisible("name") && (
                  <td className="p-3 font-medium text-foreground">{g.name}</td>
                )}
                {isVisible("vessel_name") && (
                  <td className="p-3 text-muted-foreground">{g.vessel_name || "—"}</td>
                )}
                {isVisible("departure_date") && (
                  <td className="p-3 text-muted-foreground text-xs">
                    {g.departure_date ? new format(Date(g.departure_date), "dd/MM/yyyy") : "—"}
                  </td>
                )}
                {isVisible("arrival_date") && (
                  <td className="p-3 text-muted-foreground text-xs">
                    {g.arrival_date ? new format(Date(g.arrival_date), "dd/MM/yyyy") : "—"}
                  </td>
                )}
                {isVisible("booking_number") && (
                  <td className="p-3 text-muted-foreground text-xs font-mono">{g.booking_number || "—"}</td>
                )}
                {isVisible("tclog_ref") && (
                  <td className="p-3 text-muted-foreground text-xs">{g.tclog_reference || "—"}</td>
                )}
                {isVisible("order_count") && (
                  <td className="p-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      (orderCounts[g.id] || 0) > 0 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                    )}>
                      <Package className="h-3 w-3" />
                      {orderCounts[g.id] || 0}
                    </span>
                  </td>
                )}
                {isVisible("notes") && (
                  <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{g.notes || "—"}</td>
                )}
                {hasEdit && (
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(g)}>✎</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(g.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "עריכת קבוצת משלוח" : "קבוצת משלוח חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>שם קבוצה *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="MSC ISABELLA - ינואר 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>שם אונייה</Label>
              <Input value={formVessel} onChange={e => setFormVessel(e.target.value)} placeholder="MSC ISABELLA" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך יציאה</Label>
                <DateInput value={formDeparture} onChange={setFormDeparture} clearable />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך הגעה</Label>
                <DateInput value={formArrival} onChange={setFormArrival} clearable />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>מספר הזמנת מקום</Label>
              <Input value={formBooking} onChange={e => setFormBooking(e.target.value)} placeholder="BL / Booking number" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>אסמכתא TCLOG</Label>
              <Input value={formTclog} onChange={e => setFormTclog(e.target.value)} placeholder="TCLOG reference" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="הערות..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as SortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as SortField); setSortDir("desc"); }}
        />
      )}
    </div>
  );
}
