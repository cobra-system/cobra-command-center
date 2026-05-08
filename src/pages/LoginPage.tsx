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

  const handleGoogle = async () => {
    setError("");
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (oauthErr) setError(oauthErr.message);
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
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 h-11"
          onClick={handleGoogle}
        >
          <GoogleIcon className="h-4 w-4" />
          כניסה עם Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">או</span>
          </div>
        </div>

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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
