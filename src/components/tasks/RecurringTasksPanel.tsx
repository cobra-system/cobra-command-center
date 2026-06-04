import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarClock, Play, Zap, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRoles, type Priority } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Task } from "@/contexts/AppContext";
type RecurringTask = Task;

interface WorkflowInstance {
  id: string;
  status: string;
  current_step: number;
  template?: {
    name: string;
    steps: { name: string }[];
  };
  order?: {
    supplier_name: string | null;
    items: { name: string }[];
  };
}

const frequencyOptions = [
  { value: "daily", label: "יומי" },
  { value: "weekly", label: "שבועי" },
  { value: "biweekly", label: "פעמיים בשבוע" },
  { value: "monthly", label: "חודשי" },
  { value: "quarterly", label: "רבעוני" },
  { value: "biannual", label: "חצי שנתי" },
  { value: "annual", label: "שנתי" },
];

const dayOfWeekOptions = [
  { value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" },
  { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }, { value: 5, label: "שישי" }, { value: 6, label: "שבת" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" }, { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" }, { value: "נמוך", label: "נמוך" },
];

export default function RecurringTasksPanel() {
  const { profiles } = useRoles();
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [daysBefore, setDaysBefore] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [assigneeId, setAssigneeId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState("recurring");

  const fetchTasks = async () => {
    const { data, error } = await supabase.from("tasks").select("*").eq("status", "TEMPLATE").order("title");
    if (!error && data) setTasks(data as RecurringTask[]);
  };

  const fetchWorkflows = async () => {
    const { data, error } = await (supabase
      .from("workflow_instances" as any)
      .select("*")
      .order("created_at", { ascending: false })) as { data: any[] | null; error: any };
    if (!error && data) {
      const instances = data.map((i: any) => ({
        ...i,
        template: { name: i.template_id || "תהליך", steps: [] }
      } as unknown as WorkflowInstance));
      setWorkflows(instances);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.all([fetchTasks(), fetchWorkflows()]);
  }, []);

  const resetForm = () => {
    setTitle(""); setDescription(""); setFrequency("weekly"); setDayOfWeek(null);
    setDayOfMonth(null); setDaysBefore(0); setTimeOfDay("09:00"); setPriority("בינוני");
    setAssigneeId(""); setIsActive(true); setEditingTask(null);
  };

  const openEdit = (task: RecurringTask) => {
    setEditingTask(task); setTitle(task.title); setDescription(task.description || "");
    setFrequency(task.frequency); setDayOfWeek(task.day_of_week); setDayOfMonth(task.day_of_month);
    setDaysBefore(task.days_before); setTimeOfDay(task.time_of_day || "09:00");
    setPriority(task.priority as Priority); setAssigneeId(task.assignee_id || "");
    setIsActive(task.is_active); setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const assignee = profiles.find(p => p.id === assigneeId);
    const taskData = {
      title: title.trim(), description: description.trim() || null, frequency,
      day_of_week: ["weekly", "biweekly"].includes(frequency) ? dayOfWeek : null,
      day_of_month: ["monthly", "quarterly", "biannual", "annual"].includes(frequency) ? dayOfMonth : null,
      days_before: daysBefore, time_of_day: timeOfDay, priority,
      assignee_id: assigneeId || null, assignee_name: assignee?.name || null, is_active: isActive,
      status: "TEMPLATE", is_daily: false,
    };
    if (editingTask) {
      const { error } = await supabase.from("tasks").update(taskData).eq("id", editingTask.id);
      if (error) { toast.error("שגיאה בעדכון"); return; }
      toast.success("המשימה עודכנה");
    } else {
      const { error } = await supabase.from("tasks").insert(taskData);
      if (error) { toast.error("שגיאה ביצירה"); return; }
      toast.success("המשימה נוצרה");
    }
    resetForm(); setDialogOpen(false); fetchTasks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקה: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("נמחקה");
    fetchTasks();
  };

  const toggleActive = async (task: RecurringTask) => {
    const { error } = await supabase.from("tasks").update({ is_active: !task.is_active }).eq("id", task.id);
    if (error) toast.error("שגיאה בעדכון: " + error.message);
    fetchTasks();
  };

  const generateNow = async (task: RecurringTask) => {
    const { error } = await supabase.from("tasks").insert({
      title: task.title, description: task.description, priority: task.priority, status: "TODO",
      assignee_id: task.assignee_id, assignee_name: task.assignee_name, recurring_task_id: task.id,
    });
    if (error) toast.error("שגיאה");
    else toast.success(`"${task.title}" נוצרה`);
  };

  const showDayOfWeek = ["weekly", "biweekly"].includes(frequency);
  const showDayOfMonth = ["monthly", "quarterly", "biannual", "annual"].includes(frequency);

  if (loading) return <div className="flex justify-center items-center py-20"><span className="text-muted-foreground">טוען...</span></div>;

  const activeWorkflows = workflows.filter(w => w.status === "active");
  const completedWorkflows = workflows.filter(w => w.status === "completed");

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          ניהול חוזרות ותהליכים
        </h1>
        <p className="text-sm text-muted-foreground">משימות אוטומטיות ותהליכים שדורשים ניהול</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            משימות חוזרות
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            תהליכים
          </TabsTrigger>
        </TabsList>

        {/* Recurring Tasks Tab */}
        <TabsContent value="recurring" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="lg"><Plus className="h-4 w-4 ml-1" />משימה חוזרת חדשה</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingTask ? "עריכת משימה חוזרת" : "יצירת משימה חוזרת"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>כותרת *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>תיאור</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>תדירות</Label>
                      <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{frequencyOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>עדיפות</Label>
                      <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{priorityOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {showDayOfWeek && (
                    <div className="space-y-2">
                      <Label>יום בשבוע</Label>
                      <Select value={dayOfWeek?.toString() || ""} onValueChange={v => setDayOfWeek(parseInt(v))}>
                        <SelectTrigger><SelectValue placeholder="בחר יום" /></SelectTrigger>
                        <SelectContent>{dayOfWeekOptions.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {showDayOfMonth && (
                    <div className="space-y-2">
                      <Label>יום בחודש</Label>
                      <Select value={dayOfMonth?.toString() || ""} onValueChange={v => setDayOfMonth(parseInt(v))}>
                        <SelectTrigger><SelectValue placeholder="בחר יום" /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 28 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>יצירה מראש (ימים)</Label>
                      <Input type="number" min={0} value={daysBefore} onChange={e => setDaysBefore(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>שעת יצירה</Label>
                      <Input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>שיוך לעובד</Label>
                    <Select value={assigneeId || "none"} onValueChange={v => setAssigneeId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא</SelectItem>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Label>פעילה</Label>
                  </div>
                  <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">
                    {editingTask ? "עדכן" : "צור"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>אין משימות חוזרות עדיין</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map(task => (
                <Card key={task.id} className={!task.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(task)} className="p-1.5 rounded hover:bg-muted">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקה</AlertDialogTitle>
                              <AlertDialogDescription>למחוק "{task.title}"?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-destructive">מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {task.description && <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{frequencyOptions.find(f => f.value === task.frequency)?.label}</Badge>
                      {task.day_of_week !== null && <Badge variant="outline">{dayOfWeekOptions.find(d => d.value === task.day_of_week)?.label}</Badge>}
                      {task.day_of_month !== null && <Badge variant="outline">{task.day_of_month} לחודש</Badge>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{task.assignee_name || "ללא שיוך"}</span>
                      <span className="text-muted-foreground">🕐 {task.time_of_day?.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch checked={task.is_active} onCheckedChange={() => toggleActive(task)} className="scale-90" />
                        <span className="text-xs text-muted-foreground">{task.is_active ? "פעיל" : "מושבת"}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => generateNow(task)} className="h-7 text-xs">
                        <Play className="h-3 w-3 ml-0.5" />צור
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>אין תהליכים פעילים</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeWorkflows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    תהליכים פעילים ({activeWorkflows.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeWorkflows.map(wf => (
                      <Card key={wf.id} className="border-primary/30 bg-primary/5">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            {wf.order?.supplier_name || "תהליך"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">שלב {wf.current_step + 1} מתוך {wf.template?.steps.length || 1}</p>
                          <Badge>פעיל</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {completedWorkflows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    תהליכים הושלמו ({completedWorkflows.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {completedWorkflows.map(wf => (
                      <Card key={wf.id} className="opacity-60">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            {wf.order?.supplier_name || "תהליך"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Badge variant="secondary">הושלם</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
