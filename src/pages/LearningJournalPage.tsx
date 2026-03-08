import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, BookOpen, HelpCircle, CheckCircle, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  status: string;
  linked_type: string | null;
  linked_id: string | null;
  created_by: string;
  created_at: string;
}

const statusOptions = [
  { value: "למידה", label: "📚 למידה", icon: BookOpen, color: "bg-primary/15 text-primary" },
  { value: "שאלה פתוחה", label: "❓ שאלה פתוחה", icon: HelpCircle, color: "bg-warning/15 text-warning" },
  { value: "הובן", label: "✅ הובן", icon: CheckCircle, color: "bg-success/15 text-success" },
];

const linkedTypeOptions = [
  { value: "general", label: "כללי" },
  { value: "product", label: "מוצר" },
  { value: "supplier", label: "ספק" },
  { value: "procedure", label: "נוהל" },
];

export default function LearningJournalPage() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("למידה");
  const [linkedType, setLinkedType] = useState("general");

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("learning_journal")
      .select("*")
      .order("date", { ascending: false });
    if (data) setEntries(data as JournalEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const resetForm = () => {
    setTitle(""); setContent(""); setStatus("למידה"); setLinkedType("general"); setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (editingId) {
      await supabase.from("learning_journal").update({
        title: title.trim(),
        content: content.trim(),
        status,
        linked_type: linkedType === "general" ? null : linkedType,
      }).eq("id", editingId);
      toast.success("הרשומה עודכנה");
    } else {
      await supabase.from("learning_journal").insert({
        title: title.trim(),
        content: content.trim(),
        status,
        linked_type: linkedType === "general" ? null : linkedType,
        created_by: currentUser!.id,
      });
      toast.success("הרשומה נוצרה");
    }
    resetForm();
    setOpen(false);
    fetchEntries();
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setStatus(entry.status);
    setLinkedType(entry.linked_type || "general");
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("learning_journal").delete().eq("id", id);
    toast.success("הרשומה נמחקה");
    fetchEntries();
  };

  const filtered = entries.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getStatusBadge = (s: string) => {
    const opt = statusOptions.find(o => o.value === s);
    return opt ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${opt.color}`}>{opt.label}</span> : null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">יומן למידה</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />רשומה חדשה</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingId ? "עריכת רשומה" : "רשומה חדשה"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>כותרת *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה למדת?" />
              </div>
              <div className="space-y-2">
                <Label>תוכן</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="פרט..." rows={5} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>סטטוס</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>קישור ל</Label>
                  <Select value={linkedType} onValueChange={setLinkedType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{linkedTypeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">
                {editingId ? "עדכן" : "צור רשומה"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש ביומן..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex bg-secondary rounded-lg p-1">
          {[{ value: "all", label: "הכל" }, ...statusOptions.map(s => ({ value: s.value, label: s.label }))].map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-card rounded-xl border p-5 animate-pulse h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">אין רשומות ביומן</p>
          <p className="text-sm text-muted-foreground/60">התחל לתעד את הלמידה שלך</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-card rounded-xl border shadow-sm p-5 space-y-3 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(entry.status)}
                    {entry.linked_type && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {linkedTypeOptions.find(t => t.value === entry.linked_type)?.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
                  {entry.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{entry.content}</p>}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(entry.date), "dd/MM/yyyy")}
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>עריכה</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>מחיקה</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
