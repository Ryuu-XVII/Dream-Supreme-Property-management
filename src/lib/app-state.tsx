import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/data/mock";

type Theme = "light" | "dark" | "system";

interface AppState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
  role: Role;
  setRole: (r: Role) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [role, setRoleState] = useState<Role>("Principal");
  const [sidebarCollapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = (localStorage.getItem("dsp-theme") as Theme) || "system";
    setThemeState(t);
    const r = localStorage.getItem("dsp-role") as Role | null;
    if (r) setRoleState(r);
    setCollapsed(localStorage.getItem("dsp-sidebar") === "1");
  }, []);

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
    setRoleState(r);
    localStorage.setItem("dsp-role", r);
  };
  const toggleSidebar = () =>
    setCollapsed((c) => {
      localStorage.setItem("dsp-sidebar", c ? "0" : "1");
      return !c;
    });

  return (
    <Ctx.Provider value={{ theme, setTheme, resolved, role, setRole, sidebarCollapsed, toggleSidebar }}>
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
  Principal: ["view.all", "commission.approve", "settings.manage", "users.manage", "reports.all"],
  Agent: ["view.own", "reports.all"],
  Candidate: ["view.own"],
  Admin: ["view.all", "settings.manage", "users.manage", "reports.all"],
};

export function useCan(perm: string) {
  const { role } = useApp();
  return permissions[role].includes(perm);
}
