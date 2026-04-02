import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { applyMigrations } from "@/lib/applyMigrations";
import { logger } from "@/lib/logger";
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

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data as Profile | null;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(async () => {
          const profile = await fetchProfile(sess.user.id);
          setCurrentUser(profile);
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
        setCurrentUser(profile);
      }
      setAuthLoading(false);

      applyMigrations().catch((err) => logger.error("Migration failed", err));
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

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
