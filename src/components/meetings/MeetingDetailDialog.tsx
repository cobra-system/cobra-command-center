import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Save, Trash2, X, CalendarDays, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MeetingActionItemsList from "./MeetingActionItemsList";
import MeetingParticipantSelector from "./MeetingParticipantSelector";
import MeetingDocumentsList from "./MeetingDocumentsList";
import type { Meeting, MeetingParticipant, SelectedParticipant } from "./types";

import { format } from "date-fns";
interface Props {
  meeting: Meeting | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function MeetingDetailDialog({ meeting, onClose, onRefresh }: Props) {
  const { profiles, suppliers } = useData();
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [editParticipants, setEditParticipants] = useState<SelectedParticipant[]>([]);
  const [dbParticipants, setDbParticipants] = useState<MeetingParticipant[]>([]);

  const fetchParticipants = async (meetingId: string) => {
    const { data } = await supabase
      .from("meeting_participants")
      .select("*")
      .eq("meeting_id", meetingId);
    if (data) setDbParticipants(data as MeetingParticipant[]);
  };

  useEffect(() => {
    if (meeting) fetchParticipants(meeting.id);
    else setDbParticipants([]);
  }, [meeting?.id]);

  // Resolve participant labels from context data
  const resolveLabel = (p: MeetingParticipant): string => {
    if (p.participant_type === "profile") {
      return profiles.find(x => x.id === p.participant_id)?.name || p.participant_id;
    }
    if (p.participant_type === "supplier") {
      return suppliers.find(x => x.id === p.participant_id)?.company || p.participant_id;
    }
    if (p.participant_type === "supplier_contact") {
      for (const s of suppliers) {
        const contact = s.contacts?.find(c => c.id === p.participant_id);
        if (contact) return `${contact.name} (${s.company})`;
      }
      return p.participant_id;
    }
    return p.participant_id;
  };

  const startEdit = () => {
    if (!meeting) return;
    setSummary(meeting.summary || "");
    setNotes(meeting.notes || "");
    setEditParticipants(
      dbParticipants.map(p => ({
        type: p.participant_type,
        id: p.participant_id,
        label: resolveLabel(p),
      }))
    );
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!meeting) return;
    const { error } = await supabase.from("meetings").update({
      summary: summary.trim() || null,
      notes: notes.trim() || null,
    }).eq("id", meeting.id);
    if (error) {
      toast({ title: "שגיאה בעדכון", description: error.message, variant: "destructive" });
      return;
    }

    // Update participants
    const { error: delErr } = await supabase.from("meeting_participants").delete().eq("meeting_id", meeting.id);
    if (delErr) {
      toast({ title: "שגיאה בעדכון משתתפים", description: delErr.message, variant: "destructive" });
      return;
    }
    if (editParticipants.length > 0) {
      const { error: insErr } = await supabase.from("meeting_participants").insert(
        editParticipants.map(p => ({
          meeting_id: meeting.id,
          participant_type: p.type,
          participant_id: p.id,
        }))
      );
      if (insErr) {
        toast({ title: "שגיאה בהוספת משתתפים", description: insErr.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "הפגישה עודכנה" });
    setEditing(false);
    await fetchParticipants(meeting.id);
    onRefresh();
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
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto">
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
                        <AlertDialogDescription>האם למחוק את הפגישה "{meeting.title}"? פעולה זו תמחק גם את כל המשימות והמסמכים המשויכים.</AlertDialogDescription>
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
                  {new format(Date(meeting.meeting_date), "dd/MM/yyyy")}
                </span>
                {dbParticipants.length > 0 && !editing && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="flex flex-wrap gap-1">
                      {dbParticipants.map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs font-normal px-1.5 py-0">
                          {resolveLabel(p)}
                        </Badge>
                      ))}
                    </span>
                  </span>
                )}
              </div>
              {editing && (
                <div className="mt-2">
                  <MeetingParticipantSelector value={editParticipants} onChange={setEditParticipants} />
                </div>
              )}
            </DialogHeader>

            <Tabs defaultValue="summary" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="summary" className="flex-1">סיכום</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1">הערות</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">משימות לביצוע</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">מסמכים</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-3">
                {editing ? (
                  <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={5} placeholder="סיכום הפגישה..." />
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

              <TabsContent value="documents" className="mt-4">
                <MeetingDocumentsList meetingId={meeting.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
