import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Quote {
  id: string;
  component_name: string;
  product_id: string | null;
  supplier_id: string;
  unit_price: number;
  currency: string;
  moq: number | null;
  lead_time_days: number | null;
  valid_until: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

export default function SupplierComparisonPanel({ componentName, productId }: { componentName: string; productId: string }) {
  const { suppliers } = useData();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formSupplier, setFormSupplier] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formMoq, setFormMoq] = useState("");
  const [formLeadTime, setFormLeadTime] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("supplier_price_quotes")
      .select("*")
      .eq("component_name", componentName)
      .eq("product_id", productId)
      .order("unit_price", { ascending: true });
    if (data) setQuotes(data as Quote[]);
    setLoading(false);
  }, [componentName, productId]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const handleAdd = async () => {
    if (!formSupplier || !formPrice) return;
    await supabase.from("supplier_price_quotes").insert({
      component_name: componentName,
      product_id: productId,
      supplier_id: formSupplier,
      unit_price: Number(formPrice),
      currency: formCurrency,
      moq: formMoq ? Number(formMoq) : null,
      lead_time_days: formLeadTime ? Number(formLeadTime) : null,
      valid_until: formValidUntil || null,
      notes: formNotes || null,
    });
    toast.success("הצעת מחיר נוספה");
    setDialogOpen(false);
    setFormSupplier(""); setFormPrice(""); setFormMoq(""); setFormLeadTime(""); setFormValidUntil(""); setFormNotes("");
    fetchQuotes();
  };

  const setPrimary = async (quoteId: string) => {
    // Unset all, then set the selected
    for (const q of quotes) {
      if (q.is_primary) await supabase.from("supplier_price_quotes").update({ is_primary: false }).eq("id", q.id);
    }
    await supabase.from("supplier_price_quotes").update({ is_primary: true }).eq("id", quoteId);
    toast.success("ספק נבחר כראשי");
    fetchQuotes();
  };

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.company || "—";

  if (loading) return <Skeleton className="h-20 w-full" />;

  const cheapest = quotes.length > 0 ? Math.min(...quotes.map(q => q.unit_price)) : 0;
  const primaryQuote = quotes.find(q => q.is_primary);
  const savings = primaryQuote && cheapest < primaryQuote.unit_price
    ? primaryQuote.unit_price - cheapest
    : 0;

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">השוואת ספקים — {componentName}</h3>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{quotes.length} הצעות</span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-3 w-3 ml-1" />הוסף הצעה</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>הצעת מחיר חדשה — {componentName}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>ספק *</Label>
                <Select value={formSupplier} onValueChange={setFormSupplier}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>מחיר יחידה *</Label>
                  <Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>מטבע</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="ILS">ILS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>MOQ</Label><Input type="number" value={formMoq} onChange={e => setFormMoq(e.target.value)} /></div>
                <div className="space-y-1"><Label>Lead Time (ימים)</Label><Input type="number" value={formLeadTime} onChange={e => setFormLeadTime(e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label>תוקף הצעה</Label><Input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} /></div>
              <div className="space-y-1"><Label>הערות</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
              <Button onClick={handleAdd} disabled={!formSupplier || !formPrice} className="w-full">הוסף הצעה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">אין הצעות מחיר לרכיב זה</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-right p-2 font-semibold text-foreground">ספק</th>
                <th className="text-right p-2 font-semibold text-foreground">מחיר</th>
                <th className="text-right p-2 font-semibold text-foreground">MOQ</th>
                <th className="text-right p-2 font-semibold text-foreground">Lead Time</th>
                <th className="text-right p-2 font-semibold text-foreground">תוקף</th>
                <th className="text-right p-2 font-semibold text-foreground">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map(q => (
                <tr key={q.id} className={`${q.is_primary ? "bg-primary/5" : ""}`}>
                  <td className="p-2 text-foreground flex items-center gap-1">
                    {q.is_primary && <Star className="h-3 w-3 text-warning fill-warning" />}
                    {supplierName(q.supplier_id)}
                  </td>
                  <td className="p-2 font-mono text-foreground" dir="ltr">
                    {currencySymbol[q.currency]}{q.unit_price}
                    {q.unit_price === cheapest && quotes.length > 1 && <span className="text-success mr-1">✓</span>}
                  </td>
                  <td className="p-2 text-muted-foreground">{q.moq || "—"}</td>
                  <td className="p-2 text-muted-foreground">{q.lead_time_days ? `${q.lead_time_days}d` : "—"}</td>
                  <td className="p-2 text-muted-foreground">{q.valid_until ? format(new Date(q.valid_until), "dd/MM/yy") : "—"}</td>
                  <td className="p-2">
                    {!q.is_primary && <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setPrimary(q.id)}>⭐ בחר</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {savings > 0 && (
            <p className="text-xs text-success font-medium bg-success/10 rounded p-2 text-center">
              💡 חיסכון פוטנציאלי: {currencySymbol[primaryQuote?.currency || "USD"]}{savings.toFixed(2)} ליחידה בבחירת הספק הזול ביותר
            </p>
          )}
        </>
      )}
    </div>
  );
}
