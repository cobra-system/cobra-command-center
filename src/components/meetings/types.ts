export interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  participants: string | null;
  summary: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  content: string;
  assignee_id: string | null;
  status: "pending" | "done";
  due_date: string | null;
  created_at: string;
}
