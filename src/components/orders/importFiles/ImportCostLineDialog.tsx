/**
 * Add or edit one charge on an import dossier.
 *
 * The two checkboxes here are what keep the numbers honest, and both are easy
 * to get wrong by hand:
 *   - "מתקזז" (recoverable) — import VAT is reclaimed, so it is real cash out
 *     but must never inflate a product's landed cost.
 *   - "כלול בחשבונית" — the forwarder's summary invoice restates the freight
 *     and terminal invoices line by line. Recording both without marking the
 *     nesting counts that money twice.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  type ImportCostLine,
  type ImportDocument,
  type ImportCostCategory,
  importCostCategories,
  importCostCategoryLabels,
  RECOVERABLE_BY_DEFAULT,
  importDocSubtypeLabels,
  type ImportDocSubtype,
} from "@/lib/importFiles";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importFileId: string;
  /** Documents in this dossier — a charge can cite the PDF it was read off. */
  documents: ImportDocument[];
  line?: ImportCostLine | null;
  onSaved: () => void;
}

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function docLabel(doc: ImportDocument): string {
  const subtype = doc.document_subtype as ImportDocSubtype | null;
  const kind = subtype && importDocSubtypeLabels[subtype] ? importDocSubtypeLabels[subtype] : subtype;
  return [kind, doc.document_number || doc.document_name].filter(Boolean).join(" · ") || "מסמך";
}

export default function ImportCostLineDialog({ open, onOpenChange, importFileId, documents, line, onSaved }: Props) {
  const editing = Boolean(line);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [lineCode, setLineCode] = useState("");
  const [category, setCategory] = useState<ImportCostCategory>("other");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [amountIls, setAmountIls] = useState("");
  const [isRecoverable, setIsRecoverable] = useState(false);
  const [documentId, setDocumentId] = useState<string>(NONE);
  const [includedIn, setIncludedIn] = useState<string>(NONE);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel(line?.label ?? "");
    setLineCode(line?.line_code ?? "");
    setCategory((line?.category as ImportCostCategory) ?? "other");
    setAmount(line?.amount != null ? String(line.amount) : "");
    setCurrency(line?.currency ?? "ILS");
    setAmountIls(line?.amount_ils != null ? String(line.amount_ils) : "");
    setIsRecoverable(line?.is_recoverable ?? false);
    setDocumentId(line?.document_id ?? NONE);
    setIncludedIn(line?.included_in_document_id ?? NONE);
    setNotes(line?.notes ?? "");
  }, [open, line]);

  /**
   * Picking a category pre-fills the two fields that follow from it, but only
   * when creating — an edit must never silently overwrite a human's choice.
   */
  const handleCategoryChange = (next: string) => {
    const cat = next as ImportCostCategory;
    setCategory(cat);
    if (editing) return;
    setIsRecoverable(RECOVERABLE_BY_DEFAULT.includes(cat));
    if (!label.trim()) setLabel(importCostCategoryLabels[cat]);
  };

  const handleSave = async () => {
    const parsedAmount = numOrNull(amount);
    if (!label.trim()) {
      toast.error("תיאור החיוב הוא שדה חובה");
      return;
    }
    if (parsedAmount === null) {
      toast.error("סכום לא תקין");
      return;
    }

    setSaving(true);

    const payload = {
      import_file_id: importFileId,
      label: label.trim(),
      line_code: lineCode.trim() || null,
      category,
      amount: parsedAmount,
      currency,
      // An ILS charge needs no conversion; store it in both places so totals
      // never have to special-case the base currency.
      amount_ils: currency === "ILS" ? parsedAmount : numOrNull(amountIls),
      is_recoverable: isRecoverable,
      document_id: documentId === NONE ? null : documentId,
      included_in_document_id: includedIn === NONE ? null : includedIn,
      notes: notes.trim() || null,
    };

    const { error } = editing && line
      ? await supabase.from("import_cost_lines").update(payload).eq("id", line.id)
      : await supabase.from("import_cost_lines").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(`שמירה נכשלה: ${error.message}`);
      return;
    }

    toast.success(editing ? "השורה עודכנה" : "השורה נוספה");
    onOpenChange(false);
    onSaved();
  };

  const needsConversion = currency !== "ILS";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת שורת עלות" : "שורת עלות חדשה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>תיאור *</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="הובלה משילוח לעמילות" />
            </div>
            <div>
              <Label>קוד שורה</Label>
              <Input value={lineCode} onChange={e => setLineCode(e.target.value)} placeholder="14" />
            </div>
          </div>

          <div>
            <Label>קטגוריה</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {importCostCategories.map(c => (
                  <SelectItem key={c} value={c}>{importCostCategoryLabels[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>סכום *</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="5872.64" inputMode="decimal" />
            </div>
            <div>
              <Label>מטבע</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">ILS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsConversion && (
              <div>
                <Label>סכום בשקלים</Label>
                <Input value={amountIls} onChange={e => setAmountIls(e.target.value)} placeholder="3240.05" inputMode="decimal" />
              </div>
            )}
          </div>
          {needsConversion && !numOrNull(amountIls) && (
            <p className="text-xs text-warning">
              בלי סכום בשקלים השורה לא תיכלל בסיכומים.
            </p>
          )}

          <div>
            <Label>מקור (מסמך)</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>ללא</SelectItem>
                {documents.map(d => (
                  <SelectItem key={d.id} value={d.id}>{docLabel(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="flex items-start gap-2">
              <Checkbox
                id="cost-recoverable"
                checked={isRecoverable}
                onCheckedChange={v => setIsRecoverable(v === true)}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="cost-recoverable" className="cursor-pointer">מתקזז (לא נכנס לעלות המוצר)</Label>
                <p className="text-xs text-muted-foreground">
                  מע"מ יבוא משולם ומתקזז — נספר בתזרים אבל לא בעלות הנחיתה.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>כלול כבר בחשבונית אחרת</Label>
              <Select value={includedIn} onValueChange={setIncludedIn}>
                <SelectTrigger><SelectValue placeholder="לא כלול" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>לא כלול</SelectItem>
                  {documents.map(d => (
                    <SelectItem key={d.id} value={d.id}>{docLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                בחר את החשבונית המרכזת אם החיוב הזה כבר מופיע בתוכה — כדי שלא ייספר פעמיים.
              </p>
            </div>
          </div>

          <div>
            <Label>הערות</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            שמור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
