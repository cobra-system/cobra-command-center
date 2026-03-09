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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Zap, Check, Circle, CalendarIcon, Mail, Loader2, ChevronLeft, XCircle, Plus, Trash2, GripVertical, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface WorkflowStep {
  index: number;
  name: string;
  description: string;
  action: string;
  email_to?: string;
  note?: string;
  required: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  category: string;
}

interface StepLog {
  id: string;
  instance_id: string;
  step_index: number;
  completed_by: string | null;
  completed_at: string;
  notes: string | null;
  action_data: any;
}

interface WorkflowInstance {
  id: string;
  template_id: string;
  order_id: string | null;
  current_step: number;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  template?: WorkflowTemplate;
  order?: {
    id: string;
    supplier_name: string | null;
    items: { name: string }[];
  };
  step_logs?: StepLog[];
}

export default function WorkflowsPage() {
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
  const [activeTab, setActiveTab] = useState("instances");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch templates
    const { data: tData } = await supabase
      .from("workflow_templates")
      .select("*");
    if (tData) setTemplates(tData.map(t => ({ ...t, steps: t.steps as unknown as WorkflowStep[] })));
    
    // Fetch instances with order info
    const { data: iData } = await supabase
      .from("workflow_instances")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (iData) {
      // Fetch orders and step logs for each instance
      const enriched = await Promise.all(iData.map(async (inst) => {
        const template = tData?.find(t => t.id === inst.template_id);
        const parsedTemplate = template ? { ...template, steps: template.steps as unknown as WorkflowStep[] } : undefined;
        
        let order = null;
        if (inst.order_id) {
          const { data: oData } = await supabase
            .from("orders")
            .select("id, supplier_name")
            .eq("id", inst.order_id)
            .single();
          
          if (oData) {
            const { data: items } = await supabase
              .from("order_items")
              .select("name")
              .eq("order_id", inst.order_id);
            order = { ...oData, items: items || [] };
          }
        }

        const { data: logs } = await supabase
          .from("workflow_step_logs")
          .select("*")
          .eq("instance_id", inst.id)
          .order("step_index", { ascending: true });

        return { ...inst, template: parsedTemplate, order, step_logs: logs || [] } as WorkflowInstance;
      }));
      setInstances(enriched);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredInstances = instances.filter(inst => {
    if (statusFilter === "all") return true;
    return inst.status === statusFilter;
  });

  const openInstance = async (inst: WorkflowInstance) => {
    setSelectedInstance(inst);
    setStepNotes("");
    setEtaDate(undefined);
  };

  const completeStep = async () => {
    if (!selectedInstance || !selectedInstance.template) return;
    
    setCompleting(true);
    const currentStepIndex = selectedInstance.current_step;
    const step = selectedInstance.template.steps[currentStepIndex];
    
    // Insert step log
    const { error: logError } = await supabase
      .from("workflow_step_logs")
      .insert({
        instance_id: selectedInstance.id,
        step_index: currentStepIndex,
        completed_by: currentUser?.name || "Unknown",
        notes: stepNotes || null,
        action_data: step.action === "input_eta" && etaDate ? { eta: etaDate.toISOString() } : null
      });

    if (logError) {
      toast({ title: "שגיאה", description: "לא ניתן להשלים את השלב", variant: "destructive" });
      setCompleting(false);
      return;
    }

    // Update ETA on linked order if applicable
    if (step.action === "input_eta" && etaDate && selectedInstance.order_id) {
      await supabase
        .from("orders")
        .update({ eta: etaDate.toISOString() })
        .eq("id", selectedInstance.order_id);
      updateOrder(selectedInstance.order_id, { eta: etaDate.toISOString() });
    }

    const isLastStep = currentStepIndex >= selectedInstance.template.steps.length - 1;
    
    // Update instance
    const { error: updateError } = await supabase
      .from("workflow_instances")
      .update({
        current_step: isLastStep ? currentStepIndex : currentStepIndex + 1,
        status: isLastStep ? "completed" : "active"
      })
      .eq("id", selectedInstance.id);

    if (updateError) {
      toast({ title: "שגיאה", description: "לא ניתן לעדכן את התהליך", variant: "destructive" });
      setCompleting(false);
      return;
    }

    toast({ title: "✅ שלב הושלם", description: step.name });
    setStepNotes("");
    setEtaDate(undefined);
    setCompleting(false);
    setSelectedInstance(null);
    fetchData();
  };

  const sendEmail = (email: string, stepName: string) => {
    const subject = encodeURIComponent(`${stepName} - COBRA`);
    window.open(`mailto:${email}?subject=${subject}`, "_blank");
  };

  const cancelWorkflow = async (instanceId: string) => {
    if (!cancelReason.trim()) {
      toast({ title: "נא להזין סיבת ביטול", variant: "destructive" });
      return;
    }
    
    setCancellingId(instanceId);
    
    // Insert cancellation log
    await supabase.from("workflow_step_logs").insert({
      instance_id: instanceId,
      step_index: -1,
      completed_by: currentUser?.name || "Unknown",
      notes: `ביטול: ${cancelReason}`
    });

    // Update instance status
    const { error } = await supabase
      .from("workflow_instances")
      .update({ status: "cancelled" })
      .eq("id", instanceId);

    if (error) {
      toast({ title: "שגיאה בביטול התהליך", variant: "destructive" });
    } else {
      toast({ title: "❌ התהליך בוטל", description: cancelReason });
    }

    setCancellingId(null);
    setCancelReason("");
    setSelectedInstance(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          תהליכים
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="instances">תהליכים פעילים</TabsTrigger>
          <TabsTrigger value="templates">תבניות</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4 mt-4">

      {/* Status filter */}
      <div className="flex gap-2">
        {(["active", "completed", "cancelled", "all"] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              statusFilter === status 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {status === "active" ? "פעילים" : status === "completed" ? "הושלמו" : status === "cancelled" ? "בוטלו" : "הכל"}
          </button>
        ))}
      </div>

      {/* Instances list */}
      {filteredInstances.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground">
          {statusFilter === "active" 
            ? "אין תהליכים פעילים. הפעל תהליך מעמוד ההזמנות."
            : "אין תהליכים להצגה."
          }
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstances.map(inst => {
            const totalSteps = inst.template?.steps.length || 1;
            const progress = inst.status === "completed" 
              ? 100 
              : Math.round((inst.current_step / totalSteps) * 100);
            const currentStep = inst.template?.steps[inst.current_step];
            
            return (
              <div
                key={inst.id}
                onClick={() => openInstance(inst)}
                className="bg-card rounded-xl border p-5 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {inst.order?.supplier_name || "ללא ספק"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {inst.order?.items.map(i => i.name).join(", ") || inst.template?.name}
                    </p>
                  </div>
                  <Badge variant={inst.status === "completed" ? "default" : inst.status === "cancelled" ? "destructive" : "secondary"}>
                    {inst.status === "completed" ? "הושלם" : inst.status === "cancelled" ? "בוטל" : "פעיל"}
                  </Badge>
                </div>

                <Progress value={progress} className="h-2 mb-2" />
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    שלב {inst.current_step + 1} מתוך {totalSteps}
                  </span>
                  {currentStep && inst.status === "active" && (
                    <span className="text-primary font-medium truncate max-w-[120px]">
                      {currentStep.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instance detail dialog */}
      <Dialog open={!!selectedInstance} onOpenChange={(open) => !open && setSelectedInstance(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {selectedInstance?.template?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedInstance?.order_id && (
            <button
              onClick={() => {
                setSelectedInstance(null);
                navigate(`/orders/${selectedInstance.order_id}`);
              }}
              className="flex items-center gap-1 text-sm text-primary hover:underline mb-2"
            >
              <ChevronLeft className="h-4 w-4" />
              צפה בהזמנה
            </button>
          )}

          <div className="space-y-3">
            {selectedInstance?.template?.steps.map((step, idx) => {
              const isCompleted = idx < selectedInstance.current_step || selectedInstance.status === "completed";
              const isCurrent = idx === selectedInstance.current_step && selectedInstance.status === "active";
              const isFuture = idx > selectedInstance.current_step && selectedInstance.status === "active";
              const log = selectedInstance.step_logs?.find(l => l.step_index === idx);

              return (
                <div
                  key={idx}
                  className={cn(
                    "p-4 rounded-lg border transition-colors",
                    isCompleted && "bg-success/10 border-success/30",
                    isCurrent && "bg-primary/10 border-primary",
                    isFuture && "bg-muted/30 border-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      isCompleted && "bg-success text-success-foreground",
                      isCurrent && "bg-primary text-primary-foreground",
                      isFuture && "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">{idx + 1}</span>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{step.name}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      
                      {step.note && (
                        <p className="text-xs text-warning mt-1">💡 {step.note}</p>
                      )}

                      {/* Completed step info */}
                      {isCompleted && log && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span>✓ {log.completed_by}</span>
                          <span className="mx-1">•</span>
                          <span>{format(new Date(log.completed_at), "dd/MM HH:mm", { locale: he })}</span>
                          {log.notes && <p className="mt-1 text-foreground/70">📝 {log.notes}</p>}
                        </div>
                      )}

                      {/* Current step actions */}
                      {isCurrent && (
                        <div className="mt-3 space-y-3">
                          {/* Email action */}
                          {step.action === "send_email" && step.email_to && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendEmail(step.email_to!, step.name)}
                            >
                              <Mail className="h-4 w-4 ml-1" />
                              שלח מייל ל-{step.email_to}
                            </Button>
                          )}

                          {/* ETA input */}
                          {step.action === "input_eta" && (
                            <div className="flex items-center gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="justify-start">
                                    <CalendarIcon className="h-4 w-4 ml-1" />
                                    {etaDate ? format(etaDate, "dd/MM/yyyy") : "בחר ETA"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={etaDate}
                                    onSelect={setEtaDate}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}

                          {/* Notes */}
                          <Textarea
                            placeholder="הערות לשלב (אופציונלי)..."
                            value={stepNotes}
                            onChange={(e) => setStepNotes(e.target.value)}
                            className="text-sm"
                            rows={2}
                          />

                          {/* Complete button */}
                          <Button
                            onClick={completeStep}
                            disabled={completing || (step.action === "input_eta" && !etaDate)}
                            className="w-full"
                          >
                            {completing ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-1" />
                            ) : (
                              <Check className="h-4 w-4 ml-1" />
                            )}
                            השלם שלב
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cancel workflow button */}
          {selectedInstance?.status === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full mt-4 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <XCircle className="h-4 w-4 ml-1" />
                  בטל תהליך
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ביטול תהליך</AlertDialogTitle>
                  <AlertDialogDescription>
                    האם לבטל את התהליך? פעולה זו אינה הפיכה.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="סיבת הביטול..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="my-2"
                  rows={2}
                />
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelWorkflow(selectedInstance.id)}
                    disabled={!cancelReason.trim() || cancellingId === selectedInstance.id}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancellingId === selectedInstance.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "אשר ביטול"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
