import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import type { Task } from "@/contexts/AppContext";
type RecurringTask = Task;

const frequencyOptions = [
  { value: "daily", label: "יומי" },
  { value: "weekly", label: "שבועי" },
  { value: "biweekly", label: "פעמיים בשבוע" },
  { value: "monthly", label: "חודשי" },
  { value: "quarterly", label: "רבעוני (3 חודשים)" },
  { value: "biannual", label: "חצי שנתי (6 חודשים)" },
  { value: "annual", label: "שנתי" },
];

const dayOfWeekOptions = [
  { value: 0, label: "ראשון" },
  { value: 1, label: "שני" },
  { value: 2, label: "שלישי" },
  { value: 3, label: "רביעי" },
  { value: 4, label: "חמישי" },
  { value: 5, label: "שישי" },
  { value: 6, label: "שבת" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

export default function RecurringTasksPage() {
  const { profiles } = useData();
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);

  // Form state
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
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "TEMPLATE")
      .order("title");

    if (error) {
      toast.error("שגיאה בטעינת משימות חוזרות");
      return;
    }
    setTasks(data as RecurringTask[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFrequency("weekly");
    setDayOfWeek(null);
    setDayOfMonth(null);
    setDaysBefore(0);
    setTimeOfDay("09:00");
    setPriority("בינוני");
    setAssigneeId("");
    setIsActive(true);
    setEditingTask(null);
  };

  const openEdit = (task: RecurringTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setFrequency(task.frequency);
    setDayOfWeek(task.day_of_week);
    setDayOfMonth(task.day_of_month);
    setDaysBefore(task.days_before);
    setTimeOfDay(task.time_of_day || "09:00");
    setPriority(task.priority as Priority);
    setAssigneeId(task.assignee_id || "");
    setIsActive(task.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("חובה להזין כותרת");
      return;
    }

    const assignee = profiles.find(p => p.id === assigneeId);

    const taskData = {
      title: title.trim(),
      description: description.trim() || null,
      frequency,
      day_of_week: ["weekly", "biweekly"].includes(frequency) ? dayOfWeek : null,
      day_of_month: ["monthly", "quarterly", "biannual", "annual"].includes(frequency) ? dayOfMonth : null,
      days_before: daysBefore,
      time_of_day: timeOfDay,
      priority,
      assignee_id: assigneeId || null,
      assignee_name: assignee?.name || null,
      is_active: isActive,
      status: "TEMPLATE",
      is_daily: false,
    };

    if (editingTask) {
      const { error } = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", editingTask.id);

      if (error) {
        toast.error("שגיאה בעדכון המשימה");
        return;
      }
      toast.success("המשימה עודכנה");
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert(taskData);

      if (error) {
        toast.error("שגיאה ביצירת המשימה");
        return;
      }
      toast.success("המשימה נוצרה");
    }

    resetForm();
    setDialogOpen(false);
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקת המשימה");
      return;
    }
    toast.success("המשימה נמחקה");
    fetchTasks();
  };

  const toggleActive = async (task: RecurringTask) => {
    const { error } = await supabase
      .from("tasks")
      .update({ is_active: !task.is_active })
      .eq("id", task.id);

    if (error) {
      toast.error("שגיאה בעדכון הסטטוס");
      return;
    }
    fetchTasks();
  };

  const generateTaskNow = async (task: RecurringTask) => {
    const { addTask } = await import("@/contexts/AppContext").then(m => {
      // We need to use supabase directly here
      return { addTask: null };
    });
    
    // Insert task directly
    const { error } = await supabase.from("tasks").insert({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: "TODO",
      assignee_id: task.assignee_id,
      assignee_name: task.assignee_name,
      recurring_task_id: task.id,
    });

    if (error) {
      toast.error("שגיאה ביצירת המשימה");
      return;
    }
    
    toast.success(`משימה "${task.title}" נוצרה`);
  };

  const getFrequencyLabel = (freq: string) => {
    return frequencyOptions.find(f => f.value === freq)?.label || freq;
  };

  const getDayLabel = (task: RecurringTask) => {
    if (task.day_of_week !== null) {
      return dayOfWeekOptions.find(d => d.value === task.day_of_week)?.label;
    }
    if (task.day_of_month !== null) {
      return `${task.day_of_month} לחודש`;
    }
    return null;
  };

  const showDayOfWeek = ["weekly", "biweekly"].includes(frequency);
  const showDayOfMonth = ["monthly", "quarterly", "biannual", "annual"].includes(frequency);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">משימות חוזרות</h1>
          <p className="text-sm text-muted-foreground">הגדר משימות שיווצרו אוטומטית בתדירות קבועה</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-2" />משימה חוזרת חדשה</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTask ? "עריכת משימה חוזרת" : "יצירת משימה חוזרת"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>כותרת *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="תאר את המשימה..." />
              </div>

              <div className="space-y-2">
                <Label>תיאור</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="פרטים נוספים..." rows={2} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תדירות</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>עדיפות</Label>
                  <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {showDayOfWeek && (
                <div className="space-y-2">
                  <Label>יום בשבוע</Label>
                  <Select value={dayOfWeek?.toString() || ""} onValueChange={v => setDayOfWeek(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="בחר יום" /></SelectTrigger>
                    <SelectContent>
                      {dayOfWeekOptions.map(d => (
                        <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showDayOfMonth && (
                <div className="space-y-2">
                  <Label>יום בחודש</Label>
                  <Select value={dayOfMonth?.toString() || ""} onValueChange={v => setDayOfMonth(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="בחר יום" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>יצירה מראש (ימים)</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    value={daysBefore} 
                    onChange={e => setDaysBefore(parseInt(e.target.value) || 0)} 
                  />
                  <p className="text-xs text-muted-foreground">0 = באותו יום</p>
                </div>

                <div className="space-y-2">
                  <Label>שעת יצירה</Label>
                  <Input 
                    type="time" 
                    value={timeOfDay} 
                    onChange={e => setTimeOfDay(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>שיוך לעובד</Label>
              <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="בחר (אופציונלי)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא שיוך</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>משימה פעילה</Label>
              </div>

              <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">
                {editingTask ? "עדכן" : "צור משימה חוזרת"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">טוען...</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>אין משימות חוזרות עדיין</p>
            <p className="text-sm">צור משימה חוזרת ראשונה כדי להתחיל</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => (
            <Card key={task.id} className={!task.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openEdit(task)} 
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>מחיקת משימה חוזרת</AlertDialogTitle>
                          <AlertDialogDescription>האם למחוק את "{task.title}"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{getFrequencyLabel(task.frequency)}</Badge>
                  {getDayLabel(task) && <Badge variant="outline">{getDayLabel(task)}</Badge>}
                  {task.days_before > 0 && (
                    <Badge variant="outline">{task.days_before} ימים מראש</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {task.assignee_name ? `👤 ${task.assignee_name}` : "ללא שיוך"}
                  </span>
                  <span className="text-muted-foreground">🕐 {task.time_of_day?.slice(0, 5)}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={task.is_active} 
                      onCheckedChange={() => toggleActive(task)}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">
                      {task.is_active ? "פעיל" : "מושבת"}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => generateTaskNow(task)}
                    className="h-7 text-xs"
                  >
                    <Play className="h-3 w-3 ml-1" />
                    צור עכשיו
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
