import { Fragment, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Boxes,
  FileText,
  FlaskConical,
  Gauge,
  KeyRound,
  LogOut,
  Menu,
  Package,
  Settings as SettingsIcon,
  Sparkles,
  Terminal,
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Menu Utama",
    items: [
      { to: "/", label: "Dashboard", icon: Gauge },
      { to: "/models", label: "Models", icon: Boxes },
      { to: "/usage", label: "Usage", icon: Activity },
      { to: "/api-keys", label: "API Keys", icon: KeyRound },
      { to: "/packages", label: "API Packages", icon: Package, adminOnly: true },
      { to: "/users", label: "Clients & Access", icon: Users, adminOnly: true },
      { to: "/features", label: "Features", icon: Sparkles, adminOnly: true },
      { to: "/audit-logs", label: "Audit Log", icon: FileText, adminOnly: true },
      { to: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
    ],
  },
  {
    label: "Developer",
    items: [
      { to: "/api-tester", label: "API Tester", icon: Terminal, adminOnly: true },
      { to: "/model-tester", label: "Model Tester", icon: FlaskConical, adminOnly: true },
    ],
  },
];

export function AppLayout() {
  const { user, me, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  if (user && !user.usage_notice_acknowledged) return <Navigate to="/usage-notice" replace />;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand Logo in Sidebar */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b22db] via-[#091ea2] to-[#040e5e] text-white shadow-md shadow-primary/20">
          <Sparkles className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-foreground tracking-tight text-base">JagoBridge</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">Pro</span>
          </div>
          <p className="text-[11px] text-muted truncate">Enterprise AI Gateway</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const groupItems = group.items.filter((item) => !item.adminOnly || isAdmin(user));
          if (groupItems.length === 0) return null;
          return (
            <Fragment key={group.label}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              {groupItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </Fragment>
          );
        })}
      </nav>

      {/* Sidebar Footer User Info */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-xs font-bold uppercase shadow-sm">
              {user?.email?.slice(0, 2) ?? "JB"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || user?.email}</p>
              <p className="text-[10px] text-muted truncate">{isAdmin(user) ? "Administrator" : "Member"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block shadow-xs">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-64 border-r border-border bg-white shadow-xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-white px-5 py-3.5 sticky top-0 z-30 shadow-xs">
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
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
              </div>
              <span className="text-sm font-bold text-foreground">JagoBridge</span>
            </div>
            <span className="hidden lg:inline text-xs font-medium text-slate-500">
              Workspace &bull; {isAdmin(user) ? "Akses Administrator" : "Akses Member"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/change-password"
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Ubah Password
            </Link>
            <Button variant="secondary" size="sm" onClick={handleLogout} className="rounded-lg text-xs font-medium">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Keluar
            </Button>
          </div>
        </header>

        {me ? <QuotaBanner fiveHour={me.windows.five_hour} weekly={me.windows.weekly} /> : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
