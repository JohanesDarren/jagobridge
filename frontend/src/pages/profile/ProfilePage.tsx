import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { formatTokens } from "../../lib/format";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { UsageGauge } from "../../components/charts/UsageGauge";

export function ProfilePage() {
  const { user, me } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">Your account details and session security.</p>
      </div>

      <Card>
        <CardHeader title="Account" />
        <CardBody className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Role</span>
            <Badge tone={user.role === "admin" ? "primary" : "neutral"}>{user.role}</Badge>
          </div>
          {me ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Profile</span>
                <span className="font-medium">{me.user.access_profile_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Entitled features</span>
                <span className="font-medium">{me.features.length > 0 ? me.features.join(", ") : "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">RPM limit</span>
                <span className="font-medium">{me.limits.limit_rpm === 0 ? "Unlimited" : me.limits.limit_rpm}</span>
              </div>
            </>
          ) : null}
        </CardBody>
      </Card>

      {me ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageGauge label="5-hour window" window={me.windows.five_hour} />
          <UsageGauge label="Weekly window" window={me.windows.weekly} />
        </div>
      ) : null}

      <Card>
        <CardHeader title="Security" description="Change your password regularly." />
        <CardBody className="flex flex-wrap gap-2">
          <Link to="/change-password">
            <span className="inline-flex h-10 items-center rounded-md border border-border bg-white px-4 text-sm font-medium hover:bg-surface">
              Change password
            </span>
          </Link>
        </CardBody>
      </Card>

      {me ? (
        <p className="text-xs text-muted">
          Your limits: 5-hour {formatTokens(me.limits.limit_5h_tokens)}, weekly{" "}
          {formatTokens(me.limits.limit_weekly_tokens)}, max output per request{" "}
          {me.limits.max_output_tokens_per_request === 0 ? "provider default" : me.limits.max_output_tokens_per_request}.
        </p>
      ) : null}
    </div>
  );
}
