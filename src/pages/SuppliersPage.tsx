import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, type Supplier } from "@/contexts/AppContext";
import { Search, Plus, Mail, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SupplierEmailTab from "@/components/SupplierEmailTab";
import { toast } from "sonner";

type SortKey = "company" | "contact_name" | "email" | "phone";
type SortDir = "asc" | "desc";

const sortableColumns: { key: SortKey; label: string }[] = [
  { key: "company", label: "חברה" },
  { key: "contact_name", label: "איש קשר" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
];

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { suppliers, addSupplier } = useData();
  const [search, setSearch] = useState("");
  const [emailSupplier, setEmailSupplier] = useState<{ id: string; company: string; email: string | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const abroad = useMemo(() => filtered.filter(s => s.country === "חול"), [filtered]);
  const israel = useMemo(() => filtered.filter(s => s.country === "ישראל"), [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const sections = countryFilter === "all"
    ? [{ title: "ספקים מחו״ל", list: abroad }, { title: "ספקים בישראל", list: israel }]
    : countryFilter === "חול"
    ? [{ title: "ספקים מחו״ל", list: abroad }]
    : [{ title: "ספקים בישראל", list: israel }];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">ספקים</h1>
        <div className="flex items-center gap-3">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="חול">חו״ל</SelectItem>
              <SelectItem value="ישראל">ישראל</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
          {currentUser?.role === "MANAGER" && (
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 ml-1" />ספק חדש</Button>
          )}
        </div>
      </div>

      {sections.map(section => (
        <div key={section.title}>
          <h2 className="text-lg font-semibold text-foreground mb-3">{section.title} ({section.list.length})</h2>
          <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                {sortableColumns.map(col => (
                  <th key={col.key} className="text-right p-3 font-semibold text-foreground">
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-accent transition-colors">
                      {col.label}
                      <SortIcon col={col.key} />
                    </button>
                  </th>
                ))}
                <th className="text-right p-3 font-semibold text-foreground">מוצרים</th>
                <th className="text-right p-3 font-semibold text-foreground">תקשורת</th>
              </tr></thead>
              <tbody className="divide-y">
                {section.list.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">לא נמצאו ספקים</td></tr>
                ) : section.list.map(s => (
                  <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)}>
                    <td className="p-3 font-medium text-foreground">{s.company}</td>
                    <td className="p-3 text-muted-foreground">{s.contact_name}</td>
                    <td className="p-3">{s.email ? <span className="text-accent text-xs" dir="ltr">{s.email}</span> : "—"}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.products || "—"}</td>
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
        </div>
      ))}

      {/* Email Dialog */}
      <Dialog open={!!emailSupplier} onOpenChange={() => setEmailSupplier(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📧 תקשורת — {emailSupplier?.company}</DialogTitle></DialogHeader>
          {emailSupplier && <SupplierEmailTab supplierEmail={emailSupplier.email || ""} supplierName={emailSupplier.company} />}
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addSupplier} />
    </div>
  );
}

function AddSupplierDialog({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (supplier: Omit<Supplier, "id">) => Promise<void>;
}) {
  const [fields, setFields] = useState({
    company: "", contact_name: "", email: "", phone: "", country: "ישראל", website: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

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
