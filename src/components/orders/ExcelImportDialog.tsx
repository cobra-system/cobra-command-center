import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AppContext";
import type { OrderRequest } from "@/contexts/types";
import { parseTsv, type ParsedExcelRow } from "./orderRequestExcel";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: string;
  existing: OrderRequest[];
  onDone: () => void;
}

interface MatchedRow {
  parsed: ParsedExcelRow;
  match: OrderRequest | null;
  willCreate: boolean;
}

export function ExcelImportDialog({ open, onOpenChange, division, existing, onDone }: Props) {
  const { currentUser } = useAuth();
  const [paste, setPaste] = useState("");
  const [parsed, setParsed] = useState<MatchedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);

  const skuIndex = useMemo(() => {
    const m = new Map<string, OrderRequest>();
    for (const r of existing) {
      if (r.product_sku) m.set(r.product_sku.trim(), r);
      if (r.product_name) m.set(r.product_name.trim(), r);
    }
    return m;
  }, [existing]);

  const handleParse = () => {
    const rows = parseTsv(paste);
    if (rows.length === 0) { toast.error("לא נמצאו שורות תקינות. ודא שהדבקת מאקסל עם כותרות"); return; }
    const matched: MatchedRow[] = rows.map(p => {
      const match = p.matchKey ? skuIndex.get(p.matchKey) ?? null : null;
      return { parsed: p, match, willCreate: !match };
    });
    setParsed(matched);
  };

  const apply = async () => {
    setSubmitting(true);
    let updated = 0, created = 0, failed = 0;
    for (const m of parsed) {
      if (m.match) {
        const { error } = await supabase
          .from("order_requests")
          .update(m.parsed.patch)
          .eq("id", m.match.id);
        if (error) failed++; else updated++;
      } else if (createMissing && m.parsed.patch.product_name) {
        const { error } = await supabase.from("order_requests").insert({
          division,
          product_name: m.parsed.patch.product_name,
          product_sku: m.parsed.patch.product_sku ?? null,
          supplier: m.parsed.patch.supplier ?? null,
          status: "pending",
          urgency: m.parsed.patch.urgency ?? "רגיל",
          order_type: m.parsed.patch.order_type ?? "חודשית",
          ...m.parsed.patch,
          created_by: currentUser?.id ?? null,
          created_by_name: currentUser?.name ?? null,
        });
        if (error) failed++; else created++;
      }
    }
    setSubmitting(false);
    if (updated + created > 0) {
      toast.success(`עודכנו ${updated}${created > 0 ? `, נוצרו ${created}` : ""}${failed > 0 ? `, נכשלו ${failed}` : ""}`);
      onDone();
      onOpenChange(false);
    } else {
      toast.error("שום שורה לא יושמה");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא מאקסל</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <div className="font-semibold">איך זה עובד</div>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pe-5">
              <li>סמן באקסל את הטבלה כולל כותרות (שורה ראשונה)</li>
              <li>Ctrl+C → הדבק כאן (Ctrl+V)</li>
              <li>השוואה לפי מק״ט או שם פריט. לא תמצא — שורה תיווצר רק אם תאשר</li>
              <li>שדות שלא קיימים בכותרות לא ישתנו</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">הדבק כאן את הטבלה מאקסל</Label>
            <Textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              rows={6}
              placeholder="חטיבה	תיאור פריט	ספק	..."
              dir="ltr"
              className="font-mono text-xs"
            />
            <Button size="sm" variant="outline" onClick={handleParse} disabled={!paste.trim()}>
              נתח שורות
            </Button>
          </div>

          {parsed.length > 0 && (
            <>
              <div className="rounded-lg border">
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold">{parsed.length}</span> שורות זוהו ·
                    <span className="text-green-700"> {parsed.filter(r => r.match).length} עדכונים</span>
                    {parsed.filter(r => !r.match).length > 0 && (
                      <> · <span className="text-amber-700">{parsed.filter(r => !r.match).length} שורות חדשות</span></>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createMissing}
                      onChange={e => setCreateMissing(e.target.checked)}
                    />
                    צור שורות חדשות שלא נמצאו
                  </label>
                </div>
                <div className="max-h-[40vh] overflow-y-auto divide-y text-sm">
                  {parsed.map((m, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-2">
                      {m.match ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {m.parsed.patch.product_name ?? m.parsed.matchKey ?? "שורה ללא שם"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {m.match ? "יעודכן" : (createMissing ? "ייווצר" : "ידולג (סמן 'צור שורות חדשות')")}
                          {Object.keys(m.parsed.patch).length > 0 && ` · ${Object.keys(m.parsed.patch).length} שדות`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>ביטול</Button>
            {parsed.length > 0 && (
              <Button onClick={apply} disabled={submitting}>
                {submitting ? "מיישם..." : `יישם ${createMissing ? parsed.length : parsed.filter(r => r.match).length} שורות`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
