import { useState, useEffect, useCallback } from "react";
import { useOutlook } from "@/contexts/OutlookContext";
import { useData } from "@/contexts/AppContext";
import { fetchGraphApi } from "@/lib/msalConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Inbox } from "lucide-react";
import { format } from "date-fns";

interface EmailMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
  bodyPreview: string;
}

export default function RecentSupplierEmails() {
  const { isConnected } = useOutlook();
  const { suppliers } = useData();
  const [emails, setEmails] = useState<(EmailMessage & { supplierCompany: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecentEmails = useCallback(async () => {
    if (!isConnected) return;
    const supplierEmails = suppliers.filter(s => s.email).map(s => ({ email: s.email!, company: s.company }));
    if (supplierEmails.length === 0) return;

    setLoading(true);
    try {
      // Fetch recent messages from the last 48 hours
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const data = await fetchGraphApi(
        `/me/messages?$filter=receivedDateTime ge ${since}&$top=50&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,bodyPreview`
      );

      const supplierEmailSet = new Map(supplierEmails.map(s => [s.email.toLowerCase(), s.company]));
      const matched = (data.value || [])
        .filter((m: EmailMessage) => supplierEmailSet.has(m.from.emailAddress.address.toLowerCase()))
        .map((m: EmailMessage) => ({
          ...m,
          supplierCompany: supplierEmailSet.get(m.from.emailAddress.address.toLowerCase()) || "",
        }))
        .slice(0, 8);

      setEmails(matched);
    } catch (err) {
      console.error("Failed to fetch recent emails:", err);
    }
    setLoading(false);
  }, [isConnected, suppliers]);

  useEffect(() => { fetchRecentEmails(); }, [fetchRecentEmails]);

  if (!isConnected) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />📬 מיילים אחרונים מספקים
        </h2>
        <p className="text-sm text-muted-foreground text-center py-4">התחבר ל-Outlook בהגדרות כדי לראות מיילים</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />📬 מיילים אחרונים מספקים
        {emails.length > 0 && (
          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">{emails.length}</span>
        )}
      </h2>
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין מיילים מספקים ב-48 שעות האחרונות</p>
      ) : (
        <div className="space-y-2">
          {emails.map(email => (
            <div key={email.id} className="flex items-start gap-3 py-2 border-b last:border-0">
              <Inbox className="h-4 w-4 text-primary mt-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-accent/15 text-accent px-2 py-0.5 rounded">{email.supplierCompany}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(email.receivedDateTime), "dd/MM HH:mm")}</span>
                </div>
                <p className="text-sm font-medium text-foreground truncate">{email.subject || "(ללא נושא)"}</p>
                <p className="text-xs text-muted-foreground truncate">{email.bodyPreview}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
