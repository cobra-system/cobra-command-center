import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Search, Package, Truck, ShoppingCart, ListTodo, FileText, CreditCard, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  type: "product" | "supplier" | "order" | "task" | "document" | "payment";
  path: string;
}

const typeConfig = {
  product: { icon: Package, label: "מוצר", color: "text-blue-500" },
  supplier: { icon: Truck, label: "ספק", color: "text-green-500" },
  order: { icon: ShoppingCart, label: "הזמנה", color: "text-orange-500" },
  task: { icon: ListTodo, label: "משימה", color: "text-purple-500" },
  document: { icon: FileText, label: "מסמך", color: "text-red-500" },
  payment: { icon: CreditCard, label: "תשלום", color: "text-emerald-500" },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { products, suppliers, orders, tasks } = useData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [docsRes, paymentsRes] = await Promise.all([
        supabase.from("purchase_documents").select("id, name, supplier_id"),
        supabase.from("supplier_payments").select("id, supplier_id, notes, amount"),
      ]);
      if (docsRes.data) setDocuments(docsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
    };
    fetchData();
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const res: SearchResult[] = [];
    const limit = 20;

    for (const p of products) {
      if (res.length >= limit) break;
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)) {
        res.push({ id: p.id, label: p.name, subtitle: p.sku, type: "product", path: `/products/${p.id}` });
      }
    }

    for (const s of suppliers) {
      if (res.length >= limit) break;
      if (s.company.toLowerCase().includes(q) || s.contact_name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)) {
        res.push({ id: s.id, label: s.company, subtitle: s.contact_name, type: "supplier", path: `/suppliers/${s.id}` });
      }
    }

    for (const o of orders) {
      if (res.length >= limit) break;
      if ((o.supplier_name || "").toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q))) {
        res.push({ id: o.id, label: `הזמנה — ${o.supplier_name || "ללא ספק"}`, subtitle: o.status, type: "order", path: `/orders/${o.id}` });
      }
    }

    for (const t of tasks) {
      if (res.length >= limit) break;
      if (t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)) {
        res.push({ id: t.id, label: t.title, subtitle: t.assignee_name || undefined, type: "task", path: `/tasks?highlight=${t.id}` });
      }
    }

    for (const d of documents) {
      if (res.length >= limit) break;
      if ((d.name || "").toLowerCase().includes(q)) {
        res.push({ id: d.id, label: d.name || "מסמך ללא שם", subtitle: "מסמך רכש", type: "document", path: `/documents` });
      }
    }

    for (const p of payments) {
      if (res.length >= limit) break;
      if ((p.notes || "").toLowerCase().includes(q)) {
        res.push({ id: p.id, label: `תשלום — $${p.amount || "—"}`, subtitle: p.notes || "ללא הערות", type: "payment", path: `/documents?tab=payments` });
      }
    }

    return res;
  }, [query, products, suppliers, orders, tasks, documents, payments]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative px-3 mb-2">
      <div className="relative">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="חיפוש..."
          className="pr-8 pl-7 h-8 text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-primary/50"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-[60] top-full mt-1 right-0 left-0 mx-3 bg-popover border rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map(r => {
            const cfg = typeConfig[r.type];
            const Icon = cfg.icon;
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-right hover:bg-accent transition-colors text-sm"
              >
                <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground">{r.label}</p>
                  {r.subtitle && <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-[60] top-full mt-1 right-0 left-0 mx-3 bg-popover border rounded-lg shadow-xl p-4 text-center text-sm text-muted-foreground">
          לא נמצאו תוצאות
        </div>
      )}
    </div>
  );
}
