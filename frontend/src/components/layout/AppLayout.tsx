import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Boxes,
  FileText,
  Gauge,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { isAdmin } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { QuotaBanner } from "./QuotaBanner";
import { Button } from "../ui/Button";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/models", label: "Models", icon: Boxes },
  { to: "/usage", label: "Usage", icon: Activity },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/access-profiles", label: "Access Profiles", icon: Layers, adminOnly: true },
  { to: "/features", label: "Features", icon: Sparkles, adminOnly: true },
  { to: "/audit-logs", label: "Audit Log", icon: FileText, adminOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
];

export function AppLayout() {
  const { user, me, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  if (user && !user.usage_notice_acknowledged) return <Navigate to="/usage-notice" replace />;

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin(user));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-blue-50 text-primary" : "text-foreground hover:bg-surface",
            )
          }
        >
          <item.icon className="h-4 w-4" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-white lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-60 border-r border-border bg-white">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <div>
              <p className="text-sm font-semibold text-foreground">JagoBridge</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">
              {isAdmin(user) ? "Administrator" : "Member"}
            </span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </header>

        {me ? <QuotaBanner fiveHour={me.windows.five_hour} weekly={me.windows.weekly} /> : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
