import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { Mail } from "lucide-react";

export default function SuppliersPage() {
  const { suppliers } = useData();
  const [countryFilter, setCountryFilter] = useState<"חול" | "ישראל">("חול");

  const filtered = suppliers.filter(s => s.country === countryFilter);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">ספקים</h1>

      <div className="flex bg-secondary rounded-lg p-1 w-fit">
        {(["חול", "ישראל"] as const).map(c => (
          <button
            key={c}
            onClick={() => setCountryFilter(c)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              countryFilter === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {c === "חול" ? "ספקים מחו\"ל" : "ספקים בישראל"}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">שם איש קשר</th>
              <th className="text-right p-3 font-semibold text-foreground">חברה</th>
              <th className="text-right p-3 font-semibold text-foreground">אימייל</th>
              {countryFilter === "ישראל" && <th className="text-right p-3 font-semibold text-foreground">טלפון</th>}
              <th className="text-right p-3 font-semibold text-foreground">מוצרים</th>
              <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">אין ספקים</td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id}>
                  <td className="p-3 font-medium text-foreground">{s.contactName}</td>
                  <td className="p-3 text-muted-foreground">{s.company}</td>
                  <td className="p-3 text-muted-foreground text-xs" dir="ltr">{s.email || "—"}</td>
                  {countryFilter === "ישראל" && <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>}
                  <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.products || "—"}</td>
                  <td className="p-3">
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="text-accent hover:text-accent/80">
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
