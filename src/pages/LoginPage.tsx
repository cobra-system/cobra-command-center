import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import cobraLogo from "@/assets/cobra-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"manager" | "employee">("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, loginWithPin, currentUser } = useAuth();
  const navigate = useNavigate();

  // Navigate when currentUser is set after login
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "MANAGER") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/my-tasks", { replace: true });
      }
    }
  }, [currentUser, navigate]);

  const handleManagerLogin = async () => {
    setError("");
    setLoading(true);
    const err = await loginWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError("אימייל או סיסמה שגויים");
    }
    // Navigation handled by useEffect watching currentUser
  };

  const handlePinInput = async (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      setLoading(true);
      const err = await loginWithPin(newPin);
      setLoading(false);
      if (err) {
        setError("קוד שגוי");
        setTimeout(() => setPin(""), 500);
      }
      // Navigation handled by useEffect watching currentUser
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <div className="mb-8 text-center">
        <img src={cobraLogo} alt="COBRA" className="h-20 w-auto brightness-0 invert mx-auto mb-3" />
        <p className="text-primary-foreground/70 text-sm">מערכת ניהול פנימית</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex mb-6 bg-sidebar-accent rounded-lg p-1">
          <button
            onClick={() => { setMode("employee"); setError(""); }}
            className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
              mode === "employee" ? "bg-primary-foreground text-primary" : "text-primary-foreground/70"
            }`}
          >
            כניסת עובד
          </button>
          <button
            onClick={() => { setMode("manager"); setError(""); }}
            className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
              mode === "manager" ? "bg-primary-foreground text-primary" : "text-primary-foreground/70"
            }`}
          >
            כניסת מנהל
          </button>
        </div>

        {mode === "manager" ? (
          <div className="bg-card rounded-xl p-6 shadow-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">אימייל</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@cobra.io" dir="ltr" className="text-left" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">סיסמה</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManagerLogin()} placeholder="••••••••" dir="ltr" className="text-left" />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleManagerLogin} disabled={loading}>
              {loading ? "מתחבר..." : "כניסה"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-primary-foreground/90 text-center text-lg font-medium">הכנס את הקוד שלך</p>
            <div className="flex justify-center gap-3" dir="ltr">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin[i] ? "border-primary-foreground bg-primary-foreground/10 text-primary-foreground" : "border-primary-foreground/30 bg-primary-foreground/5"
                } ${error && pin.length === 4 ? "border-destructive animate-check-mark" : ""}`}>
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>
            {error && <p className="text-destructive-foreground bg-destructive/80 text-sm text-center py-2 rounded-lg">{error}</p>}
            {loading && <p className="text-primary-foreground/70 text-sm text-center">מתחבר...</p>}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto" dir="ltr">
              {["1","2","3","4","5","6","7","8","9"].map(d => (
                <button key={d} onClick={() => handlePinInput(d)} className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-2xl font-semibold hover:bg-primary-foreground/20 active:bg-primary-foreground/30 transition-all">
                  {d}
                </button>
              ))}
              <button onClick={handlePinDelete} className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-xl hover:bg-primary-foreground/20 transition-all">⌫</button>
              <button onClick={() => handlePinInput("0")} className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-2xl font-semibold hover:bg-primary-foreground/20 transition-all">0</button>
              <div className="h-16" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
