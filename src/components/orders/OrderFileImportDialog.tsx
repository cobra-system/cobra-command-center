/**
 * Import an order from a file — a purchase order exported from SAP (PDF) or an
 * order/PI file from a foreign supplier (Excel/CSV).
 *
 * Parses the file in the browser, matches the supplier and the line items against
 * live data, shows a preview, and hands the result back to the new-order form.
 * Nothing is written to the database here: the form stays in control, and the file
 * itself is attached to the order's documents once the order is created.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, Loader2, Upload, X } from "lucide-react";
import type { Product, Supplier } from "@/contexts/types";
import {
  IMPORT_ACCEPT,
  matchItems,
  matchReasonLabel,
  matchSupplier,
  parseOrderFile,
  type MatchedImportItem,
  type ParsedOrderDoc,
} from "@/lib/orderImport";

export interface OrderImportResult {
  doc: ParsedOrderDoc;
  supplierId: string;
  items: MatchedImportItem[];
  file: File;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  products: Product[];
  onApply: (result: OrderImportResult) => void;
}

export function OrderFileImportDialog({ open, onOpenChange, suppliers, products, onApply }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [doc, setDoc] = useState<ParsedOrderDoc | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [supplierReason, setSupplierReason] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const supplierOptions = useMemo(
    () => suppliers.map(s => ({ value: s.id, label: `${s.company} — ${s.contact_name}` })),
    [suppliers]
  );

  const matched = useMemo<MatchedImportItem[]>(
    () => (doc ? matchItems(doc.items, products) : []),
    [doc, products]
  );
  const genericCount = matched.filter(m => m.generic && !m.product).length;
  const unmatchedCount = matched.filter(m => !m.product).length - genericCount;

  const reset = useCallback(() => {
    setFile(null);
    setDoc(null);
    setSupplierId("");
    setSupplierReason(null);
    setParsing(false);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    setDoc(null);
    const parsed = await parseOrderFile(f);
    setDoc(parsed);
    const supplierMatch = matchSupplier(parsed, suppliers);
    setSupplierId(supplierMatch.supplier?.id ?? "");
    setSupplierReason(supplierMatch.reason ? matchReasonLabel[supplierMatch.reason] : null);
    setParsing(false);
  }, [suppliers]);

  useFileDropPaste(handleFile, { disabled: !open });

  const handleApply = () => {
    if (!doc || !file) return;
    onApply({ doc, supplierId, items: matched, file });
    reset();
    onOpenChange(false);
  };

  const money = (v?: number | null) =>
    v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא הזמנה מקובץ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <div className="font-semibold">איך זה עובד</div>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pe-5">
              <li>העלה הזמנת רכש מ-SAP (PDF) או קובץ הזמנה מספק בחו״ל (Excel / CSV)</li>
              <li>המערכת מזהה ספק, פריטים, כמויות ומחירים ומשווה מול המוצרים במערכת</li>
              <li>בדוק את התצוגה המקדימה ולחץ "טען לטופס" — הכל ייכנס לטופס ההזמנה לעריכה</li>
              <li>הקובץ עצמו יישמר אוטומטית במסמכים של ההזמנה לאחר יצירתה</li>
            </ol>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              file && "border-primary/50 bg-primary/5"
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); reset(); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">גרור, הדבק (Ctrl+V) או לחץ לבחירת קובץ</p>
                <p className="text-xs text-muted-foreground">PDF מ-SAP, Excel, CSV</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              מנתח את הקובץ...
            </div>
          )}

          {doc && !parsing && (
            <div className="space-y-4">
              {doc.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    שים לב
                  </div>
                  <ul className="text-xs text-amber-800 space-y-0.5 list-disc pe-5">
                    {doc.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Header summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Summary label="מקור" value={doc.source === "sap-pdf" ? "SAP (PDF)" : "קובץ הזמנה"} />
                <Summary label="מס' הזמנה" value={doc.poNumber || doc.piNumber || "—"} ltr />
                <Summary label="תאריך" value={doc.orderDate || "—"} ltr />
                <Summary label="תנאי תשלום" value={doc.paymentTerms || "—"} />
                {doc.deliveryDate && <Summary label="תאריך אספקה" value={doc.deliveryDate} ltr />}
                {doc.notes && <Summary label="הערה בקובץ" value={doc.notes} />}
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <Label>ספק</Label>
                <Combobox
                  value={supplierId}
                  onValueChange={v => { setSupplierId(v); setSupplierReason(null); }}
                  options={supplierOptions}
                  placeholder="בחר ספק"
                  searchPlaceholder="חיפוש ספק..."
                />
                <p className="text-xs text-muted-foreground">
                  {doc.supplierName ? <>בקובץ: <span className="font-medium">{doc.supplierName}</span>{doc.supplierVat ? ` (ח.פ ${doc.supplierVat})` : ""}. </> : null}
                  {supplierId
                    ? <span className="text-emerald-700">זוהה {supplierReason ? `(${supplierReason})` : "ידנית"}</span>
                    : <span className="text-amber-700">לא זוהה ספק — בחר ידנית</span>}
                </p>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>פריטים ({doc.items.length})</Label>
                  <span className={cn("text-xs", unmatchedCount ? "text-amber-700" : "text-emerald-700")}>
                    {unmatchedCount || genericCount
                      ? `${matched.filter(m => m.product).length} מתוך ${doc.items.length} שויכו למוצר` +
                        (genericCount ? ` · ${genericCount} מק״ט כללי` : "")
                      : "כל הפריטים שויכו למוצרים במערכת"}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right p-2 font-semibold">קוד</th>
                        <th className="text-right p-2 font-semibold">תיאור בקובץ</th>
                        <th className="text-right p-2 font-semibold">מוצר במערכת</th>
                        <th className="text-right p-2 font-semibold">כמות</th>
                        <th className="text-right p-2 font-semibold">מחיר</th>
                        <th className="text-right p-2 font-semibold">סה"כ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matched.length === 0 && (
                        <tr><td colSpan={6} className="p-3 text-center text-muted-foreground text-xs">לא זוהו פריטים בקובץ</td></tr>
                      )}
                      {matched.map((m, i) => (
                        <tr key={i} className={cn(!m.product && (m.generic ? "bg-sky-50/60" : "bg-amber-50/60"))}>
                          <td className="p-2 font-mono text-xs" dir="ltr">{m.parsed.code || "—"}</td>
                          <td className="p-2">{m.parsed.description || "—"}</td>
                          <td className="p-2">
                            {m.product ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                {m.product.name}
                                {m.reason && <span className="text-muted-foreground text-xs">({matchReasonLabel[m.reason]})</span>}
                              </span>
                            ) : m.generic ? (
                              <span className="inline-flex items-center gap-1 text-sky-700">
                                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                                מק״ט כללי ({m.parsed.code}) — התיאור הוא הפריט
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                                לא זוהה — ייכנס כשורה חופשית
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-mono" dir="ltr">{m.parsed.qty ?? "—"}</td>
                          <td className="p-2 font-mono" dir="ltr">{money(m.parsed.unitPrice)}</td>
                          <td className="p-2 font-mono" dir="ltr">{money(m.parsed.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {(doc.subtotal != null || doc.total != null) && (
                      <tfoot>
                        <tr className="border-t bg-muted/30 text-xs">
                          <td colSpan={5} className="p-2 font-semibold text-right">
                            סה"כ לפני מע"מ{doc.vatRate != null ? ` · מע"מ ${doc.vatRate}% · סה"כ כולל` : ""}
                          </td>
                          <td className="p-2 font-mono font-semibold" dir="ltr">
                            {money(doc.subtotal)}{doc.total != null ? ` / ${money(doc.total)}` : ""}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <Button onClick={handleApply} className="w-full" disabled={!doc.items.length && !supplierId}>
                טען לטופס ההזמנה
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                שום דבר לא נשמר עדיין — אפשר לערוך הכל בטופס לפני יצירת ההזמנה.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground truncate" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
