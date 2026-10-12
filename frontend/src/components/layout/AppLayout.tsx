import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { QuotaBanner } from "./QuotaBanner";
import { MenuBar } from "./MenuBar";

/**
 * Shell for the signed-in console: a single top menu bar (no sidebar), an
 * optional quota banner, and the routed page.
 */
export function AppLayout() {
  const { user, me } = useAuth();

  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  if (user && !user.usage_notice_acknowledged) return <Navigate to="/usage-notice" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <MenuBar />

      <div className="flex min-w-0 flex-1 flex-col">
        {me ? <QuotaBanner fiveHour={me.windows.five_hour} weekly={me.windows.weekly} /> : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
