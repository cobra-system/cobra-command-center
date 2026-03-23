import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, Loader2, CalendarDays, ListChecks } from "lucide-react";
import MeetingFormDialog from "@/components/meetings/MeetingFormDialog";
import MeetingDetailDialog from "@/components/meetings/MeetingDetailDialog";
import type { Meeting, MeetingActionItem } from "@/components/meetings/types";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionCounts, setActionCounts] = useState<Record<string, { total: number; pending: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const fetchMeetings = async () => {
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });
    if (data) setMeetings(data as Meeting[]);
  };

  const fetchActionCounts = async () => {
    const { data } = await supabase
      .from("meeting_action_items")
      .select("meeting_id, status");
    if (data) {
      const counts: Record<string, { total: number; pending: number }> = {};
      (data as MeetingActionItem[]).forEach(item => {
        if (!counts[item.meeting_id]) counts[item.meeting_id] = { total: 0, pending: 0 };
        counts[item.meeting_id].total++;
        if (item.status === "pending") counts[item.meeting_id].pending++;
      });
      setActionCounts(counts);
    }
  };

  const refresh = async () => {
    await Promise.all([fetchMeetings(), fetchActionCounts()]);
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.trim().toLowerCase();
    return meetings.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.participants && m.participants.toLowerCase().includes(q)) ||
      (m.summary && m.summary.toLowerCase().includes(q))
    );
  }, [meetings, search]);

  // Keep selectedMeeting in sync after refresh
  useEffect(() => {
    if (selectedMeeting) {
      const updated = meetings.find(m => m.id === selectedMeeting.id);
      if (updated) setSelectedMeeting(updated);
      else setSelectedMeeting(null);
    }
  }, [meetings]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          פגישות
        </h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />פגישה חדשה
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש פגישות..."
          className="pr-10"
        />
      </div>

      {/* Meetings list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {meetings.length === 0 ? "אין פגישות עדיין. צור פגישה חדשה כדי להתחיל." : "לא נמצאו תוצאות."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(meeting => {
            const counts = actionCounts[meeting.id];
            return (
              <div
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{meeting.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
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
                      {counts && (
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {counts.total} משימות
                          {counts.pending > 0 && (
                            <span className="bg-warning/15 text-warning px-1.5 py-0.5 rounded-full text-[10px] font-medium mr-1">
                              {counts.pending} פתוחות
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {meeting.summary && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{meeting.summary}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <MeetingFormDialog open={newOpen} onOpenChange={setNewOpen} onSaved={refresh} />
      <MeetingDetailDialog meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} onRefresh={refresh} />
    </div>
  );
}
