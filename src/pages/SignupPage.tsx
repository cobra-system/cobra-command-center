import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import cobraLogo from "@/assets/cobra-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Mail, User, Briefcase, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("יש למלא שם ואימייל");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/request-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          requestedRole: requestedRole.trim() || null,
          message: message.trim() || null,
          provider: "email",
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "שגיאה בשליחת הבקשה");
      } else {
        setDone(true);
      }
    } catch {
      setError("שגיאה בחיבור לשרת");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <div className="mb-8 text-center">
        <img src={cobraLogo} alt="COBRA" className="h-20 w-auto brightness-0 invert mx-auto mb-3" />
        <p className="text-primary-foreground/70 text-sm">בקשת הרשמה למערכת</p>
      </div>

      {done ? (
        <div className="w-full max-w-sm bg-card rounded-xl p-6 shadow-xl text-center space-y-4" dir="rtl">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">הבקשה נשלחה</h2>
          <p className="text-sm text-muted-foreground">
            הבקשה שלך התקבלה. מנהל המערכת יבדוק אותה ויעדכן אותך במייל לאחר האישור והגדרת התפקיד.
          </p>
          <Button onClick={() => navigate("/login")} className="w-full">
            חזרה לעמוד הכניסה
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-card rounded-xl p-6 shadow-xl space-y-4"
          dir="rtl"
        >
          <div>
            <Label className="mb-1.5 block">שם מלא</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ישראל ישראלי"
                className="pr-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">אימייל</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="text-left pr-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">תפקיד / מחלקה (אופציונלי)</Label>
            <div className="relative">
              <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={requestedRole}
                onChange={e => setRequestedRole(e.target.value)}
                placeholder="למשל: לוגיסטיקה, נהג, אגף בונד..."
                className="pr-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">הודעה למנהל (אופציונלי)</Label>
            <div className="relative">
              <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="ספר בקצרה למה אתה צריך גישה למערכת..."
                rows={3}
                className="pr-9"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? "שולח..." : "שלח בקשה"}
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-2">
            הרשמה אינה אוטומטית — הבקשה נשלחת לאישור מנהל המערכת.
          </p>

          <div className="text-sm text-center pt-1">
            <Link to="/login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              חזרה לכניסה
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
