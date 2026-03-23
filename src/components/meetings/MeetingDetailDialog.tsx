import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Save, Trash2, X, CalendarDays, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MeetingActionItemsList from "./MeetingActionItemsList";
import type { Meeting } from "./types";

interface Props {
  meeting: Meeting | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function MeetingDetailDialog({ meeting, onClose, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState("");

  const startEdit = () => {
    if (!meeting) return;
    setSummary(meeting.summary || "");
    setNotes(meeting.notes || "");
    setParticipants(meeting.participants || "");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!meeting) return;
    const { error } = await supabase.from("meetings").update({
      summary: summary.trim() || null,
      notes: notes.trim() || null,
      participants: participants.trim() || null,
    }).eq("id", meeting.id);
    if (error) {
      toast({ title: "שגיאה בעדכון", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "הפגישה עודכנה" });
      setEditing(false);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!meeting) return;
    const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
    if (error) {
      toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "הפגישה נמחקה" });
      onClose();
      onRefresh();
    }
  };

  return (
    <Dialog open={!!meeting} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {meeting && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg">{meeting.title}</DialogTitle>
                <div className="flex items-center gap-1">
                  {editing ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveEdit}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEdit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>מחיקת פגישה</AlertDialogTitle>
                        <AlertDialogDescription>האם למחוק את הפגישה "{meeting.title}"? פעולה זו תמחק גם את כל המשימות המשויכות.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(meeting.meeting_date).toLocaleDateString("he-IL")}
                </span>
                {meeting.participants && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {meeting.participants}
                  </span>
                )}
              </div>
            </DialogHeader>

            <Tabs defaultValue="summary" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="summary" className="flex-1">סיכום</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1">הערות</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">משימות לביצוע</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-3">
                {editing ? (
                  <>
                    <Textarea value={participants} onChange={e => setParticipants(e.target.value)} rows={2} placeholder="משתתפים..." />
                    <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={5} placeholder="סיכום הפגישה..." />
                  </>
                ) : (
                  <>
                    {meeting.summary ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.summary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">אין סיכום. לחץ על עריכה כדי להוסיף.</p>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                {editing ? (
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="הערות..." />
                ) : (
                  <>
                    {meeting.notes ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{meeting.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">אין הערות. לחץ על עריכה כדי להוסיף.</p>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="actions" className="mt-4">
                <MeetingActionItemsList meetingId={meeting.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
