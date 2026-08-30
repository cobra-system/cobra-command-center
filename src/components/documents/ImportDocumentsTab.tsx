/**
 * Import paperwork, kept apart from the rest of the documents module.
 *
 * A dossier's PDFs are only meaningful together — the declaration, the bill of
 * lading and the three invoices all describe one shipment — so they are listed
 * grouped by תיק rather than mixed into the flat document list, where they
 * would bury the PIs and POs by sheer volume (seven or eight files per
 * shipment).
 *
 * The rows themselves are ordinary purchase_documents, so opening one lands on
 * the same document page as everything else.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Ship, ExternalLink, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import {
  type ImportFile,
  type ImportDocument,
  type ImportDocSubtype,
  type ImportCostLine,
  type ShipmentMode,
  importDocSubtypeLabels,
  shipmentModeLabels,
  sumImportCosts,
  shippingUnitCost,
} from "@/lib/importFiles";

const COLUMN_DEFS: ColDef[] = [
  { id: "kind",   label: "סוג" },
  { id: "name",   label: "שם מסמך" },
  { id: "number", label: "מספר" },
  { id: "amount", label: "סכום" },
  { id: "date",   label: "נוסף" },
] as const;

interface DossierGroup {
  file: ImportFile;
  documents: ImportDocument[];
  costLines: ImportCostLine[];
  orders: { id: string; order_number: string | null }[];
}

const ils = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

interface Props {
  search: string;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yy");
}

export default function ImportDocumentsTab({ search }: Props) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<DossierGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const { isVisible, hide, show, hiddenCols, visibleCount } =
    useColumnVisibility("import-documents-tab:hidden-columns", COLUMN_DEFS);
  const { menu, setMenu, closeMenu } = useColMenu();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [filesRes, docsRes, costsRes, linksRes] = await Promise.all([
      supabase.from("import_files").select("*").is("deleted_at", null)
        .order("arrival_date", { ascending: false, nullsFirst: false }),
      supabase.from("purchase_documents")
        .select("id, import_file_id, document_name, document_subtype, document_number, file_url, total_price, currency, created_at")
        .not("import_file_id", "is", null)
        .order("created_at", { ascending: true }),
      supabase.from("import_cost_lines").select("*"),
      supabase.from("import_file_orders").select("import_file_id, orders(id, order_number)"),
    ]);

    const files = (filesRes.data ?? []) as ImportFile[];
    const docs = (docsRes.data ?? []) as (ImportDocument & { import_file_id: string | null })[];
    const costs = (costsRes.data ?? []) as ImportCostLine[];

    setGroups(files.map(file => ({
      file,
      documents: docs.filter(d => d.import_file_id === file.id),
      costLines: costs.filter(c => c.import_file_id === file.id),
      orders: (linksRes.data ?? [])
        .filter(l => l.import_file_id === file.id)
        .map(l => l.orders as unknown as { id: string; order_number: string | null } | null)
        .filter((o): o is { id: string; order_number: string | null } => o !== null),
    })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  // Search spans the dossier's identifiers as well as the document names — a
  // person looking for "460509" or a container number should find the group,
  // not just a file that happens to be named after it.
  const term = search.trim().toLowerCase();
  const visible = term
    ? groups.filter(g => {
        const haystack = [
          g.file.file_number, g.file.forwarder_name, g.file.declaration_number,
          g.file.container_number, g.file.bl_number, g.file.house_bl_number,
          g.file.vessel_name, g.file.supplier_name, g.file.supplier_invoice_number,
          ...g.orders.map(o => o.order_number),
          ...g.documents.map(d => d.document_name),
          ...g.documents.map(d => d.document_number),
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(term);
      })
    : groups;

  if (visible.length === 0) {
    return (
      <div className="text-center py-12">
        <Ship className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {term ? "לא נמצאו תיקי יבוא התואמים לחיפוש" : "אין עדיין תיקי יבוא"}
        </p>
        {!term && (
          <p className="text-xs text-muted-foreground mt-1">
            תיקי יבוא נוצרים בגרירת מסמכים למקטע "מסמכי יבוא" שבדף ההזמנה
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {visible.map(({ file, documents, costLines, orders }) => {
          const totals = sumImportCosts(costLines);
          const unitCost = shippingUnitCost(totals.shipping, file);
          return (
          <div key={file.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <div className="flex items-center gap-2 flex-wrap">
                <Ship className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">תיק {file.file_number}</span>
                {file.forwarder_name && (
                  <span className="text-sm text-muted-foreground">· {file.forwarder_name}</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {shipmentModeLabels[file.shipment_mode as ShipmentMode] ?? file.shipment_mode}
                </span>
                <span className="text-xs text-muted-foreground">{documents.length} מסמכים</span>
                {totals.shipping > 0 && (
                  <span className="text-sm mr-auto">
                    <span className="text-muted-foreground">עלות הובלה </span>
                    <span className="font-semibold text-foreground">{ils(totals.shipping)}</span>
                    {unitCost.headline && (
                      <span className="text-muted-foreground">
                        {" "}({ils(unitCost.headline.value)} ל-{unitCost.headline.unit})
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {file.declaration_number && <span>רשימון {file.declaration_number}</span>}
                {file.vessel_name && <span>{file.vessel_name}</span>}
                {file.container_number && <span>{file.container_number}</span>}
                {file.arrival_date && <span>הגעה {fmtDate(file.arrival_date)}</span>}
              </div>
              {orders.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {orders.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1"
                    >
                      <Package className="h-3 w-3" />
                      {o.order_number || o.id.slice(0, 8)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setMenu)}>
                    {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                      <th
                        key={col.id}
                        className="text-right p-3 font-semibold text-foreground"
                        onContextMenu={colThContextMenu(col, setMenu)}
                      >
                        {col.label}
                      </th>
                    ) : null)}
                    <th className="text-right p-3 font-semibold text-foreground w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCount + 1} className="p-4 text-center text-sm text-muted-foreground">
                        אין מסמכים בתיק זה
                      </td>
                    </tr>
                  ) : documents.map(doc => {
                    const subtype = doc.document_subtype as ImportDocSubtype | null;
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        {isVisible("kind") && (
                          <td className="p-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                              {(subtype && importDocSubtypeLabels[subtype]) || subtype || "אחר"}
                            </span>
                          </td>
                        )}
                        {isVisible("name") && <td className="p-3 text-foreground">{doc.document_name || "—"}</td>}
                        {isVisible("number") && <td className="p-3 text-muted-foreground">{doc.document_number || "—"}</td>}
                        {isVisible("amount") && (
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {doc.total_price != null
                              ? `${Number(doc.total_price).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ${doc.currency}`
                              : "—"}
                          </td>
                        )}
                        {isVisible("date") && <td className="p-3 text-muted-foreground">{fmtDate(doc.created_at)}</td>}
                        <td className="p-3">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}
      </div>

      {menu && (
        <ColContextMenu
          menu={menu}
          sortField={null}
          sortDir={null}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
        />
      )}
    </>
  );
}
