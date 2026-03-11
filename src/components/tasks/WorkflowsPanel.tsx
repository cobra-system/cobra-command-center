import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useData } from "@/contexts/AppContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Zap, Check, CalendarIcon, Mail, Loader2, ChevronLeft, XCircle, Plus, Trash2, GripVertical, Settings, Copy } from "lucide-react";
import { toast } from "sonner";

interface WorkflowStep {
  index: number; name: string; description: string; action: string;
  email_to?: string; note?: string; required: boolean;
}
interface WorkflowTemplate {
  id: string; name: string; description: string; steps: WorkflowStep[]; category: string;
}
interface StepLog {
  id: string; instance_id: string; step_index: number;
  completed_by: string | null; completed_at: string; notes: string | null; action_data: any;
}
interface WorkflowInstance {
  id: string; template_id: string; order_id: string | null; current_step: number;
  status: string; created_by: string | null; created_at: string; updated_at: string;
  template?: WorkflowTemplate; order?: { id: string; supplier_name: string | null; items: { name: string }[] };
  step_logs?: StepLog[];
}

const ACTION_OPTIONS = [
  { value: "upload_file", label: "העלאת קובץ" }, { value: "send_email", label: "שליחת מייל" },
  { value: "approve", label: "אישור" }, { value: "input_eta", label: "הזנת ETA" }, { value: "confirm", label: "אישור סופי" },
];

export default function WorkflowsPanel() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { updateOrder } = useData();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [stepNotes, setStepNotes] = useState("");
  const [etaDate, setEtaDate] = useState<Date>();
  const [completing, setCompleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "cancelled" | "all">("active");
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState("instances");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: tData } = await supabase.from("workflow_templates").select("*");
    if (tData) setTemplates(tData.map(t => ({ ...t, steps: t.steps as unknown as WorkflowStep[] })));
    const { data: iData } = await supabase.from("workflow_instances").select("*").order("created_at", { ascending: false });
    if (iData) {
      const enriched = await Promise.all(iData.map(async (inst) => {
        const template = tData?.find(t => t.id === inst.template_id);
        const parsedTemplate = template ? { ...template, steps: template.steps as unknown as WorkflowStep[] } : undefined;
        let order = null;
        if (inst.order_id) {
          const { data: oData } = await supabase.from("orders").select("id, supplier_name").eq("id", inst.order_id).single();
          if (oData) {
            const { data: items } = await supabase.from("order_items").select("name").eq("order_id", inst.order_id);
            order = { ...oData, items: items || [] };
          }
        }
        const { data: logs } = await supabase.from("workflow_step_logs").select("*").eq("instance_id", inst.id).order("step_index", { ascending: true });
        return { ...inst, template: parsedTemplate, order, step_logs: logs || [] } as WorkflowInstance;
      }));
      setInstances(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredInstances = instances.filter(inst => statusFilter === "all" || inst.status === statusFilter);

  const completeStep = async () => {
    if (!selectedInstance?.template) return;
    setCompleting(true);
    const idx = selectedInstance.current_step;
    const step = selectedInstance.template.steps[idx];
    await supabase.from("workflow_step_logs").insert({
      instance_id: selectedInstance.id, step_index: idx,
      completed_by: currentUser?.name || "Unknown", notes: stepNotes || null,
      action_data: step.action === "input_eta" && etaDate ? { eta: etaDate.toISOString() } : null,
    });
    if (step.action === "input_eta" && etaDate && selectedInstance.order_id) {
      await supabase.from("orders").update({ eta: etaDate.toISOString() }).eq("id", selectedInstance.order_id);
      updateOrder(selectedInstance.order_id, { eta: etaDate.toISOString() });
    }
    const isLast = idx >= selectedInstance.template.steps.length - 1;
    await supabase.from("workflow_instances").update({
      current_step: isLast ? idx : idx + 1, status: isLast ? "completed" : "active",
    }).eq("id", selectedInstance.id);
    toast.success(`שלב הושלם: ${step.name}`);
    setStepNotes(""); setEtaDate(undefined); setCompleting(false); setSelectedInstance(null); fetchData();
  };

  const cancelWorkflow = async (id: string) => {
    if (!cancelReason.trim()) return;
    setCancellingId(id);
    await supabase.from("workflow_step_logs").insert({ instance_id: id, step_index: -1, completed_by: currentUser?.name || "Unknown", notes: `ביטול: ${cancelReason}` });
    await supabase.from("workflow_instances").update({ status: "cancelled" }).eq("id", id);
    toast.success("התהליך בוטל");
    setCancellingId(null); setCancelReason(""); setSelectedInstance(null); fetchData();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("workflow_templates").delete().eq("id", id);
    toast.success("תבנית נמחקה");
    fetchData();
  };

  const duplicateTemplate = async (tpl: WorkflowTemplate) => {
    await supabase.from("workflow_templates").insert({
      name: `${tpl.name} (עותק)`,
      description: tpl.description || null,
      category: tpl.category,
      steps: tpl.steps as any,
    });
    toast.success("תבנית שוכפלה");
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="instances" className="text-xs">תהליכים פעילים</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">תבניות</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="instances" className="space-y-3 mt-3">
          <div className="flex gap-1.5">
            {(["active", "completed", "cancelled", "all"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}>
                {s === "active" ? "פעילים" : s === "completed" ? "הושלמו" : s === "cancelled" ? "בוטלו" : "הכל"}
              </button>
            ))}
          </div>

          {filteredInstances.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">אין תהליכים להצגה</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredInstances.map(inst => {
                const total = inst.template?.steps.length || 1;
                const pct = inst.status === "completed" ? 100 : Math.round((inst.current_step / total) * 100);
                return (
                  <div key={inst.id} onClick={() => { setSelectedInstance(inst); setStepNotes(""); setEtaDate(undefined); }}
                    className="bg-card rounded-xl border p-4 cursor-pointer hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{inst.order?.supplier_name || "ללא ספק"}</h4>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{inst.order?.items.map(i => i.name).join(", ") || inst.template?.name}</p>
                      </div>
                      <Badge variant={inst.status === "completed" ? "default" : inst.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
                        {inst.status === "completed" ? "הושלם" : inst.status === "cancelled" ? "בוטל" : "פעיל"}
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-1.5 mb-1.5" />
                    <p className="text-[10px] text-muted-foreground">שלב {inst.current_step + 1}/{total}</p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 ml-1" />תבנית חדשה
            </Button>
          </div>
          {templates.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">אין תבניות</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(tpl => (
                <div key={tpl.id} className="bg-card rounded-xl border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">{tpl.name}</h4>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateTemplate(tpl)} title="שכפל">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTemplate(tpl); setTemplateDialogOpen(true); }}>
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחיקת תבנית</AlertDialogTitle>
                            <AlertDialogDescription>למחוק את "{tpl.name}"?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate(tpl.id)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{tpl.description || "—"}</p>
                  <div className="space-y-0.5">
                    {tpl.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium">{i + 1}</span>
                        {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Instance detail dialog */}
      <Dialog open={!!selectedInstance} onOpenChange={(open) => !open && setSelectedInstance(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />{selectedInstance?.template?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedInstance?.order_id && (
            <button onClick={() => { setSelectedInstance(null); navigate(`/orders/${selectedInstance.order_id}`); }}
              className="flex items-center gap-1 text-sm text-primary hover:underline mb-2">
              <ChevronLeft className="h-4 w-4" />צפה בהזמנה
            </button>
          )}
          <div className="space-y-3">
            {selectedInstance?.template?.steps.map((step, idx) => {
              const done = idx < selectedInstance.current_step || selectedInstance.status === "completed";
              const current = idx === selectedInstance.current_step && selectedInstance.status === "active";
              const log = selectedInstance.step_logs?.find(l => l.step_index === idx);
              return (
                <div key={idx} className={cn("p-3 rounded-lg border", done && "bg-success/10 border-success/30", current && "bg-primary/10 border-primary", !done && !current && "bg-muted/30 border-muted")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium",
                      done && "bg-success text-success-foreground", current && "bg-primary text-primary-foreground", !done && !current && "bg-muted text-muted-foreground")}>
                      {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground">{step.name}</h4>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      {step.note && <p className="text-[10px] text-warning mt-1">💡 {step.note}</p>}
                      {done && log && (
                        <p className="text-[10px] text-muted-foreground mt-1">✓ {log.completed_by} • {format(new Date(log.completed_at), "dd/MM HH:mm", { locale: he })}</p>
                      )}
                      {current && (
                        <div className="mt-2 space-y-2">
                          {step.action === "send_email" && step.email_to && (
                            <Button size="sm" variant="outline" onClick={() => window.open(`mailto:${step.email_to}?subject=${encodeURIComponent(step.name + " - COBRA")}`, "_blank")}>
                              <Mail className="h-3.5 w-3.5 ml-1" />מייל ל-{step.email_to}
                            </Button>
                          )}
                          {step.action === "input_eta" && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm"><CalendarIcon className="h-3.5 w-3.5 ml-1" />{etaDate ? format(etaDate, "dd/MM/yyyy") : "בחר ETA"}</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={etaDate} onSelect={setEtaDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                            </Popover>
                          )}
                          <Textarea placeholder="הערות..." value={stepNotes} onChange={e => setStepNotes(e.target.value)} className="text-sm" rows={2} />
                          <Button onClick={completeStep} disabled={completing || (step.action === "input_eta" && !etaDate)} className="w-full" size="sm">
                            {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Check className="h-3.5 w-3.5 ml-1" />}השלם שלב
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedInstance?.status === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/10" size="sm">
                  <XCircle className="h-3.5 w-3.5 ml-1" />בטל תהליך
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>ביטול תהליך</AlertDialogTitle></AlertDialogHeader>
                <Textarea placeholder="סיבת ביטול..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} />
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelWorkflow(selectedInstance.id)} disabled={!cancelReason.trim()} className="bg-destructive text-destructive-foreground">אשר</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogContent>
      </Dialog>

      {/* Template dialog */}
      <TemplateFormDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} template={editingTemplate} onSaved={() => { setTemplateDialogOpen(false); fetchData(); }} />
    </div>
  );
}

function TemplateFormDialog({ open, onOpenChange, template, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; template: WorkflowTemplate | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("procurement");
  const [steps, setSteps] = useState<{ name: string; description: string; action: string; email_to: string; note: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name); setDescription(template.description || ""); setCategory(template.category || "procurement");
      setSteps(template.steps.map(s => ({ name: s.name, description: s.description, action: s.action, email_to: s.email_to || "", note: s.note || "" })));
    } else {
      setName(""); setDescription(""); setCategory("procurement");
      setSteps([{ name: "", description: "", action: "confirm", email_to: "", note: "" }]);
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    const stepsJson = steps.map((s, i) => ({ index: i, name: s.name, description: s.description, action: s.action, ...(s.email_to ? { email_to: s.email_to } : {}), ...(s.note ? { note: s.note } : {}), required: true }));
    if (template) {
      await supabase.from("workflow_templates").update({ name, description: description || null, category, steps: stepsJson }).eq("id", template.id);
    } else {
      await supabase.from("workflow_templates").insert({ name, description: description || null, category, steps: stepsJson });
    }
    setSaving(false); onSaved();
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
    setSteps(newSteps);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? "עריכת תבנית" : "תבנית חדשה"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-xs">שם</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="procurement">רכש</SelectItem><SelectItem value="logistics">לוגיסטיקה</SelectItem><SelectItem value="quality">בקרת איכות</SelectItem><SelectItem value="other">אחר</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">תיאור</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">שלבים</Label>
            <Button variant="outline" size="sm" onClick={() => setSteps([...steps, { name: "", description: "", action: "confirm", email_to: "", note: "" }])}>
              <Plus className="h-3 w-3 ml-1" />שלב
            </Button>
          </div>
          {steps.map((step, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />שלב {idx + 1}
                  <div className="flex gap-0.5 mr-2">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-xs px-1 rounded hover:bg-muted disabled:opacity-30">▲</button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="text-xs px-1 rounded hover:bg-muted disabled:opacity-30">▼</button>
                  </div>
                </span>
                {steps.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setSteps(steps.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="שם" value={step.name} onChange={e => { const u = [...steps]; u[idx].name = e.target.value; setSteps(u); }} className="text-sm" />
                <Select value={step.action} onValueChange={v => { const u = [...steps]; u[idx].action = v; setSteps(u); }}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTION_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="תיאור" value={step.description} onChange={e => { const u = [...steps]; u[idx].description = e.target.value; setSteps(u); }} className="text-sm" />
              {step.action === "send_email" && <Input placeholder="מייל" value={step.email_to} onChange={e => { const u = [...steps]; u[idx].email_to = e.target.value; setSteps(u); }} className="text-sm" dir="ltr" />}
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}{template ? "שמור" : "צור"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
