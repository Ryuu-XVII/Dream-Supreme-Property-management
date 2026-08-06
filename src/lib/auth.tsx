import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  account: UserAccount | null;
  activeAccount: UserAccount | null;
  impersonatedAccount: UserAccount | null;
  startImpersonating: (user: UserAccount) => void;
  stopImpersonating: () => void;
  refreshAccount: () => Promise<UserAccount | null>;
  passwordRecovery: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export interface UserAccount {
  id: string;
  agencyId: string;
  branchId: string | null;
  fullName: string;
  email: string;
  telephone?: string | null;
  role: "principal" | "agent" | "candidate" | "admin";
  status: "active" | "suspended" | "archived";
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchAccount(nextSession: Session | null): Promise<UserAccount | null> {
  if (!nextSession) return null;

  const { data, error } = await supabase
    .from("user_account")
    .select("id, agency_id, branch_id, full_name, email, mobile, role, status")
    .eq("auth_user_id", nextSession.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    agencyId: data.agency_id,
    branchId: data.branch_id,
    fullName: data.full_name,
    email: data.email,
    telephone: data.mobile,
    role: data.role as UserAccount["role"],
    status: data.status,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [impersonatedAccount, setImpersonatedAccount] = useState<UserAccount | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeAccount = impersonatedAccount ?? account;

  const startImpersonating = (user: UserAccount) => {
    setImpersonatedAccount(user);
  };

  const stopImpersonating = () => {
    setImpersonatedAccount(null);
  };

  const refreshAccount = useCallback(async () => {
    const {
      data: { session: nextSession },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;

    const nextAccount = await fetchAccount(nextSession);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setAccount(nextAccount);
    return nextAccount;
  }, []);

  useEffect(() => {
    let active = true;

    void refreshAccount()
      .catch(() => {
        if (active) {
          setSession(null);
          setUser(null);
          setAccount(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setPasswordRecovery(false);
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void fetchAccount(nextSession)
        .then((nextAccount) => {
          if (active) setAccount(nextAccount);
        })
        .catch(() => {
          if (active) setAccount(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshAccount]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setAccount(null);
    setImpersonatedAccount(null);
    setPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        account,
        activeAccount,
        impersonatedAccount,
        startImpersonating,
        stopImpersonating,
        refreshAccount,
        passwordRecovery,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
