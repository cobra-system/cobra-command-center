import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";

const EVENT_TITLES: Record<string, string> = {
  order_request_created:  "בקשה חדשה",
  order_request_urgent:   "בקשה דחופה",
  order_request_received: "הבקשה שלך התקבלה",
  order_request_fulfilled:"הבקשה שלך הוזמנה",
  order_request_rejected: "הבקשה שלך נדחתה",
  order_request_commented:"תגובה חדשה",
};

interface QueueRow {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  recipient_division: string | null;
  event_type: string;
  payload: { request_id?: string; product_name?: string; division?: string; reject_reason?: string; comment_body?: string; comment_author?: string };
  created_at: string;
}

/**
 * Subscribes the current session to relevant rows in notification_queue and
 * surfaces them as in-app toasts. RLS already filters: managers see role=MANAGER
 * rows, division managers see their own division.
 */
export function useOrderRequestToasts() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase
      .channel("notif-toasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification_queue" },
        (msg) => {
          const row = msg.new as QueueRow;
          // Sanity gate (RLS filters, but realtime may lag):
          // targeted rows (recipient_user_id) are always relevant to the recipient;
          // managers see all role=MANAGER rows; division managers see their division.
          if (row.recipient_user_id && row.recipient_user_id !== currentUser.id) return;
          if (!row.recipient_user_id && currentUser.role !== "MANAGER"
              && row.recipient_division && row.recipient_division !== currentUser.division) return;

          const title = EVENT_TITLES[row.event_type] ?? "התראה";
          const body = row.payload.product_name
            ? `${row.payload.product_name}${row.payload.division ? ` · ${row.payload.division}` : ""}`
            : "";
          toast(title, {
            description: body || row.payload.comment_body || row.payload.reject_reason,
            action: row.payload.request_id ? {
              label: "פתח",
              onClick: () => navigate("/orders"),
            } : undefined,
          });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [currentUser, navigate]);
}
