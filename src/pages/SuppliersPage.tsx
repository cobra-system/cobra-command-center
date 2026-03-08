import { useData } from "@/contexts/AppContext";

export default function SuppliersPage() {
  const { suppliers } = useData();
  const abroad = suppliers.filter(s => s.country === "חול");
  const israel = suppliers.filter(s => s.country === "ישראל");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">ספקים</h1>
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
              </tr></thead>
              <tbody className="divide-y">
                {section.list.map(s => (
                  <tr key={s.id}>
                    <td className="p-3 font-medium text-foreground">{s.contact_name}</td>
                    <td className="p-3 text-muted-foreground">{s.company}</td>
                    <td className="p-3">{s.email ? <a href={`mailto:${s.email}`} className="text-accent hover:underline text-xs" dir="ltr">{s.email}</a> : "—"}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.products || "—"}</td>
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
