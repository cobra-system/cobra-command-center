import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { msalInstance, loginRequest, getAccessToken } from "@/lib/msalConfig";
import { toast } from "sonner";

interface OutlookContextType {
  isConnected: boolean;
  accountName: string | null;
  login: () => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const OutlookContext = createContext<OutlookContextType | null>(null);

export function useOutlook() {
  const ctx = useContext(OutlookContext);
  if (!ctx) throw new Error("useOutlook must be within OutlookProvider");
  return ctx;
}

export function OutlookProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    msalInstance.initialize().then(() => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        setIsConnected(true);
        setAccountName(accounts[0].name || accounts[0].username);
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async () => {
    try {
      await msalInstance.initialize();
      const result = await msalInstance.loginPopup(loginRequest);
      if (result.account) {
        setIsConnected(true);
        setAccountName(result.account.name || result.account.username);
        toast.success("התחברת ל-Outlook בהצלחה");
      }
    } catch (err: any) {
      if (err.errorCode !== "user_cancelled") {
        toast.error("שגיאה בהתחברות ל-Outlook");
        console.error("MSAL login error:", err);
      }
    }
  }, []);

  const logout = useCallback(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.logoutPopup({ account: accounts[0] });
    }
    setIsConnected(false);
    setAccountName(null);
    toast.success("נותקת מ-Outlook");
  }, []);

  return (
    <OutlookContext.Provider value={{ isConnected, accountName, login, logout, loading }}>
      {children}
    </OutlookContext.Provider>
  );
}
