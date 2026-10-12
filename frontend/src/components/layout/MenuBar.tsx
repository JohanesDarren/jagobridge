import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { isAdmin } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Logo } from "../ui/Logo";

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/models", label: "Models" },
  { to: "/usage", label: "Usage" },
  { to: "/api-keys", label: "API Keys" },
  { to: "/packages", label: "API Packages", adminOnly: true },
  { to: "/users", label: "Clients & Access", adminOnly: true },
  { to: "/features", label: "Features", adminOnly: true },
  { to: "/audit-logs", label: "Audit Log", adminOnly: true },
  { to: "/settings", label: "Settings", adminOnly: true },
  { to: "/api-tester", label: "API Tester", adminOnly: true },
];

/**
 * Top navigation bar (IDE menu-bar style, light theme).
 *
 * Replaces the old sidebar: every section is a top-level item, with the
 * signed-in account in a dropdown on the right. On narrow screens the items
 * collapse behind a hamburger. Deliberately text-only — no item icons.
 */
export function MenuBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);

  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || admin);

  // Close the account dropdown on click-outside or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const handleLogout = async () => {
    setAccountOpen(false);
    setMobileOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-slate-600 hover:bg-sky-100 hover:text-primary",
    );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
          {/* Brand — mark only, no wordmark */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex shrink-0 items-center rounded-lg p-1 transition-colors hover:bg-sky-100"
            aria-label="JagoBridge home"
          >
            <Logo className="h-7 w-7" />
          </button>

          {/* Desktop nav */}
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex" aria-label="Main">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-sky-100 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Account */}
          <div ref={accountRef} className="relative ml-auto shrink-0 lg:ml-0">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              className={cn(
                "flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-sky-100",
                accountOpen && "bg-sky-100",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold uppercase text-white">
                {user?.email?.slice(0, 2) ?? "JB"}
              </span>
              <span className="hidden max-w-[9rem] truncate text-[13px] font-medium text-slate-700 sm:inline">
                {user?.name || user?.email}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:inline" aria-hidden />
            </button>

            {accountOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-border bg-white py-1 shadow-lg"
              >
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user?.name || user?.email}
                  </p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    {admin ? "Administrator" : "Member"}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate("/change-password");
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-sky-100"
                >
                  Change password
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    setAboutOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-sky-100"
                >
                  About JagoBridge
                </button>
                <div className="my-1 h-px bg-border" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleLogout()}
                  className="block w-full px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-red-50"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileOpen ? (
          <nav className="border-t border-border bg-white px-2 py-2 lg:hidden" aria-label="Main">
            <div className="grid gap-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-600 hover:bg-sky-100 hover:text-primary",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <Modal open={aboutOpen} title="About JagoBridge" onClose={() => setAboutOpen(false)}>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <div>
              <p className="font-semibold text-foreground">JagoBridge</p>
              <p className="text-xs text-muted">Enterprise AI Gateway</p>
            </div>
            <Badge tone="primary">v1.0.0</Badge>
          </div>
          <p className="text-muted">
            Internal LLM access control and an OpenAI-compatible AI gateway. Access, feature, and
            limit rules are enforced in one place: the gateway pipeline.
          </p>
          <p className="text-xs text-muted">
            Signed in as {user?.email} ({admin ? "Administrator" : "Member"})
          </p>
        </div>
      </Modal>
    </>
  );
}
