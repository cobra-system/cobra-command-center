import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRight, Camera, Trash2, Download } from "lucide-react";
import type { OrderRequest, OrderRequestSnapshot } from "@/contexts/types";
import { fmtNum, fmtMoney } from "./orderRequestUtils";
import { downloadCsv } from "./orderRequestExcel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, snapshots are scoped to this division. */
  division?: string;
  /** Current live requests, used for delta-vs-current comparison. */
  current: OrderRequest[];
}

type Listed = Omit<OrderRequestSnapshot, "payload">;

export function SnapshotsDialog({ open, onOpenChange, division, current }: Props) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [list, setList] = useState<Listed[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<OrderRequestSnapshot | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [capLabel, setCapLabel] = useState("");
  const [capNotes, setCapNotes] = useState("");
  const [capturing, setCapturing] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("order_request_snapshots")
      .select("id,label,division,captured_at,captured_by_name,notes,total_requests,total_required_qty,total_estimated_value")
      .order("captured_at", { ascending: false });
    if (division) query = query.eq("division", division);
    const { data, error } = await query;
    setLoading(false);
    if (error) { toast.error("שגיאה בטעינה"); return; }
    setList((data ?? []) as Listed[]);
  }, [division]);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setActive(null);
    void fetchList();
    setCapLabel(suggestLabel());
    setCapNotes("");
  }, [open, fetchList]);

  const openSnapshot = async (id: string) => {
    setActiveLoading(true);
    const { data, error } = await supabase
      .from("order_request_snapshots")
      .select("*")
      .eq("id", id)
      .single();
    setActiveLoading(false);
    if (error || !data) { toast.error("שגיאה בטעינת הצילום"); return; }
    setActive(data as unknown as OrderRequestSnapshot);
    setView("detail");
  };

  const captureNow = async () => {
    if (!capLabel.trim()) { toast.error("נא לתת שם לצילום"); return; }
    setCapturing(true);
    const { error } = await supabase.rpc("capture_order_request_snapshot", {
      p_label: capLabel.trim(),
      p_division: division ?? null,
      p_notes: capNotes.trim() || null,
    });
    setCapturing(false);
    if (error) { toast.error("שגיאה בצילום: " + error.message); return; }
    toast.success("צילום נשמר");
    setShowCapture(false);
    setCapLabel(""); setCapNotes("");
    void fetchList();
  };

  const deleteSnapshot = async (id: string) => {
    if (!confirm("למחוק את הצילום? פעולה זו אינה הפיכה.")) return;
    const { error } = await supabase.from("order_request_snapshots").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("הצילום נמחק");
    void fetchList();
  };

  const delta = useMemo(() => {
    if (!active) return null;
    const snapBy = new Map(active.payload.map(r => [r.id, r] as const));
    const currBy = new Map(current.map(r => [r.id, r] as const));
    const fulfilledSince = active.payload.filter(p => p.status === "pending" && currBy.get(p.id)?.status === "ordered").length;
    const stillPending  = active.payload.filter(p => p.status === "pending" && currBy.get(p.id)?.status === "pending").length;
    const newSince      = current.filter(c => !snapBy.has(c.id) && (!division || c.division === division)).length;
    const totalSnapQty = active.total_required_qty ?? 0;
    const totalCurrQty = current
      .filter(c => !division || c.division === division)
      .reduce((s, r) => s + (r.required_to_order ?? r.quantity ?? 0), 0);
    return { fulfilledSince, stillPending, newSince, totalSnapQty, totalCurrQty };
  }, [active, current, division]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {view === "list" ? "צילומי מצב" : `צילום: ${active?.label ?? ""}`}
            {division && <span className="text-sm font-normal text-muted-foreground">· {division}</span>}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-3 pt-2">
            {/* Capture form */}
            {showCapture ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold">צילום חדש</div>
                <div className="space-y-1.5">
                  <Label className="text-xs">שם הצילום</Label>
                  <Input value={capLabel} onChange={e => setCapLabel(e.target.value)} placeholder='למשל: "סגירת Q1 2026"' />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">הערות (אופציונלי)</Label>
                  <Textarea value={capNotes} onChange={e => setCapNotes(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowCapture(false)} disabled={capturing}>ביטול</Button>
                  <Button size="sm" onClick={captureNow} disabled={capturing || !capLabel.trim()} className="gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> {capturing ? "מצלם..." : "צלם עכשיו"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  {loading ? "טוען..." : `${list.length} צילומים`}
                </div>
                <Button size="sm" onClick={() => setShowCapture(true)} className="gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> צלם מצב נוכחי
                </Button>
              </div>
            )}

            {/* List */}
            <div className="border rounded-lg divide-y">
              {list.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">אין צילומים שמורים</div>
              ) : list.map(s => (
                <button
                  key={s.id}
                  onClick={() => openSnapshot(s.id)}
                  className="w-full text-right p-3 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(s.captured_at), "dd/MM/yyyy HH:mm")}
                      {s.captured_by_name && ` · ${s.captured_by_name}`}
                      {!division && s.division && ` · ${s.division}`}
                    </div>
                    {s.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.notes}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums shrink-0 text-left">
                    <div>{s.total_requests} בקשות</div>
                    <div>{fmtNum(s.total_required_qty)} יח׳</div>
                    {s.total_estimated_value && Number(s.total_estimated_value) > 0 && (
                      <div>{fmtMoney(Number(s.total_estimated_value))}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span title="פתח" className="text-muted-foreground"><ArrowRight className="h-4 w-4 rotate-180" /></span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "detail" && active && (
          <div className="space-y-3 pt-2">
            <Button size="sm" variant="ghost" onClick={() => { setView("list"); setActive(null); }} className="gap-1">
              <ArrowRight className="h-3 w-3" /> חזור לרשימה
            </Button>

            <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{active.label}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(active.captured_at), "dd/MM/yyyy HH:mm")}
                </div>
              </div>
              {active.notes && <div className="text-xs text-muted-foreground">{active.notes}</div>}
              <div className="text-xs text-muted-foreground">
                ע"י {active.captured_by_name ?? "—"} · {active.total_requests} בקשות · סה״כ נדרש: {fmtNum(active.total_required_qty)} יח׳
                {active.total_estimated_value && Number(active.total_estimated_value) > 0 && <> · ערך משוער: {fmtMoney(Number(active.total_estimated_value))}</>}
              </div>
            </div>

            {/* Delta vs current */}
            {delta && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-muted-foreground">מומשו מאז</div>
                  <div className="text-lg font-semibold text-green-700">{delta.fulfilledSince}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-muted-foreground">עדיין ממתינות</div>
                  <div className="text-lg font-semibold text-amber-700">{delta.stillPending}</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-[11px] text-muted-foreground">חדשות מאז</div>
                  <div className="text-lg font-semibold text-blue-700">{delta.newSince}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">{active.payload.length} שורות בצילום</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => downloadCsv(active.payload, `snapshot-${active.label}-${format(new Date(active.captured_at), "yyyy-MM-dd")}.csv`)}
                >
                  <Download className="h-3.5 w-3.5" /> ייצוא לאקסל
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs text-red-600"
                  onClick={() => deleteSnapshot(active.id).then(() => { setView("list"); setActive(null); })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> מחק
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="border-b">
                      <th className="text-right p-2 font-semibold">פריט</th>
                      <th className="text-right p-2 font-semibold">חטיבה</th>
                      <th className="text-right p-2 font-semibold">נדרש</th>
                      <th className="text-right p-2 font-semibold">סטטוס בצילום</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {active.payload.map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-2 truncate max-w-[200px]">{r.product_name}</td>
                        <td className="p-2 text-muted-foreground">{r.division}</td>
                        <td className="p-2 tabular-nums">{fmtNum(r.required_to_order ?? r.quantity)}</td>
                        <td className="p-2">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {activeLoading && <div className="text-center text-sm text-muted-foreground">טוען...</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function suggestLabel(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `סגירת Q${q} ${d.getFullYear()}`;
}
