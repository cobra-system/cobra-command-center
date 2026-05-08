import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { applyMigrations } from "@/lib/applyMigrations";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import type { Profile, AuthState } from "@/contexts/types";

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const queuedRequestForUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data as Profile | null;
  }, []);

  /**
   * If a user signs in via OAuth (Google) but has no profile, they are not yet
   * approved. We queue a signup_request on their behalf and sign them out so
   * they cannot enter the system before a manager approves them.
   */
  const handleUnapprovedSession = useCallback(async (sess: Session) => {
    if (queuedRequestForUserId.current === sess.user.id) return;
    queuedRequestForUserId.current = sess.user.id;
    const provider = (sess.user.app_metadata?.provider as string | undefined) ?? "email";
    const meta = sess.user.user_metadata ?? {};
    const name = (meta.full_name || meta.name || sess.user.email?.split("@")[0] || "משתמש חדש") as string;
    const email = sess.user.email;
    if (!email) {
      await supabase.auth.signOut();
      return;
    }
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/request-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name, email, provider, requestedRole: null, message: null }),
      });
    } catch (err) {
      logger.error("Failed to queue signup request", err);
    }
    await supabase.auth.signOut();
    toast.info("הבקשה שלך נשלחה לאישור מנהל המערכת. תקבל מייל לאחר האישור.", { duration: 8000 });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(async () => {
          const profile = await fetchProfile(sess.user.id);
          if (!profile) {
            await handleUnapprovedSession(sess);
            setCurrentUser(null);
          } else {
            setCurrentUser(profile);
          }
          setAuthLoading(false);
        }, 0);
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        const profile = await fetchProfile(sess.user.id);
        if (!profile) {
          await handleUnapprovedSession(sess);
          setCurrentUser(null);
        } else {
          setCurrentUser(profile);
        }
      }
      setAuthLoading(false);

      applyMigrations().catch((err) => logger.error("Migration failed", err));
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, handleUnapprovedSession]);

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, session, loading: authLoading, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
