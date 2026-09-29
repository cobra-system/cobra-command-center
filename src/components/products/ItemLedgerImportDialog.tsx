import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { parseLedgerFile, type ParsedLedger } from "@/lib/itemLedger/parse";
import { importLedgerFile, useInvalidateItemLedger, useItemLedgerImports } from "@/hooks/useItemLedger";
import type { Product } from "@/contexts/AppContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

interface ParsedFile { name: string; parsed: ParsedLedger | null; error?: string }

const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—");

export default function ItemLedgerImportDialog({ open, onOpenChange, products }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const invalidate = useInvalidateItemLedger();
  const { data: history } = useItemLedgerImports();

  const productIdBySku = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) if (p.sku) m.set(p.sku.trim().toUpperCase(), p.id);
    return m;
  }, [products]);

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const out: ParsedFile[] = [];
    for (const f of Array.from(list)) {
      try {
        const parsed = parseLedgerFile(await f.arrayBuffer());
        out.push(parsed.items.length
          ? { name: f.name, parsed }
          : { name: f.name, parsed: null, error: "לא נמצאו פריטים — זה לא נראה כמו כרטסת פריטים" });
      } catch (e) {
        out.push({ name: f.name, parsed: null, error: e instanceof Error ? e.message : "שגיאה בקריאת הקובץ" });
      }
    }
    setFiles(out);
  };

  const valid = files.filter(f => f.parsed);
  const totalItems = valid.reduce((s, f) => s + f.parsed!.items.length, 0);

  const runImport = async () => {
    setBusy(true);
    let done = 0;
    let unmatchedTotal = 0;
    try {
      for (const f of valid) {
        const base = done;
        const res = await importLedgerFile(f.name, f.parsed!, productIdBySku, p => setProgress({ done: base + p.done, total: totalItems }));
        done += f.parsed!.items.length;
        unmatchedTotal += res.unmatched.length;
      }
      invalidate();
      toast.success(`נטענו ${totalItems} פריטים${unmatchedTotal ? ` (${unmatchedTotal} בלי מוצר תואם בקוברה)` : ""}`);
      setFiles([]);
      onOpenChange(false);
    } catch (e) {
      toast.error(`הייבוא נכשל: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) { onOpenChange(o); if (!o) setFiles([]); } }}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />ייבוא כרטסת פריטים</DialogTitle>
          <DialogDescription>
            טוענים את קובץ הכרטסת מהמערכת (כל הפריטים או חלקם). לכל מק״ט, התנועות בטווח התאריכים של הקובץ מחליפות את מה שנטען קודם,
            כך שאפשר לטעון כל חודש קובץ מצטבר או רק את החודש האחרון. הניתוח מופיע בעמוד של כל מוצר.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx,.txt,.tsv,.csv"
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full border-2 border-dashed rounded-lg py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <Upload className="h-6 w-6" />
          בחירת קובץ כרטסת (.xls)
        </button>

        {files.map(f => {
          const p = f.parsed;
          const unmatched = p ? p.items.filter(i => !productIdBySku.has(i.sku)) : [];
          return (
            <div key={f.name} className="border rounded-lg p-3 text-sm space-y-1.5">
              <p className="font-medium truncate" dir="ltr">{f.name}</p>
              {f.error ? (
                <p className="text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{f.error}</p>
              ) : p && (
                <>
                  <p className="text-muted-foreground">
                    {p.items.length} פריטים · {p.movement_count.toLocaleString("he-IL")} תנועות · {dmy(p.period_start)} – {dmy(p.period_end)}
                  </p>
                  <p className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" />{p.items.length - unmatched.length} מק״טים תואמים למוצרים בקוברה
                  </p>
                  {unmatched.length > 0 && (
                    <details className="text-warning">
                      <summary className="cursor-pointer">{unmatched.length} מק״טים בלי מוצר תואם (יישמרו ויוצגו כשייפתח מוצר עם אותו מק״ט)</summary>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed" dir="ltr">{unmatched.map(u => u.sku).join(", ")}</p>
                    </details>
                  )}
                </>
              )}
            </div>
          );
        })}

        {progress && (
          <div className="space-y-1">
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
            <p className="text-xs text-muted-foreground text-center">{progress.done} / {progress.total} פריטים</p>
          </div>
        )}

        {!files.length && history && history.length > 0 && (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-foreground">טעינות אחרונות</p>
            {history.map(h => (
              <div key={h.id} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate" dir="ltr">{h.file_name}</span>
                <span className="shrink-0 tabular-nums">{dmy(h.period_start)}–{dmy(h.period_end)} · {h.item_count} פריטים · נטען {dmy(h.created_at.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ביטול</Button>
          <Button onClick={runImport} disabled={busy || !valid.length}>
            {busy ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Upload className="h-4 w-4 ml-1" />}
            ייבוא {totalItems ? `${totalItems} פריטים` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
