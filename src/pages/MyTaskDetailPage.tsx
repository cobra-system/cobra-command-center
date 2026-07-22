import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useData, type Priority, type TaskStatus } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, AlertOctagon, FileText, MessageSquare, Camera, Loader2, Trash2, ImageIcon, File } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface TaskDoc {
  name: string;
  url: string;
  isImage: boolean;
}

export default function MyTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTaskStatus, addTaskNote, deleteTask } = useData();
  const task = tasks.find(t => t.id === id);
  const [note, setNote] = useState(task?.notes || "");
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState<TaskDoc[]>([]);
  const [uploading, setUploading] = useState(false);

  const storagePath = `tasks/${id}`;

  const fetchDocs = async () => {
    if (!id) return;
    const { data } = await supabase.storage.from("documents").list(storagePath);
    if (data) {
      const docList = data
        .filter(f => f.name !== ".emptyFolderPlaceholder")
        .map(f => {
          const { data: urlData } = supabase.storage.from("documents").getPublicUrl(`${storagePath}/${f.name}`);
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
          return { name: f.name, url: urlData.publicUrl, isImage };
        });
      setDocs(docList);
    }
  };

  useEffect(() => { fetchDocs(); }, [id]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-task-appear">
        <p className="text-lg text-muted-foreground">משימה לא נמצאה</p>
        <Button variant="outline" onClick={() => navigate("/my-tasks")}><ArrowRight className="h-4 w-4 ml-2" />חזרה</Button>
      </div>
    );
  }

  const handleStatusChange = async (status: TaskStatus) => {
    if (status === "DONE") {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.8, x: 0.5 },
        colors: ["#22c55e", "#16a34a", "#3b82f6"],
      });
    }
    await updateTaskStatus(task.id, status);
    navigate("/my-tasks");
  };

  const handleNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await addTaskNote(task.id, note.trim());
    setSaving(false);
  };

  const handleDeleteTask = async () => {
    if (confirm("האם אתה בטוח שברצונך למחוק משימה זו? לא ניתן לשחזר פעולה זו.")) {
      try {
        await deleteTask(task.id);
        toast({ title: "✅ משימה נמחקה בהצלחה" });
        navigate("/my-tasks");
      } catch (error) {
        toast({ title: "שגיאה במחיקת משימה", description: "נסה שוב", variant: "destructive" });
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = `${storagePath}/${safeName}`;
    const { error } = await supabase.storage.from("documents").upload(filePath, file, { upsert: false });
    if (error) {
      toast({ title: "שגיאה בהעלאה", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ הקובץ הועלה" });
      await fetchDocs();
    }
    setUploading(false);
    // Reset input
    e.target.value = "";
  };

  const handleDeleteDoc = async (name: string) => {
    if (!id) return;
    const { error } = await supabase.storage.from("documents").remove([`${storagePath}/${name}`]);
    if (error) {
      toast({ title: "שגיאה במחיקה", variant: "destructive" });
    } else {
      toast({ title: "🗑️ קובץ נמחק" });
      setDocs(prev => prev.filter(d => d.name !== name));
    }
  };

  const isUrgent = task.priority === "P0";
  const isDone = task.status === "DONE";
  const isBlocked = task.status === "BLOCKED";

  return (
    <div className="px-5 py-6 pb-52 animate-task-appear">
      {/* Back button */}
      <button
        onClick={() => navigate("/my-tasks")}
        className="flex items-center gap-1.5 text-muted-foreground text-sm mb-6 active:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        <span>חזרה למשימות</span>
      </button>

      {/* Task header card */}
      <div className={`
        bg-card rounded-2xl border p-5 shadow-sm mb-4
        ${isUrgent ? "border-r-[3px] border-r-destructive" : ""}
        ${isDone ? "border-r-[3px] border-r-success" : ""}
        ${isBlocked ? "border-r-[3px] border-r-destructive/40" : ""}
      `}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-foreground leading-snug">{task.title}</h1>
          <PriorityBadge priority={task.priority as Priority} />
        </div>
        <TaskStatusBadge status={task.status as TaskStatus} />
      </div>

      {/* Description */}
      {task.description && (
        <div className="bg-card rounded-2xl border p-4 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">תיאור</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
        </div>
      )}

      {/* Documents & Photos */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">מסמכים ותמונות</span>
            {docs.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{docs.length}</span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Camera capture (mobile) */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                צלם
              </span>
            </label>
            {/* File upload */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors">
                <File className="h-3.5 w-3.5" />
                קובץ
              </span>
            </label>
          </div>
        </div>

        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">אין מסמכים מצורפים</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {docs.map(doc => (
              <div key={doc.name} className="relative rounded-xl overflow-hidden border bg-muted/20">
                {doc.isImage ? (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <img src={doc.url} alt={doc.name} className="w-full h-24 object-cover" />
                  </a>
                ) : (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3">
                    <ImageIcon className="h-6 w-6 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground truncate">{doc.name}</span>
                  </a>
                )}
                <button
                  className="absolute top-1 left-1 bg-destructive/80 text-white rounded-full p-1 hover:bg-destructive transition-colors"
                  onClick={() => handleDeleteDoc(doc.name)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">הערה</span>
        </div>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="הוסף הערה..."
          rows={3}
          className="rounded-xl border-muted bg-background/50 resize-none"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleNote}
          disabled={saving || !note.trim()}
          className="mt-2 rounded-xl"
        >
          {saving ? "שומר..." : "שמור הערה"}
        </Button>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/95 backdrop-blur-md border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2.5 z-20">
        {!isDone && (
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold bg-success hover:bg-success/90 text-success-foreground shadow-lg active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("DONE")}
          >
            <CheckCircle2 className="h-5 w-5 ml-2" />
            סיימתי! ✅
          </Button>
        )}
        {isDone && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl text-base font-medium active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("TODO")}
          >
            החזר לביצוע
          </Button>
        )}
        {!isBlocked && !isDone && (
          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl text-sm text-destructive border-destructive/20 hover:bg-destructive/5 active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("BLOCKED")}
          >
            <AlertOctagon className="h-4 w-4 ml-2" />
            חסום — צריך עזרה
          </Button>
        )}
        {isBlocked && (
          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl text-sm active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("TODO")}
          >
            החזר לביצוע
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full h-11 rounded-2xl text-sm text-destructive border-destructive/20 hover:bg-destructive/5 active:scale-[0.98] transition-all"
          onClick={handleDeleteTask}
        >
          <Trash2 className="h-4 w-4 ml-2" />
          מחק משימה
        </Button>
      </div>
    </div>
  );
}
