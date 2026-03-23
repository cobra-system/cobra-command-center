import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { MeetingActionItem } from "./types";

interface Props {
  meetingId: string;
}

export default function MeetingActionItemsList({ meetingId }: Props) {
  const { profiles } = useData();
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New item form
  const [content, setContent] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("meeting_action_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });
    if (data) setItems(data as MeetingActionItem[]);
  };

  useEffect(() => {
    (async () => {
      await fetchItems();
      setLoading(false);
    })();
  }, [meetingId]);

  const profileMap = new Map(profiles.map(p => [p.id, p.name]));

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("meeting_action_items").insert({
      meeting_id: meetingId,
      content: content.trim(),
      assignee_id: assigneeId || null,
      due_date: dueDate?.toISOString().split("T")[0] || null,
    });
    if (error) {
      toast({ title: "שגיאה בהוספת משימה", description: error.message, variant: "destructive" });
    } else {
      setContent("");
      setAssigneeId("");
      setDueDate(undefined);
      await fetchItems();
    }
    setSaving(false);
  };

  const toggleStatus = async (item: MeetingActionItem) => {
    const newStatus = item.status === "done" ? "pending" : "done";
    await supabase.from("meeting_action_items").update({ status: newStatus }).eq("id", item.id);
    await fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("meeting_action_items").delete().eq("id", id);
    await fetchItems();
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {/* Items list */}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">אין משימות לביצוע</p>
      )}
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
          <Checkbox
            checked={item.status === "done"}
            onCheckedChange={() => toggleStatus(item)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${item.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {item.content}
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {item.assignee_id && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {profileMap.get(item.assignee_id) || "—"}
                </span>
              )}
              {item.due_date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(item.due_date).toLocaleDateString("he-IL")}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Add new item */}
      <div className="p-3 rounded-lg border border-dashed space-y-2">
        <div className="flex gap-2">
          <Input
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="הוסף משימה חדשה..."
            className="flex-1"
            onKeyDown={e => { if (e.key === "Enter" && content.trim()) handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} disabled={saving || !content.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex gap-2">
          <Combobox
            value={assigneeId}
            onValueChange={setAssigneeId}
            options={[{ value: "", label: "ללא שיוך" }, ...profiles.map(p => ({ value: p.id, label: p.name }))]}
            placeholder="שיוך לעובד"
            searchPlaceholder="חיפוש..."
          />
          <DateInput value={dueDate} onChange={setDueDate} placeholder="תאריך יעד" clearable />
        </div>
      </div>
    </div>
  );
}
