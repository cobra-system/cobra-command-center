import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AppContext";
import { useNavigate, Link } from "react-router-dom";
import cobraLogo from "@/assets/cobra-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const { loginWithEmail, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "MANAGER") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/my-tasks", { replace: true });
      }
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      setError("נא למלא אימייל וסיסמה");
      return;
    }
    setError("");
    setLoading(true);
    const err = await loginWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError("אימייל או סיסמה שגויים");
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail) return;
    setForgotSending(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setForgotSending(false);
    if (resetErr) {
      toast.error(resetErr.message);
    } else {
      toast.success("שלחנו לך קישור לאיפוס סיסמה");
      setForgotOpen(false);
      setForgotEmail("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <div className="mb-8 text-center">
        <img src={cobraLogo} alt="COBRA" className="h-20 w-auto brightness-0 invert mx-auto mb-3" />
        <p className="text-primary-foreground/70 text-sm">מערכת ניהול פנימית</p>
      </div>

      <div className="w-full max-w-sm bg-card rounded-xl p-6 shadow-xl space-y-4" dir="rtl">
        {forgotOpen ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">איפוס סיסמה</p>
            <p className="text-xs text-muted-foreground">נשלח קישור לאיפוס לכתובת המייל</p>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="text-left pr-9"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleForgot} disabled={forgotSending || !forgotEmail} className="flex-1">
                {forgotSending ? "שולח..." : "שלח קישור"}
              </Button>
              <Button variant="ghost" onClick={() => { setForgotOpen(false); setForgotEmail(""); }} disabled={forgotSending}>
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">אימייל</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                  className="text-left pr-9"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">סיסמה</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="text-left pr-9"
                  autoComplete="current-password"
                />
              </div>
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "מתחבר..." : "כניסה"}
            </Button>
          </form>
        )}

        {!forgotOpen && (
          <div className="flex items-center justify-between text-sm pt-1">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              שכחת סיסמה?
            </button>
            <span className="text-muted-foreground">
              אין לך חשבון?{" "}
              <Link to="/signup" className="font-semibold text-foreground hover:underline">
                הרשמה
              </Link>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}