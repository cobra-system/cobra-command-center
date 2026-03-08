import { useState, useEffect, useCallback } from "react";
import { useOutlook } from "@/contexts/OutlookContext";
import { fetchGraphApi } from "@/lib/msalConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Send, Inbox, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EmailMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  isRead: boolean;
  bodyPreview: string;
}

export default function SupplierEmailTab({ supplierEmail, supplierName }: { supplierEmail: string; supplierName: string }) {
  const { isConnected, login } = useOutlook();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const fetchEmails = useCallback(async () => {
    if (!isConnected || !supplierEmail) return;
    setLoading(true);
    try {
      // Fetch received emails from supplier
      const received = await fetchGraphApi(
        `/me/messages?$filter=from/emailAddress/address eq '${supplierEmail}'&$top=5&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,toRecipients,isRead,bodyPreview`
      );
      // Fetch sent emails to supplier
      const sent = await fetchGraphApi(
        `/me/messages?$filter=toRecipients/any(r:r/emailAddress/address eq '${supplierEmail}')&$top=5&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,toRecipients,isRead,bodyPreview`
      );
      
      const all = [...(received.value || []), ...(sent.value || [])]
        .sort((a: EmailMessage, b: EmailMessage) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
        .slice(0, 5);
      
      setEmails(all);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    }
    setLoading(false);
  }, [isConnected, supplierEmail]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await fetchGraphApi("/me/sendMail", {
        method: "POST",
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "Text", content: body },
            toRecipients: [{ emailAddress: { address: supplierEmail, name: supplierName } }],
          },
        }),
      });
      toast.success("המייל נשלח בהצלחה");
      setComposeOpen(false);
      setSubject("");
      setBody("");
      fetchEmails();
    } catch {
      toast.error("שגיאה בשליחת מייל");
    }
    setSending(false);
  };

  const isFromSupplier = (email: EmailMessage) => 
    email.from.emailAddress.address.toLowerCase() === supplierEmail.toLowerCase();

  if (!supplierEmail) {
    return <p className="text-sm text-muted-foreground py-4 text-center">לספק זה לא הוגדר אימייל</p>;
  }

  if (!isConnected) {
    return (
      <div className="text-center py-6 space-y-3">
        <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">יש להתחבר ל-Outlook כדי לצפות במיילים</p>
        <Button variant="outline" onClick={login}>
          <Mail className="h-4 w-4 ml-1" />התחבר ל-Outlook
        </Button>
      </div>
    );
  }

  if (loading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">📧 תקשורת — {supplierName}</h3>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Send className="h-3 w-3 ml-1" />✉️ שלח מייל</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>שליחת מייל ל-{supplierName}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>אל</Label>
                <Input value={supplierEmail} disabled dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>נושא</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא המייל" />
              </div>
              <div className="space-y-1">
                <Label>תוכן</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="כתוב את ההודעה..." />
              </div>
              <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="w-full">
                {sending ? "שולח..." : "שלח מייל"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין מיילים עם ספק זה</p>
      ) : (
        <div className="space-y-2">
          {emails.map(email => (
            <div key={email.id} className="border rounded-lg p-3 space-y-1 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                {isFromSupplier(email) ? (
                  <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded">
                    <Inbox className="h-3 w-3" />התקבל
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs bg-success/15 text-success px-2 py-0.5 rounded">
                    <ArrowUpRight className="h-3 w-3" />נשלח
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(email.receivedDateTime), "dd/MM/yy HH:mm")}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">{email.subject || "(ללא נושא)"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{email.bodyPreview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
