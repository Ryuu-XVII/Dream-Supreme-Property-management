import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/types";
import { useAuth } from "@/lib/auth";

type Theme = "light" | "dark" | "system";

export interface CalculatorContext {
  tab?: "commission" | "bond" | "transfer";
  payload?: any;
}

interface AppState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
  role: Role;
  setRole: (r: Role) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  calculatorOpen: boolean;
  calculatorContext: CalculatorContext | null;
  toggleCalculator: (open?: boolean, context?: CalculatorContext | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { activeAccount } = useAuth();
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [role, setRoleState] = useState<Role>("Admin");
  const [sidebarCollapsed, setCollapsed] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorContext, setCalculatorContext] = useState<CalculatorContext | null>(null);

  useEffect(() => {
    const t = (localStorage.getItem("dsp-theme") as Theme) || "dark";
    setThemeState(t);
    setCollapsed(localStorage.getItem("dsp-sidebar") === "1");
  }, []);

  useEffect(() => {
    if (!activeAccount) return;
    const roleMap: Record<typeof activeAccount.role, Role> = {
      agent: "Agent",
      admin: "Admin",
    };
    setRoleState(roleMap[activeAccount.role] || "Agent");
  }, [activeAccount]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const next = theme === "system" ? (mql.matches ? "dark" : "light") : theme;
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("dsp-theme", t);
  };
  const setRole = (r: Role) => {
    // Kept for API compatibility with existing components. The authenticated
    // database profile remains the source of truth for authorization.
    if (!activeAccount) setRoleState(r);
  };
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dsp-sidebar", sidebarCollapsed ? "1" : "0");
    }
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setCollapsed((prev) => !prev);

  const toggleCalculator = (open?: boolean, context?: CalculatorContext | null) => {
    setCalculatorOpen((o) => open ?? !o);
    if (context !== undefined) {
      setCalculatorContext(context);
    }
  };

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme,
        resolved,
        role,
        setRole,
        sidebarCollapsed,
        toggleSidebar,
        calculatorOpen,
        calculatorContext,
        toggleCalculator,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}

export const permissions: Record<Role, string[]> = {
  Agent: ["view.own", "reports.all"],
  Admin: ["view.all", "commission.approve", "settings.manage", "users.manage", "reports.all"],
};

export function useCan(perm: string) {
  const { role } = useApp();
  return permissions[role].includes(perm);
}
