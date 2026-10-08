import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";
import { useUsageEvents, useUsageStats } from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { formatDateTime, formatNumber, formatTokens } from "../../lib/format";
import { UsageGauge } from "../../components/charts/UsageGauge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

export function DashboardPage() {
  const { user, me } = useAuth();
  const admin = isAdmin(user);

  const eventsQuery = useUsageEvents({ limit: 8 });
  const statsQuery = useUsageStats({ range: "7d" });

  if (!me) return <LoadingState label="Loading your quota…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {admin ? "Team overview" : `Welcome back, ${user?.name.split(" ")[0]}`}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {admin
            ? "Team usage, top users, and top models for the last 7 days."
            : "Your quota and recent activity."}
        </p>
      </div>

      {!admin ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageGauge label="5-hour window" window={me.windows.five_hour} />
          <UsageGauge label="Weekly window" window={me.windows.weekly} />
        </div>
      ) : null}

      {admin ? (
        <Card>
          <CardHeader
            title="Team usage (last 7 days)"
            description={
              statsQuery.data
                ? `${formatNumber(statsQuery.data.totals.requests)} requests · ${statsQuery.data.totals.errors} errors`
                : undefined
            }
          />
          <CardBody>
            {statsQuery.isLoading ? <LoadingState /> : null}
            {statsQuery.isError ? <ErrorState message="Could not load team usage." onRetry={() => void statsQuery.refetch()} /> : null}
            {statsQuery.data && statsQuery.data.daily.length === 0 ? (
              <EmptyState title="No usage yet" description="Team usage will appear here after the first gateway request." />
            ) : null}
            {statsQuery.data && statsQuery.data.daily.length > 0 ? (
              <>
                <div className="mb-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted">Weighted tokens</p>
                    <p className="text-lg font-semibold">{formatTokens(statsQuery.data.totals.weighted_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted">Requests</p>
                    <p className="text-lg font-semibold">{formatNumber(statsQuery.data.totals.requests)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted">Latency p95</p>
                    <p className="text-lg font-semibold">
                      {statsQuery.data.latency.p95 ? `${Math.round(statsQuery.data.latency.p95)} ms` : "—"}
                    </p>
                  </div>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsQuery.data.daily}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(value: number) => formatTokens(value)} />
                      <Bar dataKey="weighted_tokens" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {admin && statsQuery.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Top models" />
            <CardBody>
              {statsQuery.data.by_model.length === 0 ? (
                <EmptyState title="No models used yet" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Model</TH>
                      <TH className="text-right">Requests</TH>
                      <TH className="text-right">Weighted tokens</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {statsQuery.data.by_model.map((row) => (
                      <TR key={row.model_public_name}>
                        <TD className="font-medium">{row.model_public_name}</TD>
                        <TD className="text-right">{formatNumber(row.requests)}</TD>
                        <TD className="text-right">{formatTokens(row.weighted_tokens)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Top users" />
            <CardBody>
              {statsQuery.data.by_user.length === 0 ? (
                <EmptyState title="No user usage yet" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>User</TH>
                      <TH className="text-right">Requests</TH>
                      <TH className="text-right">Weighted tokens</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {statsQuery.data.by_user.map((row) => (
                      <TR key={row.user_id}>
                        <TD className="font-mono text-xs">{row.user_id.slice(0, 8)}…</TD>
                        <TD className="text-right">{formatNumber(row.requests)}</TD>
                        <TD className="text-right">{formatTokens(row.weighted_tokens)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Recent requests"
          actions={
            <Link to="/usage" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        />
        <CardBody>
          {eventsQuery.isLoading ? <LoadingState /> : null}
          {eventsQuery.isError ? <ErrorState message="Could not load recent requests." onRetry={() => void eventsQuery.refetch()} /> : null}
          {eventsQuery.data && eventsQuery.data.events.length === 0 ? (
            <EmptyState
              title="No requests yet"
              description="Create an API key and make your first request, or use the playground."
            />
          ) : null}
          {eventsQuery.data && eventsQuery.data.events.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Model</TH>
                  <TH>Source</TH>
                  <TH className="text-right">Weighted tokens</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {eventsQuery.data.events.map((event) => (
                  <TR key={event.id}>
                    <TD className="whitespace-nowrap text-muted">{formatDateTime(event.created_at)}</TD>
                    <TD className="font-medium">{event.model_public_name}</TD>
                    <TD>{event.source}</TD>
                    <TD className="text-right">{formatNumber(event.weighted_tokens)}</TD>
                    <TD>
                      <Badge tone={event.status === "success" ? "success" : event.status === "client_cancelled" ? "warning" : "danger"}>
                        {event.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
