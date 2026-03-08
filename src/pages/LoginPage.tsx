import { useState } from "react";
import { useAuth } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"manager" | "employee">("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, loginWithPin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleManagerLogin = async () => {
    setError("");
    setLoading(true);
    const err = await loginWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError("אימייל או סיסמה שגויים");
    } else {
      navigate("/dashboard");
    }
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
      } else {
        navigate("/my-tasks");
      }
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Shield className="h-10 w-10 text-primary-foreground" />
          <h1 className="text-4xl font-black text-primary-foreground tracking-tight">COBRA.IO</h1>
        </div>
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
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">או</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={loginWithGoogle}>
              <svg className="h-5 w-5 ml-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              כניסה עם Google
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
