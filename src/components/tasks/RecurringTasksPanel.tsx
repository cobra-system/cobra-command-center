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
import { Plus, Pencil, Trash2, CalendarClock, Play } from "lucide-react";
import { toast } from "sonner";
import { useData, type Priority } from "@/contexts/AppContext";

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  days_before: number;
  time_of_day: string;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  is_active: boolean;
  next_due: string | null;
  last_generated: string | null;
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
  const { profiles } = useData();
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
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

  const fetchTasks = async () => {
    const { data, error } = await supabase.from("recurring_tasks").select("*").order("title");
    if (!error && data) setTasks(data as RecurringTask[]);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

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
    };
    if (editingTask) {
      const { error } = await supabase.from("recurring_tasks").update(taskData).eq("id", editingTask.id);
      if (error) { toast.error("שגיאה בעדכון"); return; }
      toast.success("המשימה עודכנה");
    } else {
      const { error } = await supabase.from("recurring_tasks").insert(taskData);
      if (error) { toast.error("שגיאה ביצירה"); return; }
      toast.success("המשימה נוצרה");
    }
    resetForm(); setDialogOpen(false); fetchTasks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("recurring_tasks").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקה: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("נמחקה");
    fetchTasks();
  };

  const toggleActive = async (task: RecurringTask) => {
    await supabase.from("recurring_tasks").update({ is_active: !task.is_active }).eq("id", task.id);
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

  if (loading) return <div className="text-center py-10 text-muted-foreground">טוען...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">משימות שנוצרות אוטומטית בתדירות קבועה</p>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 ml-1" />חוזרת חדשה</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingTask ? "עריכת משימה חוזרת" : "יצירת משימה חוזרת"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2"><Label>כותרת *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>תיאור</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
        <div className="bg-card rounded-xl border p-10 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>אין משימות חוזרות</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => (
            <div key={task.id} className={`bg-card rounded-xl border p-4 transition-opacity ${!task.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-foreground">{task.title}</h4>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => openEdit(task)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>מחיקה</AlertDialogTitle><AlertDialogDescription>למחוק "{task.title}"?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant="secondary" className="text-[10px]">{frequencyOptions.find(f => f.value === task.frequency)?.label}</Badge>
                {task.day_of_week !== null && <Badge variant="outline" className="text-[10px]">{dayOfWeekOptions.find(d => d.value === task.day_of_week)?.label}</Badge>}
                {task.day_of_month !== null && <Badge variant="outline" className="text-[10px]">{task.day_of_month} לחודש</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={task.is_active} onCheckedChange={() => toggleActive(task)} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">{task.is_active ? "פעיל" : "מושבת"}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => generateNow(task)} className="h-6 text-[10px] px-2">
                  <Play className="h-3 w-3 ml-0.5" />צור עכשיו
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
