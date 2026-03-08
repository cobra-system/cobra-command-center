import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SupplierEmailTab from "@/components/SupplierEmailTab";

export default function SuppliersPage() {
  const { suppliers } = useData();
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; company: string; email: string | null } | null>(null);

  const filtered = suppliers.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.contact_name.toLowerCase().includes(q) || s.company.toLowerCase().includes(q) || (s.products || "").toLowerCase().includes(q);
  });

  const abroad = filtered.filter(s => s.country === "חול");
  const israel = filtered.filter(s => s.country === "ישראל");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">ספקים</h1>
        <div className="relative min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
      </div>

      {[{ title: "ספקים מחו״ל", list: abroad }, { title: "ספקים בישראל", list: israel }].map(section => (
        <div key={section.title}>
          <h2 className="text-lg font-semibold text-foreground mb-3">{section.title} ({section.list.length})</h2>
          <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground">חברה</th>
                <th className="text-right p-3 font-semibold text-foreground">אימייל</th>
                <th className="text-right p-3 font-semibold text-foreground">טלפון</th>
                <th className="text-right p-3 font-semibold text-foreground">מוצרים</th>
                <th className="text-right p-3 font-semibold text-foreground">Lead Time</th>
                <th className="text-right p-3 font-semibold text-foreground">סיכון</th>
                <th className="text-right p-3 font-semibold text-foreground">תקשורת</th>
              </tr></thead>
              <tbody className="divide-y">
                {section.list.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">לא נמצאו ספקים</td></tr>
                ) : section.list.map(s => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium text-foreground">{s.contact_name}</td>
                    <td className="p-3 text-muted-foreground">{s.company}</td>
                    <td className="p-3">{s.email ? <a href={`mailto:${s.email}`} className="text-accent hover:underline text-xs" dir="ltr">{s.email}</a> : "—"}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.products || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.lead_time_days ? `${s.lead_time_days} ימים` : "—"}</td>
                    <td className="p-3">
                      {s.risk_level ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.risk_level === "גבוה" ? "bg-destructive/15 text-destructive" :
                          s.risk_level === "בינוני" ? "bg-warning/15 text-warning" :
                          "bg-success/15 text-success"
                        }`}>{s.risk_level}</span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setSelectedSupplier({ id: s.id, company: s.company, email: s.email || null })}
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
      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📧 תקשורת — {selectedSupplier?.company}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <SupplierEmailTab
              supplierEmail={selectedSupplier.email || ""}
              supplierName={selectedSupplier.company}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
