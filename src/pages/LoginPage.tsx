import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import cobraLogo from "@/assets/cobra-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    setError("");
    if (!email || !password) {
      setError("יש למלא אימייל וסיסמה");
      return;
    }
    setLoading(true);
    const err = await loginWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError("אימייל או סיסמה שגויים");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <div className="mb-8 text-center">
        <img src={cobraLogo} alt="COBRA" className="h-20 w-auto brightness-0 invert mx-auto mb-3" />
        <p className="text-primary-foreground/70 text-sm">מערכת ניהול פנימית</p>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm">
        <div className="bg-card rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-center text-lg font-semibold text-foreground">כניסה למערכת</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">אימייל</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@cobra.co.il"
              dir="ltr"
              className="text-left"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">סיסמה</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="text-left"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? "מתחבר..." : "כניסה"}
          </Button>
        </div>
      </form>
    </div>
  );
}
