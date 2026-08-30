/**
 * Create or edit an import dossier (תיק יבוא).
 *
 * Every field except the file number is optional: the paperwork arrives in
 * batches over several days, and a dossier has to be usable from the moment
 * the first PDF lands. The identifier fields are grouped first because those
 * are what a person reads off the documents — and what the future auto-matcher
 * will key on.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Loader2 } from "lucide-react";
import {
  type ImportFile,
  shipmentModes,
  shipmentModeLabels,
  importFileStatuses,
  importFileStatusLabels,
} from "@/lib/importFiles";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing dossier to edit; omit to create a new one. */
  importFile?: ImportFile | null;
  /** Order the new dossier is linked to on creation. */
  orderId?: string | null;
  /** Prefilled from the order, so the common case needs no typing. */
  defaultSupplierId?: string | null;
  defaultSupplierName?: string | null;
  onSaved: () => void;
}

/** `<input type="date">` wants yyyy-MM-dd; the DB hands back the same shape. */
function toDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIsoDate(date: Date | undefined): string | null {
  if (!date) return null;
  // Local date parts, so a date picked as 16/05 is never stored as 15/05 by
  // a UTC shift.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export default function ImportFileDialog({
  open,
  onOpenChange,
  importFile,
  orderId,
  defaultSupplierId,
  defaultSupplierName,
  onSaved,
}: Props) {
  const editing = Boolean(importFile);
  const [saving, setSaving] = useState(false);

  const [fileNumber, setFileNumber] = useState("");
  const [forwarder, setForwarder] = useState("");
  const [mode, setMode] = useState<string>("SEA");
  const [status, setStatus] = useState<string>("draft");

  const [declarationNumber, setDeclarationNumber] = useState("");
  const [declarationDate, setDeclarationDate] = useState<Date | undefined>();
  const [blNumber, setBlNumber] = useState("");
  const [houseBl, setHouseBl] = useState("");
  const [container, setContainer] = useState("");
  const [vessel, setVessel] = useState("");
  const [portLoading, setPortLoading] = useState("");
  const [portDischarge, setPortDischarge] = useState("");

  const [etd, setEtd] = useState<Date | undefined>();
  const [arrival, setArrival] = useState<Date | undefined>();
  const [release, setRelease] = useState<Date | undefined>();

  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [goodsValue, setGoodsValue] = useState("");
  const [goodsCurrency, setGoodsCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const [customsValue, setCustomsValue] = useState("");

  const [weight, setWeight] = useState("");
  const [volume, setVolume] = useState("");
  const [packages, setPackages] = useState("");
  const [notes, setNotes] = useState("");

  // Reset the form each time the dialog opens, so a cancelled edit does not
  // leak into the next one.
  useEffect(() => {
    if (!open) return;
    const f = importFile;
    setFileNumber(f?.file_number ?? "");
    setForwarder(f?.forwarder_name ?? "");
    setMode(f?.shipment_mode ?? "SEA");
    setStatus(f?.status ?? "draft");
    setDeclarationNumber(f?.declaration_number ?? "");
    setDeclarationDate(toDate(f?.declaration_date));
    setBlNumber(f?.bl_number ?? "");
    setHouseBl(f?.house_bl_number ?? "");
    setContainer(f?.container_number ?? "");
    setVessel(f?.vessel_name ?? "");
    setPortLoading(f?.port_of_loading ?? "");
    setPortDischarge(f?.port_of_discharge ?? "");
    setEtd(toDate(f?.etd));
    setArrival(toDate(f?.arrival_date));
    setRelease(toDate(f?.release_date));
    setSupplierName(f?.supplier_name ?? defaultSupplierName ?? "");
    setSupplierInvoice(f?.supplier_invoice_number ?? "");
    setGoodsValue(f?.goods_value != null ? String(f.goods_value) : "");
    setGoodsCurrency(f?.goods_currency ?? "USD");
    setExchangeRate(f?.exchange_rate != null ? String(f.exchange_rate) : "");
    setCustomsValue(f?.customs_value_ils != null ? String(f.customs_value_ils) : "");
    setWeight(f?.gross_weight_kg != null ? String(f.gross_weight_kg) : "");
    setVolume(f?.volume_cbm != null ? String(f.volume_cbm) : "");
    setPackages(f?.package_count != null ? String(f.package_count) : "");
    setNotes(f?.notes ?? "");
  }, [open, importFile, defaultSupplierName]);

  const handleSave = async () => {
    if (!fileNumber.trim()) {
      toast.error("מספר תיק הוא שדה חובה");
      return;
    }

    setSaving(true);

    const payload = {
      file_number: fileNumber.trim(),
      forwarder_name: forwarder.trim() || null,
      shipment_mode: mode,
      status,
      declaration_number: declarationNumber.trim() || null,
      declaration_date: toIsoDate(declarationDate),
      bl_number: blNumber.trim() || null,
      house_bl_number: houseBl.trim() || null,
      container_number: container.trim() || null,
      vessel_name: vessel.trim() || null,
      port_of_loading: portLoading.trim() || null,
      port_of_discharge: portDischarge.trim() || null,
      etd: toIsoDate(etd),
      arrival_date: toIsoDate(arrival),
      release_date: toIsoDate(release),
      supplier_id: importFile?.supplier_id ?? defaultSupplierId ?? null,
      supplier_name: supplierName.trim() || null,
      supplier_invoice_number: supplierInvoice.trim() || null,
      goods_value: numOrNull(goodsValue),
      goods_currency: goodsCurrency,
      exchange_rate: numOrNull(exchangeRate),
      customs_value_ils: numOrNull(customsValue),
      gross_weight_kg: numOrNull(weight),
      volume_cbm: numOrNull(volume),
      package_count: numOrNull(packages),
      notes: notes.trim() || null,
    };

    if (editing && importFile) {
      const { error } = await supabase.from("import_files").update(payload).eq("id", importFile.id);
      setSaving(false);
      if (error) {
        toast.error(`שמירה נכשלה: ${error.message}`);
        return;
      }
      toast.success("התיק עודכן");
      onOpenChange(false);
      onSaved();
      return;
    }

    const { data, error } = await supabase.from("import_files").insert(payload).select("id").single();
    if (error) {
      setSaving(false);
      // The unique index is on (forwarder_name, file_number) among live rows.
      const duplicate = error.code === "23505";
      toast.error(duplicate ? "כבר קיים תיק עם המספר הזה אצל אותו משלח" : `יצירה נכשלה: ${error.message}`);
      return;
    }

    // Link the new dossier to the order it was created from. A dossier can
    // cover several orders, so this is a row in the join table, not a column.
    if (orderId) {
      const { error: linkError } = await supabase.from("import_file_orders").insert({
        import_file_id: data.id,
        order_id: orderId,
        matched_by: "manual",
        match_reason: "created from order",
      });
      if (linkError) {
        setSaving(false);
        toast.error(`התיק נוצר אך השיוך להזמנה נכשל: ${linkError.message}`);
        onOpenChange(false);
        onSaved();
        return;
      }
      await supabase.from("import_files").update({ status: "matched" }).eq("id", data.id);
    }

    setSaving(false);
    toast.success("התיק נוצר");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `עריכת תיק ${importFile?.file_number}` : "תיק יבוא חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identity — what a person reads off the top of every document. */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">זיהוי</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>מספר תיק *</Label>
                <Input value={fileNumber} onChange={e => setFileNumber(e.target.value)} placeholder="460509" />
              </div>
              <div>
                <Label>משלח / עמיל מכס</Label>
                <Input value={forwarder} onChange={e => setForwarder(e.target.value)} placeholder="Total Care Logistics" />
              </div>
              <div>
                <Label>סוג משלוח</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {shipmentModes.map(m => (
                      <SelectItem key={m} value={m}>{shipmentModeLabels[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>מספר רשימון</Label>
                <Input value={declarationNumber} onChange={e => setDeclarationNumber(e.target.value)} placeholder="26024532019850" />
              </div>
              <div>
                <Label>תאריך רשימון</Label>
                <DateInput value={declarationDate} onChange={setDeclarationDate} clearable />
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {importFileStatuses.map(s => (
                      <SelectItem key={s} value={s}>{importFileStatusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Carrier details — the strongest signals for matching a dossier
              to an order later on. */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">משלוח</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>שטר מטען (Master)</Label>
                <Input value={blNumber} onChange={e => setBlNumber(e.target.value)} placeholder="RWOE2603160002" />
              </div>
              <div>
                <Label>שטר מטען פנימי (House)</Label>
                <Input value={houseBl} onChange={e => setHouseBl(e.target.value)} placeholder="03160002" />
              </div>
              <div>
                <Label>מספר מכולה</Label>
                <Input value={container} onChange={e => setContainer(e.target.value)} placeholder="YMMU6158726" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>שם אונייה / טיסה</Label>
                <Input value={vessel} onChange={e => setVessel(e.target.value)} placeholder="YM WISH" />
              </div>
              <div>
                <Label>נמל טעינה</Label>
                <Input value={portLoading} onChange={e => setPortLoading(e.target.value)} placeholder="SHENZHEN" />
              </div>
              <div>
                <Label>נמל פריקה</Label>
                <Input value={portDischarge} onChange={e => setPortDischarge(e.target.value)} placeholder="ASHDOD" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>תאריך יציאה</Label>
                <DateInput value={etd} onChange={setEtd} clearable />
              </div>
              <div>
                <Label>תאריך הגעה</Label>
                <DateInput value={arrival} onChange={setArrival} clearable />
              </div>
              <div>
                <Label>תאריך שחרור</Label>
                <DateInput value={release} onChange={setRelease} clearable />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">ספק וערך טובין</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>שם ספק (כפי שמופיע במסמך)</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="SHENZHEN ISTARVIDEO" />
              </div>
              <div>
                <Label>מספר חשבונית ספק / PI</Label>
                <Input value={supplierInvoice} onChange={e => setSupplierInvoice(e.target.value)} placeholder="iSV260120001b" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label>ערך טובין</Label>
                <Input value={goodsValue} onChange={e => setGoodsValue(e.target.value)} placeholder="230502.50" inputMode="decimal" />
              </div>
              <div>
                <Label>מטבע</Label>
                <Select value={goodsCurrency} onValueChange={setGoodsCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="ILS">ILS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>שער חליפין</Label>
                <Input value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="2.9215" inputMode="decimal" />
              </div>
              <div>
                <Label>ערך לצרכי מס (₪)</Label>
                <Input value={customsValue} onChange={e => setCustomsValue(e.target.value)} placeholder="673421" inputMode="decimal" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">נתונים פיזיים</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>משקל ברוטו (ק"ג)</Label>
                <Input value={weight} onChange={e => setWeight(e.target.value)} placeholder="2091" inputMode="decimal" />
              </div>
              <div>
                <Label>נפח (CBM)</Label>
                <Input value={volume} onChange={e => setVolume(e.target.value)} placeholder="9.176" inputMode="decimal" />
              </div>
              <div>
                <Label>מספר אריזות</Label>
                <Input value={packages} onChange={e => setPackages(e.target.value)} placeholder="9" inputMode="numeric" />
              </div>
            </div>
          </section>

          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            {editing ? "שמור" : "צור תיק"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
