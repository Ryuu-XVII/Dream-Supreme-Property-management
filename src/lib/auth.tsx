import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  account: null,
  activeAccount: null,
  impersonatedAccount: null,
  startImpersonating: () => {},
  stopImpersonating: () => {},
  loading: true,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [impersonatedAccount, setImpersonatedAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const activeAccount = impersonatedAccount ?? account;

  const startImpersonating = (user: UserAccount) => {
    setImpersonatedAccount(user);
  };

  const stopImpersonating = () => {
    setImpersonatedAccount(null);
  };

  useEffect(() => {
    let active = true;

    const loadAccount = async (nextSession: Session | null) => {
      if (!nextSession) {
        if (active) setAccount(null);
        return;
      }

      const { data, error } = await supabase
        .from("user_account")
        .select("id, agency_id, branch_id, full_name, email, mobile, role, status")
        .eq("auth_user_id", nextSession.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!active) return;
      setAccount(
        data
          ? {
              id: data.id,
              agencyId: data.agency_id,
              branchId: data.branch_id,
              fullName: data.full_name,
              email: data.email,
              telephone: data.mobile,
              role: data.role,
              status: data.status,
            }
          : null,
      );
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      try {
        await loadAccount(session);
      } finally {
        if (active) setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      void loadAccount(session).finally(() => active && setLoading(false));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setAccount(null);
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
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
