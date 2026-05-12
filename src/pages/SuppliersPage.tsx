import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, type Supplier } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, Globe, GitMerge, AlertTriangle, ExternalLink, Eye, Trash2, Pencil, ShoppingCart, Mail, Building2 } from "lucide-react";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type SortKey = "company" | "contact_name" | "email" | "phone" | "country" | "supplier_number" | "product_count" | "order_count";

const COLUMN_DEFS = [
  { id: "supplier_number", label: "מס' ספק",  sortField: "supplier_number" },
  { id: "company",         label: "חברה",      sortField: "company" },
  { id: "contact_name",    label: "איש קשר",   sortField: "contact_name" },
  { id: "country",         label: "מקור",      sortField: "country" },
  { id: "email",           label: "אימייל",    sortField: "email" },
  { id: "phone",           label: "טלפון",     sortField: "phone" },
  { id: "website",         label: "אתר" },
  { id: "product_count",   label: "מוצרים",   sortField: "product_count" },
  { id: "order_count",     label: "הזמנות",   sortField: "order_count" },
] as const;

interface DuplicateGroup {
  reason: string;
  suppliers: Supplier[];
}

function normalizeName(name: string) {
  return name.toLowerCase().trim().replace(/[.\-_\s]+/g, "");
}

function detectDuplicates(suppliers: Supplier[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const usedIds = new Set<string>();

  // Group by normalized company name
  const byName = new Map<string, Supplier[]>();
  for (const s of suppliers) {
    const key = normalizeName(s.company);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
  }
  for (const [, group] of byName) {
    if (group.length > 1) {
      const ids = group.map(s => s.id);
      if (!ids.some(id => usedIds.has(id))) {
        ids.forEach(id => usedIds.add(id));
        groups.push({ reason: "שם חברה זהה", suppliers: group });
      }
    }
  }

  // Group by email
  const byEmail = new Map<string, Supplier[]>();
  for (const s of suppliers) {
    if (!s.email) continue;
    const key = s.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(s);
  }
  for (const [, group] of byEmail) {
    if (group.length > 1) {
      const ids = group.map(s => s.id);
      if (!ids.some(id => usedIds.has(id))) {
        ids.forEach(id => usedIds.add(id));
        groups.push({ reason: "כתובת אימייל זהה", suppliers: group });
      }
    }
  }

  return groups;
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { hasEdit } = usePermissions("suppliers");
  const { addSupplier, updateSupplier, deleteSupplier, refreshSuppliers, products } = useData();
  const { scopedSuppliers: suppliers, scopedOrders } = useProductScope();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editSupplierTarget, setEditSupplierTarget] = useState<Supplier | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const prefs = useTablePreferences("SuppliersPage", {
    sortField: "company",
    filters: { countryFilter: "all" },
  });
  const orderCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of scopedOrders) {
      if (o.supplier_id) map.set(o.supplier_id, (map.get(o.supplier_id) ?? 0) + 1);
    }
    return map;
  }, [scopedOrders]);

  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      if (p.supplier_id) map.set(p.supplier_id, (map.get(p.supplier_id) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "suppliers:hidden-columns", COLUMN_DEFS, ["website"]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;
  const countryFilter = prefs.filters.countryFilter || "all";

  const countries = useMemo(() => {
    const set = new Set(suppliers.map(s => s.country).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [suppliers]);

  const filtered = useMemo(() => {
    let result = suppliers.filter(s => {
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return s.contact_name.toLowerCase().includes(q) || s.company.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q) || (s.notes || "").toLowerCase().includes(q);
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        if (sortKey === "product_count") {
          const diff = (productCountMap.get(a.id) ?? 0) - (productCountMap.get(b.id) ?? 0);
          return sortDir === "asc" ? diff : -diff;
        }
        if (sortKey === "order_count") {
          const diff = (orderCountMap.get(a.id) ?? 0) - (orderCountMap.get(b.id) ?? 0);
          return sortDir === "asc" ? diff : -diff;
        }
        const av = a[sortKey as keyof Supplier] || "";
        const bv = b[sortKey as keyof Supplier] || "";
        const cmp = String(av).localeCompare(String(bv), "he");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [suppliers, debouncedSearch, countryFilter, sortKey, sortDir, productCountMap, orderCountMap]);

  const duplicateGroups = useMemo(() => detectDuplicates(suppliers), [suppliers]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">ספקים ({filtered.length})</h1>
          {duplicateGroups.length > 0 && (
            <Badge variant="destructive" className="cursor-pointer" onClick={() => setMergeOpen(true)}>
              <AlertTriangle className="h-3 w-3 ml-1" />
              {duplicateGroups.length} כפילויות
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Select value={countryFilter} onValueChange={(v) => prefs.setFilter("countryFilter", v)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              {countries.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
          {hasEdit && (
            <>
              {duplicateGroups.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
                  <GitMerge className="h-4 w-4 ml-1" />מיזוג כפילויות
                </Button>
              )}
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 ml-1" />ספק חדש</Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">לא נמצאו ספקים</p>
            <p className="text-xs text-muted-foreground">נסה לחפש שם חברה אחר</p>
          </div>
        ) : filtered.map(s => (
          <div
            key={s.id}
            className="bg-card rounded-xl border shadow-sm p-4 cursor-pointer active:bg-muted/30 transition-colors"
            onClick={() => navigate(`/suppliers/${s.id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-base truncate">{s.company}</p>
                {s.contact_name && <p className="text-sm text-muted-foreground mt-0.5">{s.contact_name}</p>}
              </div>
              {s.country && (
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.country === "ישראל" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                  <Globe className="h-3 w-3" />
                  {s.country}
                </span>
              )}
            </div>
            {(s.email || s.phone) && (
              <div className="mt-2 space-y-0.5">
                {s.email && <p className="text-xs text-accent" dir="ltr">{s.email}</p>}
                {s.phone && <p className="text-xs text-muted-foreground" dir="ltr">{s.phone}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
            {COLUMN_DEFS.map(col => isVisible(col.id) ? (
              <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                {"sortField" in col ? (
                  <button onClick={() => prefs.toggleSort(col.sortField!)} className="flex items-center gap-1 hover:text-accent transition-colors">
                    {col.label}
                    <SortIcon col={col.sortField as SortKey} />
                  </button>
                ) : col.label}
              </th>
            ) : null)}
          </tr></thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={visibleCount} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">לא נמצאו ספקים</p>
                </div>
              </td></tr>
            ) : filtered.map(s => {
              const supplierMenuGroups: ContextMenuGroupItem[][] = [
                [
                  { label: "צפה בספק", icon: Eye, onClick: () => navigate(`/suppliers/${s.id}`) },
                  { label: "הזמנות הספק", icon: ShoppingCart, onClick: () => navigate(`/orders?q=${encodeURIComponent(s.company)}`) },
                ],
                [
                  { label: "ערוך ספק", icon: Pencil, onClick: () => { setEditSupplierTarget(s); setEditOpen(true); }, hidden: !hasEdit },
                ],
                [
                  { label: "העתק אימייל", icon: Mail, onClick: () => { navigator.clipboard.writeText(s.email!); toast.success("האימייל הועתק"); }, hidden: !s.email },
                ],
                [
                  { label: "מחק ספק", icon: Trash2, onClick: () => { deleteSupplier(s.id).then(() => toast.success("הספק נמחק")); }, variant: "destructive" as const, hidden: !hasEdit, confirmTitle: "מחיקת ספק", confirmDescription: `האם למחוק את "${s.company}"? פעולה זו לא ניתנת לביטול.` },
                ],
              ];
              return (
              <EntityContextMenu key={s.id} groups={supplierMenuGroups}>
              <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)} data-navigate-to={`/suppliers/${s.id}`}>
                {isVisible("supplier_number") && <td className="p-3 text-muted-foreground font-mono text-sm" dir="ltr">{s.supplier_number || "—"}</td>}
                {isVisible("company") && <td className="p-3 font-medium text-foreground">{s.company}</td>}
                {isVisible("contact_name") && <td className="p-3 text-muted-foreground">{s.contact_name}</td>}
                {isVisible("country") && (
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.country === "ישראל" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground"
                    }`}>
                      <Globe className="h-3 w-3" />
                      {s.country || "—"}
                    </span>
                  </td>
                )}
                {isVisible("email") && <td className="p-3">{s.email ? <span className="text-accent text-xs" dir="ltr">{s.email}</span> : "—"}</td>}
                {isVisible("phone") && <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>}
                {isVisible("website") && <td className="p-3">{s.website ? <a href={s.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-accent text-xs flex items-center gap-1" dir="ltr"><ExternalLink className="h-3 w-3 shrink-0" />{s.website}</a> : "—"}</td>}
                {isVisible("product_count") && <td className="p-3 text-center tabular-nums">{productCountMap.get(s.id) ?? 0}</td>}
                {isVisible("order_count") && <td className="p-3 text-center tabular-nums">{orderCountMap.get(s.id) ?? 0}</td>}
              </tr>
              </EntityContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortKey}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => prefs.savePreferences({ sortField: field, sortDir: "asc" })}
          onSortDesc={field => prefs.savePreferences({ sortField: field, sortDir: "desc" })}
        />
      )}

      {/* Edit Supplier Dialog */}
      <AddSupplierDialog
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) setEditSupplierTarget(null); }}
        onAdd={addSupplier}
        onUpdate={updateSupplier}
        editingSupplier={editSupplierTarget}
        existingSuppliers={suppliers}
      />

      {/* Merge Duplicates Dialog */}
      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        duplicateGroups={duplicateGroups}
        updateSupplier={updateSupplier}
        deleteSupplier={deleteSupplier}
        refreshSuppliers={refreshSuppliers}
      />

      {/* Add Supplier Dialog */}
      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addSupplier} existingSuppliers={suppliers} />
    </div>
  );
}

function MergeDuplicatesDialog({
  open, onOpenChange, duplicateGroups, updateSupplier, deleteSupplier, refreshSuppliers
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  refreshSuppliers: () => Promise<void>;
}) {
  const [merging, setMerging] = useState(false);
  // For each group, track which supplier to keep (default: first)
  const [keepMap, setKeepMap] = useState<Record<number, string>>({});

  const getKeep = (idx: number, group: DuplicateGroup) => keepMap[idx] ?? group.suppliers[0].id;

  const handleMergeGroup = async (groupIdx: number, group: DuplicateGroup) => {
    const keepId = getKeep(groupIdx, group);
    const keeper = group.suppliers.find(s => s.id === keepId)!;
    const toDelete = group.suppliers.filter(s => s.id !== keepId);

    setMerging(true);
    try {
      // Merge products field from all duplicates into keeper
      const allProducts = [
        ...(keeper.products || "").split(",").map(p => p.trim()).filter(Boolean),
        ...toDelete.flatMap(s => (s.products || "").split(",").map(p => p.trim()).filter(Boolean)),
      ];
      const mergedProducts = [...new Set(allProducts)].join(", ");

      // Merge notes
      const allNotes = [keeper.notes, ...toDelete.map(s => s.notes)].filter(Boolean).join("\n");

      // Pick best fields: prefer keeper's values, fall back to duplicate's if keeper is empty
      const mergedData: Partial<Supplier> = {
        products: mergedProducts || keeper.products,
        notes: allNotes || keeper.notes,
        phone: keeper.phone || toDelete.find(s => s.phone)?.phone,
        email: keeper.email || toDelete.find(s => s.email)?.email,
        website: keeper.website || toDelete.find(s => s.website)?.website,
        country: keeper.country || toDelete.find(s => s.country)?.country,
      };

      // Update keeper with merged data
      await updateSupplier(keepId, mergedData);

      // Re-assign orders from duplicates to keeper
      for (const dup of toDelete) {
        await supabase.from("orders").update({ supplier_id: keepId, supplier_name: keeper.company }).eq("supplier_id", dup.id);
        // Move contacts to keeper
        await supabase.from("supplier_contacts").update({ supplier_id: keepId }).eq("supplier_id", dup.id);
        // Delete the duplicate
        await supabase.from("suppliers").delete().eq("id", dup.id);
      }

      await refreshSuppliers();
      toast.success(`מוזגו ${toDelete.length} כפילויות של "${keeper.company}"`);
    } catch (err) {
      toast.error("שגיאה במיזוג ספקים: " + (err instanceof Error ? err.message : "נסה שוב"));
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAll = async () => {
    for (let i = 0; i < duplicateGroups.length; i++) {
      await handleMergeGroup(i, duplicateGroups[i]);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            מיזוג כפילויות — נמצאו {duplicateGroups.length} קבוצות
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            בחר לכל קבוצה איזה ספק לשמור. המידע (מוצרים, הערות, אנשי קשר, הזמנות) יועבר לספק הנבחר.
          </p>
          {duplicateGroups.map((group, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {group.reason} — {group.suppliers.length} רשומות
              </div>
              <div className="space-y-2">
                {group.suppliers.map(s => (
                  <label key={s.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    getKeep(idx, group) === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}>
                    <input
                      type="radio"
                      name={`group-${idx}`}
                      value={s.id}
                      checked={getKeep(idx, group) === s.id}
                      onChange={() => setKeepMap(prev => ({ ...prev, [idx]: s.id }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{s.company}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {s.contact_name && <div>איש קשר: {s.contact_name}</div>}
                        {s.email && <div dir="ltr">{s.email}</div>}
                        {s.phone && <div dir="ltr">{s.phone}</div>}
                        {s.products && <div className="truncate">מוצרים: {s.products}</div>}
                      </div>
                    </div>
                    {getKeep(idx, group) === s.id && (
                      <span className="text-xs text-primary font-medium whitespace-nowrap">שמור</span>
                    )}
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={merging}
                onClick={() => handleMergeGroup(idx, group)}
                className="w-full"
              >
                <GitMerge className="h-3.5 w-3.5 ml-1" />
                מזג קבוצה זו
              </Button>
            </div>
          ))}
          {duplicateGroups.length > 1 && (
            <Button onClick={handleMergeAll} disabled={merging} className="w-full">
              {merging ? "מוזג..." : `מזג את כל הכפילויות (${duplicateGroups.length} קבוצות)`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddSupplierDialog({ open, onOpenChange, onAdd, onUpdate, editingSupplier, existingSuppliers }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (supplier: Omit<Supplier, "id">) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Supplier>) => Promise<void>;
  editingSupplier?: Supplier | null;
  existingSuppliers: Supplier[];
}) {
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    company: "", contact_name: "", email: "", phone: "", country: "ישראל", website: "", notes: "", supplier_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [addingCountry, setAddingCountry] = useState(false);

  const isEditing = !!editingSupplier;

  const availableCountries = useMemo(() => {
    const set = new Set(existingSuppliers.map(s => s.country).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [existingSuppliers]);

  // Pre-populate fields when editing
  React.useEffect(() => {
    if (editingSupplier) {
      setFields({
        company: editingSupplier.company || "",
        contact_name: editingSupplier.contact_name || "",
        email: editingSupplier.email || "",
        phone: editingSupplier.phone || "",
        country: editingSupplier.country || "ישראל",
        website: editingSupplier.website || "",
        notes: editingSupplier.notes || "",
        supplier_number: editingSupplier.supplier_number || "",
      });
    } else {
      setFields({ company: "", contact_name: "", email: "", phone: "", country: "ישראל", website: "", notes: "", supplier_number: "" });
    }
    setAddingCountry(false);
  }, [editingSupplier, open]);

  const set = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  const similarSuppliers = useMemo(() => {
    if (isEditing || !fields.company.trim()) return [];
    const q = fields.company.trim().toLowerCase();
    return existingSuppliers.filter(s =>
      s.company.toLowerCase().includes(q) || q.includes(s.company.toLowerCase().slice(0, Math.max(q.length - 1, 3)))
    ).slice(0, 3);
  }, [fields.company, existingSuppliers, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing && onUpdate) {
        await onUpdate(editingSupplier!.id, {
          company: fields.company,
          contact_name: fields.contact_name,
          email: fields.email || null,
          phone: fields.phone || null,
          country: fields.country || null,
          website: fields.website || null,
          notes: fields.notes || null,
          supplier_number: fields.supplier_number || null,
        } as Partial<Supplier>);
      } else {
        await onAdd({
          company: fields.company,
          contact_name: fields.contact_name,
          email: fields.email || null,
          phone: fields.phone || null,
          country: fields.country || null,
          website: fields.website || null,
          notes: fields.notes || null,
          supplier_number: fields.supplier_number || null,
        });
      }
      onOpenChange(false);
    } catch {
      // error toast already shown by context
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEditing ? "עריכת ספק" : "ספק חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">שם חברה *</Label>
              <Input value={fields.company} onChange={e => set("company", e.target.value)} />
              {similarSuppliers.length > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 space-y-1">
                  <p className="text-xs font-medium text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />ספקים דומים כבר קיימים:
                  </p>
                  {similarSuppliers.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { onOpenChange(false); navigate(`/suppliers/${s.id}`); }}
                      data-navigate-to={`/suppliers/${s.id}`}
                      className="block w-full text-right text-xs text-primary hover:underline"
                    >
                      {s.company}{s.contact_name ? ` — ${s.contact_name}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">איש קשר *</Label>
              <Input value={fields.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אימייל</Label>
              <Input type="email" value={fields.email} onChange={e => set("email", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טלפון</Label>
              <Input value={fields.phone} onChange={e => set("phone", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מדינה</Label>
              {addingCountry ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    placeholder="שם מדינה"
                    value={fields.country}
                    onChange={e => set("country", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2 shrink-0"
                    onClick={() => { setAddingCountry(false); set("country", availableCountries[0] || "ישראל"); }}
                  >
                    ←
                  </Button>
                </div>
              ) : (
                <Select value={fields.country} onValueChange={v => {
                  if (v === "__new__") { set("country", ""); setAddingCountry(true); }
                  else set("country", v);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableCountries.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__new__">+ הוסף מדינה חדשה</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אתר</Label>
              <Input value={fields.website} onChange={e => set("website", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מספר ספק</Label>
              <Input value={fields.supplier_number} onChange={e => set("supplier_number", e.target.value)} dir="ltr" placeholder="לדוג' 042" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={fields.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving || !fields.company.trim() || !fields.contact_name.trim()}>
            {saving ? "שומר..." : isEditing ? "שמור שינויים" : "הוסף ספק"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
