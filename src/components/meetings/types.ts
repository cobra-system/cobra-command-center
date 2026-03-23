export interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
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

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  participant_type: "profile" | "supplier" | "supplier_contact";
  participant_id: string;
  created_at: string;
}

export interface SelectedParticipant {
  type: "profile" | "supplier" | "supplier_contact";
  id: string;
  label: string;
}

export interface MeetingDocument {
  id: string;
  meeting_id: string;
  document_name: string;
  file_url: string;
  created_by: string | null;
  created_at: string;
}
