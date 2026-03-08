import { useAuth, useData, roleLabel } from "@/contexts/AppContext";

export default function TeamPage() {
  const { currentUser } = useAuth();
  const { profiles } = useData();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">צוות</h1>
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-right p-3 font-semibold text-foreground">שם</th>
            <th className="text-right p-3 font-semibold text-foreground">תפקיד</th>
            <th className="text-right p-3 font-semibold text-foreground">PIN</th>
          </tr></thead>
          <tbody className="divide-y">
            {profiles.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium text-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground">{roleLabel[u.role] || u.role}</td>
                <td className="p-3 font-mono text-muted-foreground" dir="ltr">{currentUser?.role === "MANAGER" ? (u.pin || "—") : "••••"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
