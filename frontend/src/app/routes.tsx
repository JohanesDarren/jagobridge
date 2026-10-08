import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isAdmin } from "../lib/permissions";
import { LoadingState } from "../components/ui/Feedback";
import { AppLayout } from "../components/layout/AppLayout";
import { LoginPage } from "../pages/auth/LoginPage";
import { AcceptInvitePage } from "../pages/auth/AcceptInvitePage";
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage";
import { UsageNoticePage } from "../pages/auth/UsageNoticePage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { ModelsPage } from "../pages/models/ModelsPage";
import { UsersPage } from "../pages/users/UsersPage";
import { UserDetailPage } from "../pages/users/UserDetailPage";
import { AccessProfilesPage } from "../pages/access-profiles/AccessProfilesPage";
import { FeaturesPage } from "../pages/features/FeaturesPage";
import { UsagePage } from "../pages/usage/UsagePage";
import { ApiKeysPage } from "../pages/api-keys/ApiKeysPage";
import { AuditLogsPage } from "../pages/audit-logs/AuditLogsPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { ProfilePage } from "../pages/profile/ProfilePage";
import { NotFoundPage } from "../pages/NotFoundPage";

function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/usage-notice" element={<UsageNoticePage />} />

        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route element={<RequireAdmin />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="access-profiles" element={<AccessProfilesPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
