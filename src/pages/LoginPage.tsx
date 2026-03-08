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
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleManagerLogin = () => {
    setError("");
    if (login(email, password)) {
      navigate("/dashboard");
    } else {
      setError("אימייל או סיסמה שגויים");
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      if (login(newPin)) {
        navigate("/my-tasks");
      } else {
        setError("קוד שגוי");
        setTimeout(() => setPin(""), 500);
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
        {/* Mode tabs */}
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
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@cobra.io"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">סיסמה</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManagerLogin()}
                placeholder="••••••••"
                dir="ltr"
                className="text-left"
              />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleManagerLogin}>
              כניסה
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-primary-foreground/90 text-center text-lg font-medium">הכנס את הקוד שלך</p>

            {/* PIN display */}
            <div className="flex justify-center gap-3" dir="ltr">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                    pin[i]
                      ? "border-primary-foreground bg-primary-foreground/10 text-primary-foreground"
                      : "border-primary-foreground/30 bg-primary-foreground/5"
                  } ${error && pin.length === 4 ? "border-destructive animate-check-mark" : ""}`}
                >
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>

            {error && <p className="text-destructive-foreground bg-destructive/80 text-sm text-center py-2 rounded-lg">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto" dir="ltr">
              {["1","2","3","4","5","6","7","8","9"].map(d => (
                <button
                  key={d}
                  onClick={() => handlePinInput(d)}
                  className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-2xl font-semibold hover:bg-primary-foreground/20 active:bg-primary-foreground/30 transition-all"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={handlePinDelete}
                className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-xl hover:bg-primary-foreground/20 transition-all"
              >
                ⌫
              </button>
              <button
                onClick={() => handlePinInput("0")}
                className="h-16 rounded-xl bg-primary-foreground/10 text-primary-foreground text-2xl font-semibold hover:bg-primary-foreground/20 transition-all"
              >
                0
              </button>
              <div className="h-16" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
