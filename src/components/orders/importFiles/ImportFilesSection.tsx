/**
 * Import dossiers attached to one order.
 *
 * The way in is dragging the forwarder's email attachments onto the section —
 * the same gesture as uploading a SWIFT confirmation. Nothing is asked up
 * front: which dossier the files belong to, and what each document is, are
 * both inferred from the file names. The shipment details and cost lines are
 * filled in later from the dossier's own menu, if at all.
 *
 * Matching to an order stays manual for now, and every link is recorded in
 * import_file_orders with how it was made, so the eventual auto-matcher has
 * real decisions to learn from and be scored against.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Ship, Plus, Link2, Trash2, Upload, ChevronDown, ChevronLeft, Pencil,
  ExternalLink, AlertTriangle, Loader2, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import ImportFileDialog from "./ImportFileDialog";
import ImportCostLineDialog from "./ImportCostLineDialog";
import {
  type ImportFile,
  type ImportCostLine,
  type ImportDocument,
  type ImportDocSubtype,
  importDocSubtypeLabels,
  importCostCategoryLabels,
  importFileStatusLabels,
  importFileStatusColors,
  shipmentModeLabels,
  sumImportCosts,
  lineAmountIls,
  attachImportDocumentBatch,
  uploadImportDocument,
  guessSubtype,
  guessDocumentNumber,
  IMPORT_FILE_ACCEPT,
  type ImportFileStatus,
  type ShipmentMode,
  type ImportCostCategory,
} from "@/lib/importFiles";

const DOC_COLUMN_DEFS: ColDef[] = [
  { id: "kind",   label: "סוג" },
  { id: "name",   label: "שם מסמך" },
  { id: "number", label: "מספר" },
  { id: "amount", label: "סכום" },
  { id: "date",   label: "נוסף" },
] as const;

const COST_COLUMN_DEFS: ColDef[] = [
  { id: "label",    label: "תיאור" },
  { id: "category", label: "קטגוריה" },
  { id: "code",     label: "קוד" },
  { id: "amount",   label: "סכום" },
  { id: "ils",      label: 'סכום ₪' },
  { id: "flags",    label: "סימונים" },
] as const;

interface Props {
  orderId: string;
  hasEdit: boolean;
  supplierId?: string | null;
  supplierName?: string | null;
  /** Names a dossier when the attachments share no file number. */
  orderNumber?: string | null;
}

/** A dossier plus everything hanging off it. */
interface DossierBundle {
  file: ImportFile;
  documents: ImportDocument[];
  costLines: ImportCostLine[];
  /** Orders other than this one that share the dossier. */
  otherOrders: { id: string; order_number: string | null }[];
}

const ils = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yy");
}

export default function ImportFilesSection({ orderId, hasEdit, supplierId, supplierName, orderNumber }: Props) {
  const navigate = useNavigate();
  const [bundles, setBundles] = useState<DossierBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ImportFile | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [costTarget, setCostTarget] = useState<{ file: ImportFile; line: ImportCostLine | null } | null>(null);

  const { isVisible: docVisible, hide: docHide, show: docShow, hiddenCols: docHidden, visibleCount: docVisibleCount } =
    useColumnVisibility("import-documents:hidden-columns", DOC_COLUMN_DEFS);
  const { menu: docMenu, setMenu: setDocMenu, closeMenu: closeDocMenu } = useColMenu();

  const { isVisible: costVisible, hide: costHide, show: costShow, hiddenCols: costHidden, visibleCount: costVisibleCount } =
    useColumnVisibility("import-cost-lines:hidden-columns", COST_COLUMN_DEFS, ["code"]);
  const { menu: costMenu, setMenu: setCostMenu, closeMenu: closeCostMenu } = useColMenu();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: links } = await supabase
      .from("import_file_orders")
      .select("import_file_id")
      .eq("order_id", orderId);

    const fileIds = (links ?? []).map(l => l.import_file_id);
    if (fileIds.length === 0) {
      setBundles([]);
      setLoading(false);
      return;
    }

    // One round trip per relation rather than per dossier.
    const [filesRes, docsRes, costsRes, allLinksRes] = await Promise.all([
      supabase.from("import_files").select("*").in("id", fileIds).is("deleted_at", null)
        .order("arrival_date", { ascending: false, nullsFirst: false }),
      supabase.from("purchase_documents").select("id, import_file_id, document_name, document_subtype, document_number, file_url, total_price, currency, created_at")
        .in("import_file_id", fileIds).order("created_at", { ascending: true }),
      supabase.from("import_cost_lines").select("*").in("import_file_id", fileIds)
        .order("created_at", { ascending: true }),
      supabase.from("import_file_orders").select("import_file_id, order_id, orders(id, order_number)")
        .in("import_file_id", fileIds),
    ]);

    const files = (filesRes.data ?? []) as ImportFile[];
    const docs = (docsRes.data ?? []) as (ImportDocument & { import_file_id: string | null })[];
    const costs = (costsRes.data ?? []) as ImportCostLine[];

    setBundles(files.map(file => ({
      file,
      documents: docs.filter(d => d.import_file_id === file.id),
      costLines: costs.filter(c => c.import_file_id === file.id),
      otherOrders: (allLinksRes.data ?? [])
        .filter(l => l.import_file_id === file.id && l.order_id !== orderId)
        .map(l => {
          const o = l.orders as unknown as { id: string; order_number: string | null } | null;
          return o ? { id: o.id, order_number: o.order_number } : null;
        })
        .filter((o): o is { id: string; order_number: string | null } => o !== null),
    })));

    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Set when the person picked "add to this dossier"; null means group the
  // files by the file number in their names.
  const dossierUploadTarget = useRef<string | null>(null);

  /**
   * Take whatever was dropped and file it. The dossier is found or created
   * from the file number shared by the names, so a drop is the whole
   * interaction — no dialog, nothing to fill in.
   */
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    const target = dossierUploadTarget.current;
    dossierUploadTarget.current = null;

    // "Add to this dossier" skips the guessing — the person already said which.
    if (target) {
      let ok = 0;
      const failed: string[] = [];
      for (const file of files) {
        const res = await uploadImportDocument({
          file,
          importFileId: target,
          subtype: guessSubtype(file.name),
          documentNumber: guessDocumentNumber(file.name) || null,
          supplierId,
          orderId,
        });
        if (res.error) failed.push(`${file.name}: ${res.error}`);
        else ok += 1;
      }
      setUploading(false);
      if (failed.length > 0) {
        toast.warning(`${ok} נוספו, ${failed.length} נכשלו.`, { description: failed.join("\n"), duration: 12000 });
      } else {
        toast.success(`${ok} ${ok === 1 ? "מסמך נוסף" : "מסמכים נוספו"} לתיק`);
      }
      fetchData();
      return;
    }

    const result = await attachImportDocumentBatch({
      files,
      orderId,
      supplierId,
      supplierName,
      orderNumber,
    });

    setUploading(false);

    if (result.error) {
      toast.error(`ההעלאה נכשלה: ${result.error}`);
      return;
    }

    const where = result.joinedExisting
      ? `נוספו לתיק ${result.fileNumber}`
      : `נקלטו בתיק ${result.fileNumber}`;
    if (result.failures.length > 0) {
      toast.warning(`${result.uploaded} מסמכים ${where}. ${result.failures.length} נכשלו.`, {
        description: result.failures.join("\n"),
        duration: 12000,
      });
    } else {
      toast.success(`${result.uploaded} ${result.uploaded === 1 ? "מסמך" : "מסמכים"} ${where}`);
    }

    // A dossier created from file names alone has no shipment details yet.
    // Say so once rather than blocking the upload behind a form.
    if (!result.joinedExisting) {
      setExpanded(prev => new Set(prev).add(result.importFileId!));
    }

    fetchData();
  }, [orderId, supplierId, supplierName, orderNumber, uploading, fetchData]);

  // Drag the forwarder's whole set of attachments onto the section, or paste
  // them. onFiles keeps the drop as one batch, which is what lets a single
  // gesture become a single dossier.
  const { isDragging, dropProps } = useFileDropPaste(
    file => { void handleFiles([file]); },
    {
      disabled: !hasEdit || uploading,
      onFiles: files => { void handleFiles(files); },
    }
  );

  const handleUnlink = async (file: ImportFile) => {
    if (!confirm(`לנתק את תיק ${file.file_number} מההזמנה הזו? התיק עצמו והמסמכים שלו יישמרו.`)) return;
    const { error } = await supabase
      .from("import_file_orders")
      .delete()
      .eq("import_file_id", file.id)
      .eq("order_id", orderId);
    if (error) {
      toast.error(`הניתוק נכשל: ${error.message}`);
      return;
    }
    toast.success("התיק נותק מההזמנה");
    fetchData();
  };

  const handleDeleteCostLine = async (lineId: string) => {
    const { error } = await supabase.from("import_cost_lines").delete().eq("id", lineId);
    if (error) {
      toast.error(`המחיקה נכשלה: ${error.message}`);
      return;
    }
    fetchData();
  };

  if (loading) return null;

  return (
    <>
      <div
        {...(hasEdit ? dropProps : {})}
        className={cn(
          "bg-card rounded-xl border shadow-sm p-5 transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">מסמכי יבוא ({bundles.length})</h2>
          </div>
          {hasEdit && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLinkDialogOpen(true)}>
                <Link2 className="h-3.5 w-3.5 ml-1" />שייך תיק קיים
              </Button>
              <Button size="sm" onClick={() => { dossierUploadTarget.current = null; fileInputRef.current?.click(); }} disabled={uploading}>
                {uploading
                  ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                  : <Upload className="h-3.5 w-3.5 ml-1" />}
                העלה מסמכים
              </Button>
            </div>
          )}
        </div>

        {/* The whole section is the drop target; this is the empty-state
            prompt and the only thing a person has to understand. */}
        {hasEdit && bundles.length === 0 && (
          <button
            type="button"
            onClick={() => { dossierUploadTarget.current = null; fileInputRef.current?.click(); }}
            disabled={uploading}
            className={cn(
              "w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />מעלה...
              </div>
            ) : (
              <div className="space-y-2">
                <FileText className="h-7 w-7 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">גרור לכאן את מסמכי היבוא</p>
                <p className="text-xs text-muted-foreground">
                  אפשר את כל הקבצים מהמייל בבת אחת — רשימון, שטר מטען, חשבוניות.
                  <br />הם ייקלטו יחד לתיק אחד, ללא צורך למלא כלום.
                </p>
              </div>
            )}
          </button>
        )}

        {!hasEdit && bundles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            אין תיקי יבוא משויכים להזמנה זו
          </p>
        )}

        {bundles.length > 0 && (
          <div className="space-y-3">
            {bundles.map(({ file, documents, costLines, otherOrders }) => {
              const isOpen = expanded.has(file.id);
              const totals = sumImportCosts(costLines);
              const unconverted = costLines.filter(l => lineAmountIls(l) === null);
              const status = file.status as ImportFileStatus;

              return (
                <div key={file.id} className="rounded-lg border overflow-hidden">
                  {/* Header — always visible summary of the dossier. */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(file.id)}
                    className="w-full text-right p-3 hover:bg-muted/30 transition-colors flex items-start gap-3"
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                      : <ChevronLeft className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">תיק {file.file_number}</span>
                        {file.forwarder_name && (
                          <span className="text-sm text-muted-foreground">· {file.forwarder_name}</span>
                        )}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", importFileStatusColors[status] ?? "bg-muted text-muted-foreground")}>
                          {importFileStatusLabels[status] ?? file.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {shipmentModeLabels[file.shipment_mode as ShipmentMode] ?? file.shipment_mode}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {file.declaration_number && <span>רשימון {file.declaration_number}</span>}
                        {file.vessel_name && <span>{file.vessel_name}</span>}
                        {file.container_number && <span>{file.container_number}</span>}
                        {file.arrival_date && <span>הגעה {fmtDate(file.arrival_date)}</span>}
                        <span>{documents.length} מסמכים</span>
                      </div>
                      {otherOrders.length > 0 && (
                        <p className="text-xs text-accent">
                          משותף עם {otherOrders.map(o => o.order_number || o.id.slice(0, 8)).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="text-sm font-semibold text-foreground">{ils(totals.landed)}</div>
                      <div className="text-xs text-muted-foreground">עלות נחיתה</div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/10 p-4 space-y-5">
                      {hasEdit && (
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => { setEditingFile(file); setFileDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5 ml-1" />ערוך פרטי תיק
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { dossierUploadTarget.current = file.id; fileInputRef.current?.click(); }} disabled={uploading}>
                            <Upload className="h-3.5 w-3.5 ml-1" />הוסף מסמכים לתיק
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setCostTarget({ file, line: null })}>
                            <Plus className="h-3.5 w-3.5 ml-1" />שורת עלות
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleUnlink(file)}>
                            <Link2 className="h-3.5 w-3.5 ml-1" />נתק מההזמנה
                          </Button>
                        </div>
                      )}

                      {/* Documents */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">מסמכים ({documents.length})</h4>
                        {documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">עדיין לא הועלו מסמכים</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border bg-card">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(docHidden, setDocMenu)}>
                                  {DOC_COLUMN_DEFS.map(col => docVisible(col.id) ? (
                                    <th
                                      key={col.id}
                                      className="text-right p-2.5 font-semibold text-foreground"
                                      onContextMenu={colThContextMenu(col, setDocMenu)}
                                    >
                                      {col.label}
                                    </th>
                                  ) : null)}
                                  <th className="text-right p-2.5 font-semibold text-foreground w-10" />
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {documents.map(doc => {
                                  const subtype = doc.document_subtype as ImportDocSubtype | null;
                                  return (
                                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                                      {docVisible("kind") && (
                                        <td className="p-2.5">
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                                            {(subtype && importDocSubtypeLabels[subtype]) || subtype || "אחר"}
                                          </span>
                                        </td>
                                      )}
                                      {docVisible("name") && <td className="p-2.5 text-foreground">{doc.document_name || "—"}</td>}
                                      {docVisible("number") && <td className="p-2.5 text-muted-foreground">{doc.document_number || "—"}</td>}
                                      {docVisible("amount") && (
                                        <td className="p-2.5 text-foreground">
                                          {doc.total_price != null
                                            ? `${Number(doc.total_price).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ${doc.currency}`
                                            : "—"}
                                        </td>
                                      )}
                                      {docVisible("date") && <td className="p-2.5 text-muted-foreground">{fmtDate(doc.created_at)}</td>}
                                      <td className="p-2.5">
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/documents/${doc.id}`)}
                                          className="text-muted-foreground hover:text-primary transition-colors"
                                          title="פתח מסמך"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Costs */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">עלויות ({costLines.length})</h4>
                        {costLines.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">עדיין לא הוזנו שורות עלות</p>
                        ) : (
                          <>
                            <div className="overflow-x-auto rounded-lg border bg-card">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(costHidden, setCostMenu)}>
                                    {COST_COLUMN_DEFS.map(col => costVisible(col.id) ? (
                                      <th
                                        key={col.id}
                                        className="text-right p-2.5 font-semibold text-foreground"
                                        onContextMenu={colThContextMenu(col, setCostMenu)}
                                      >
                                        {col.label}
                                      </th>
                                    ) : null)}
                                    <th className="text-right p-2.5 font-semibold text-foreground w-16" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {costLines.map(line => {
                                    const converted = lineAmountIls(line);
                                    return (
                                      <tr
                                        key={line.id}
                                        className={cn(
                                          "hover:bg-muted/30 transition-colors",
                                          line.included_in_document_id && "opacity-60"
                                        )}
                                      >
                                        {costVisible("label") && <td className="p-2.5 text-foreground">{line.label}</td>}
                                        {costVisible("category") && (
                                          <td className="p-2.5 text-muted-foreground">
                                            {importCostCategoryLabels[line.category as ImportCostCategory] ?? line.category}
                                          </td>
                                        )}
                                        {costVisible("code") && <td className="p-2.5 text-muted-foreground">{line.line_code || "—"}</td>}
                                        {costVisible("amount") && (
                                          <td className="p-2.5 text-foreground whitespace-nowrap">
                                            {Number(line.amount).toLocaleString("he-IL", { maximumFractionDigits: 2 })} {line.currency}
                                          </td>
                                        )}
                                        {costVisible("ils") && (
                                          <td className="p-2.5 whitespace-nowrap">
                                            {converted !== null ? ils(converted) : (
                                              <span className="text-warning inline-flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />חסר שער
                                              </span>
                                            )}
                                          </td>
                                        )}
                                        {costVisible("flags") && (
                                          <td className="p-2.5">
                                            <div className="flex gap-1 flex-wrap">
                                              {line.is_recoverable && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent whitespace-nowrap">מתקזז</span>
                                              )}
                                              {line.included_in_document_id && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">כלול בחשבונית</span>
                                              )}
                                            </div>
                                          </td>
                                        )}
                                        <td className="p-2.5">
                                          {hasEdit && (
                                            <div className="flex gap-1">
                                              <button
                                                type="button"
                                                onClick={() => setCostTarget({ file, line })}
                                                className="text-muted-foreground hover:text-primary transition-colors"
                                                title="ערוך"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteCostLine(line.id)}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                title="מחק"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Totals. Landed cost is the number that matters
                                for pricing; the other two exist so the split
                                is visible rather than implied. */}
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">עלות נחיתה: </span>
                                <span className="font-semibold text-foreground">{ils(totals.landed)}</span>
                              </div>
                              {totals.recoverable > 0 && (
                                <div>
                                  <span className="text-muted-foreground">מתקזז (מע"מ): </span>
                                  <span className="text-foreground">{ils(totals.recoverable)}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">סה"כ תשלום: </span>
                                <span className="font-semibold text-foreground">{ils(totals.cashOut)}</span>
                              </div>
                              {totals.duplicated > 0 && (
                                <div className="text-muted-foreground">
                                  לא נספר (כלול בחשבונית מרכזת): {ils(totals.duplicated)}
                                </div>
                              )}
                              {unconverted.length > 0 && (
                                <div className="text-warning inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {unconverted.length} שורות ללא סכום בשקלים לא נכללו
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* One hidden picker for both entry points. dossierUploadTarget decides
          whether the files join a named dossier or are grouped by file name. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={IMPORT_FILE_ACCEPT}
        className="hidden"
        onChange={e => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          void handleFiles(picked);
        }}
      />

      <ImportFileDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        importFile={editingFile}
        orderId={editingFile ? null : orderId}
        defaultSupplierId={supplierId}
        defaultSupplierName={supplierName}
        onSaved={fetchData}
      />

      <LinkExistingDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        orderId={orderId}
        linkedIds={bundles.map(b => b.file.id)}
        onLinked={fetchData}
      />

      {costTarget && (
        <ImportCostLineDialog
          open={Boolean(costTarget)}
          onOpenChange={open => { if (!open) setCostTarget(null); }}
          importFileId={costTarget.file.id}
          documents={bundles.find(b => b.file.id === costTarget.file.id)?.documents ?? []}
          line={costTarget.line}
          onSaved={fetchData}
        />
      )}

      {docMenu && (
        <ColContextMenu
          menu={docMenu}
          sortField={null}
          sortDir={null}
          hiddenCols={docHidden}
          onClose={closeDocMenu}
          onHide={docHide}
          onShow={docShow}
        />
      )}

      {costMenu && (
        <ColContextMenu
          menu={costMenu}
          sortField={null}
          sortDir={null}
          hiddenCols={costHidden}
          onClose={closeCostMenu}
          onHide={costHide}
          onShow={costShow}
        />
      )}
    </>
  );
}

/**
 * Attach a dossier that already exists to this order.
 *
 * This is the path that matters when a container is shared: the first order
 * creates the dossier, and every other order in the same container links to
 * the same one rather than re-keying it.
 */
function LinkExistingDialog({
  open, onOpenChange, orderId, linkedIds, onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  linkedIds: string[];
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ImportFile[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSearch(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    let cancelled = false;

    const run = async () => {
      setSearching(true);
      let query = supabase.from("import_files").select("*").is("deleted_at", null);
      if (term) {
        query = query.or(
          [
            `file_number.ilike.%${term}%`,
            `declaration_number.ilike.%${term}%`,
            `container_number.ilike.%${term}%`,
            `bl_number.ilike.%${term}%`,
            `vessel_name.ilike.%${term}%`,
            `supplier_invoice_number.ilike.%${term}%`,
          ].join(",")
        );
      }
      const { data } = await query.order("created_at", { ascending: false }).limit(20);
      if (!cancelled) {
        setResults((data ?? []) as ImportFile[]);
        setSearching(false);
      }
    };

    // Debounce so a typed file number does not fire a query per keystroke.
    const timer = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, search]);

  const handleLink = async (file: ImportFile) => {
    setLinking(file.id);
    const { error } = await supabase.from("import_file_orders").insert({
      import_file_id: file.id,
      order_id: orderId,
      matched_by: "manual",
      match_reason: "linked manually",
    });
    setLinking(null);

    if (error) {
      toast.error(`השיוך נכשל: ${error.message}`);
      return;
    }
    await supabase.from("import_files").update({ status: "matched" }).eq("id", file.id);
    toast.success(`תיק ${file.file_number} שויך להזמנה`);
    onOpenChange(false);
    onLinked();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>שיוך תיק יבוא קיים</DialogTitle>
        </DialogHeader>

        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חפש לפי מספר תיק, רשימון, מכולה, שטר מטען או אונייה..."
          autoFocus
        />

        <div className="max-h-96 overflow-y-auto space-y-2">
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">לא נמצאו תיקים</p>
          )}
          {results.map(file => {
            const alreadyLinked = linkedIds.includes(file.id);
            return (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">
                    תיק {file.file_number}
                    {file.forwarder_name && <span className="text-sm text-muted-foreground"> · {file.forwarder_name}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {file.declaration_number && <span>רשימון {file.declaration_number}</span>}
                    {file.vessel_name && <span>{file.vessel_name}</span>}
                    {file.container_number && <span>{file.container_number}</span>}
                    {file.arrival_date && <span>הגעה {fmtDate(file.arrival_date)}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={alreadyLinked ? "ghost" : "default"}
                  disabled={alreadyLinked || linking === file.id}
                  onClick={() => handleLink(file)}
                >
                  {linking === file.id && <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />}
                  {alreadyLinked ? "כבר משויך" : "שייך"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
