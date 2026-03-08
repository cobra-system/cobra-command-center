import { useData } from "@/contexts/AppContext";
import { roleLabel } from "@/data/mockData";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function TeamPage() {
  const { users } = useData();
  const [showPins, setShowPins] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">צוות</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-foreground">חברי צוות</h2>
          <button
            onClick={() => setShowPins(!showPins)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPins ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPins ? "הסתר PINs" : "הצג PINs"}
          </button>
        </div>
        <div className="divide-y">
          {users.map(user => (
            <div key={user.id} className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {user.name[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel[user.role]}</p>
              </div>
              {user.email && (
                <span className="text-xs text-muted-foreground" dir="ltr">{user.email}</span>
              )}
              {user.pin && (
                <span className="text-sm font-mono bg-muted px-3 py-1 rounded text-foreground" dir="ltr">
                  {showPins ? user.pin : "••••"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
