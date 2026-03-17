import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, type Supplier } from "@/contexts/AppContext";
import { Search, Plus, Mail, ArrowUpDown, ArrowUp, ArrowDown, Globe, GitMerge, AlertTriangle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import SupplierEmailTab from "@/components/SupplierEmailTab";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type SortKey = "company" | "contact_name" | "email" | "phone" | "country";

const sortableColumns: { key: SortKey; label: string }[] = [
  { key: "company", label: "חברה" },
  { key: "contact_name", label: "איש קשר" },
  { key: "country", label: "מקור" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
];

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
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, refreshSuppliers } = useData();
  const [search, setSearch] = useState("");
  const [emailSupplier, setEmailSupplier] = useState<{ id: string; company: string; email: string | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const prefs = useTablePreferences("SuppliersPage", {
    sortField: "company",
    filters: { countryFilter: "all" },
  });

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
      if (!search) return true;
      const q = search.toLowerCase();
      return s.contact_name.toLowerCase().includes(q) || s.company.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a as any)[sortKey] || "";
        const bv = (b as any)[sortKey] || "";
        const cmp = String(av).localeCompare(String(bv), "he");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [suppliers, search, countryFilter, sortKey, sortDir]);

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
          {currentUser?.role === "MANAGER" && (
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

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            {sortableColumns.map(col => (
              <th key={col.key} className="text-right p-3 font-semibold text-foreground">
                <button onClick={() => prefs.toggleSort(col.key)} className="flex items-center gap-1 hover:text-accent transition-colors">
                  {col.label}
                  <SortIcon col={col.key} />
                </button>
              </th>
            ))}
            <th className="text-right p-3 font-semibold text-foreground">תקשורת</th>
          </tr></thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">לא נמצאו ספקים</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)}>
                <td className="p-3 font-medium text-foreground">{s.company}</td>
                <td className="p-3 text-muted-foreground">{s.contact_name}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.country === "ישראל" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground"
                  }`}>
                    <Globe className="h-3 w-3" />
                    {s.country || "—"}
                  </span>
                </td>
                <td className="p-3">{s.email ? <span className="text-accent text-xs" dir="ltr">{s.email}</span> : "—"}</td>
                <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                <td className="p-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEmailSupplier({ id: s.id, company: s.company, email: s.email || null }); }}
                    className="text-primary hover:text-primary/80 transition-colors"
                    title="📧 תקשורת"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Email Dialog */}
      <Dialog open={!!emailSupplier} onOpenChange={() => setEmailSupplier(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📧 תקשורת — {emailSupplier?.company}</DialogTitle></DialogHeader>
          {emailSupplier && <SupplierEmailTab supplierEmail={emailSupplier.email || ""} supplierName={emailSupplier.company} />}
        </DialogContent>
      </Dialog>

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
        website: (keeper as any).website || toDelete.find(s => (s as any).website)?.website,
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
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
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

function AddSupplierDialog({ open, onOpenChange, onAdd, existingSuppliers }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (supplier: Omit<Supplier, "id">) => Promise<void>;
  existingSuppliers: Supplier[];
}) {
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    company: "", contact_name: "", email: "", phone: "", country: "ישראל", website: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  const similarSuppliers = useMemo(() => {
    if (!fields.company.trim()) return [];
    const q = fields.company.trim().toLowerCase();
    return existingSuppliers.filter(s =>
      s.company.toLowerCase().includes(q) || q.includes(s.company.toLowerCase().slice(0, Math.max(q.length - 1, 3)))
    ).slice(0, 3);
  }, [fields.company, existingSuppliers]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onAdd({
        company: fields.company,
        contact_name: fields.contact_name,
        email: fields.email || null,
        phone: fields.phone || null,
        country: fields.country || null,
        website: fields.website || null,
        notes: fields.notes || null,
      });
      toast.success("ספק נוסף בהצלחה");
      onOpenChange(false);
      setFields({ company: "", contact_name: "", email: "", phone: "", country: "ישראל", website: "", notes: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>ספק חדש</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
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
              <Select value={fields.country} onValueChange={v => set("country", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ישראל">ישראל</SelectItem>
                  <SelectItem value="חול">חו״ל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אתר</Label>
              <Input value={fields.website} onChange={e => set("website", e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={fields.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving || !fields.company.trim() || !fields.contact_name.trim()}>
            {saving ? "שומר..." : "הוסף ספק"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
