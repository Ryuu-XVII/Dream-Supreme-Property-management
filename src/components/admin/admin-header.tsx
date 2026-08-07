import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/app-state";
import { initials } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export function AdminHeader() {
  const navigate = useNavigate();
  const { theme, setTheme, role } = useApp();
  const { account, signOut } = useAuth();

  const me = { name: account?.fullName ?? "Admin User", role: role };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3 md:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-display text-xs font-bold text-sidebar-primary-foreground">
          AD
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme">
              {theme === "dark" ? (
                <Moon className="size-5" />
              ) : theme === "light" ? (
                <Sun className="size-5" />
              ) : (
                <Monitor className="size-5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setTheme("light")}>
              <Sun className="size-4 mr-2" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}>
              <Moon className="size-4 mr-2" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}>
              <Monitor className="size-4 mr-2" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-indigo-600 text-xs text-white">
                  {initials(me.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{me.name}</p>
              <p className="text-xs font-normal text-muted-foreground">Dream Supreme Properties</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role === "Admin" && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/">Agent Portal</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => void handleSignOut()}>
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
