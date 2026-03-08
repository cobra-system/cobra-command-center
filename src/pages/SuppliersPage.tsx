import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SuppliersPage() {
  const { suppliers } = useData();
  const [search, setSearch] = useState("");

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
              </tr></thead>
              <tbody className="divide-y">
                {section.list.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">לא נמצאו ספקים</td></tr>
                ) : section.list.map(s => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium text-foreground">{s.contact_name}</td>
                    <td className="p-3 text-muted-foreground">{s.company}</td>
                    <td className="p-3">{s.email ? <a href={`mailto:${s.email}`} className="text-accent hover:underline text-xs" dir="ltr">{s.email}</a> : "—"}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.products || "—"}</td>
                    <td className="p-3 text-muted-foreground">{(s as any).lead_time_days ? `${(s as any).lead_time_days} ימים` : "—"}</td>
                    <td className="p-3">
                      {(s as any).risk_level ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          (s as any).risk_level === "גבוה" ? "bg-destructive/15 text-destructive" :
                          (s as any).risk_level === "בינוני" ? "bg-warning/15 text-warning" :
                          "bg-success/15 text-success"
                        }`}>{(s as any).risk_level}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
