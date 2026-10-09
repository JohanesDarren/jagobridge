import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";
import { useHealth, useSettings, useUsageEvents, useUsageStats } from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { formatDateTime, formatNumber, formatRelative, percent } from "../../lib/format";
import { UsageGauge } from "../../components/charts/UsageGauge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Input";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";
import type { UsageStats } from "../../types/api";

const REFRESH_OPTIONS = [
  { value: 30000, label: "every 30s" },
  { value: 60000, label: "every 60s" },
  { value: 300000, label: "every 5 min" },
];

const STATUS_LABELS: Record<number, string> = {
  200: "OK",
  201: "CREATED",
  400: "BAD REQ",
  401: "AUTH",
  402: "BALANCE",
  403: "FORBIDDEN",
  404: "NOT FOUND",
  429: "RATE LIMIT",
  500: "UPSTREAM",
  502: "BAD GATEWAY",
  504: "TIMEOUT",
};

function statusTone(code: number | null): "success" | "warning" | "danger" | "neutral" {
  if (code === null) return "neutral";
  if (code >= 200 && code < 300) return "success";
  if (code >= 400 && code < 500) return "warning";
  if (code >= 500) return "danger";
  return "neutral";
}

function statusText(code: number | null): string {
  if (code === null) return "no upstream";
  return `${code} ${STATUS_LABELS[code] ?? ""}`.trim();
}

/** Percentage change against the previous window, shown as a neutral pill. */
function deltaLabel(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "new activity" : "stabil";
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return "stabil";
  return `${change > 0 ? "+" : ""}${change.toFixed(0)}%`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [live, setLive] = useState(true);
  const [interval, setIntervalMs] = useState(60000);

  // Stable previous-window bounds so the comparison query does not churn.
  const previousWindow = useMemo(() => {
    const now = Date.now();
    return {
      from: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      to: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    };
  }, []);

  const poll = live ? interval : 0;
  const statsQuery = useUsageStats({ range: "24h", refetchIntervalMs: poll });
  const previousQuery = useUsageStats({ range: "custom", ...previousWindow });
  const healthQuery = useHealth(poll);
  const settingsQuery = useSettings();
  const eventsQuery = useUsageEvents({ limit: 8, refetchIntervalMs: poll });

  if (!admin) {
    return <MemberDashboard name={user?.name.split(" ")[0] ?? ""} />;
  }

  const stats = statsQuery.data;
  const previous = previousQuery.data;
  const services = healthQuery.data?.services;
  const trafficPerMinute = stats ? stats.totals.requests / (24 * 60) : 0;
  const errors = stats ? stats.totals.client_4xx + stats.totals.server_5xx : 0;

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- live monitoring */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5">
          <span className={cn("h-2 w-2 rounded-full", live ? "bg-success" : "bg-muted")} />
          <span className="text-sm font-medium">Live monitoring</span>
          <span className="text-xs text-muted">
            updated {healthQuery.dataUpdatedAt ? formatDateTime(new Date(healthQuery.dataUpdatedAt).toISOString()) : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Refresh interval"
            value={String(interval)}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
            className="w-36"
          >
            {REFRESH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              void statsQuery.refetch();
              void healthQuery.refetch();
              void eventsQuery.refetch();
            }}
          >
            <RefreshCw className={cn("h-4 w-4", statsQuery.isFetching && "animate-spin")} aria-hidden />
            Refresh
          </Button>
          <Button variant={live ? "danger" : "secondary"} onClick={() => setLive((value) => !value)}>
            {live ? "Stop live" : "Start live"}
          </Button>
        </div>
      </div>

      {statsQuery.isError ? (
        <ErrorState message="Could not load dashboard metrics." onRetry={() => void statsQuery.refetch()} />
      ) : null}

      {/* ------------------------------------------------------------- pipeline */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-primary">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
              Unified API gateway pipeline
            </span>
          }
          description="Real-time workflow and routing status."
        />
        <CardBody>
          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-5 text-center">
              <Users className="h-6 w-6 text-primary" aria-hidden />
              <p className="font-semibold">Clients / devs</p>
              <p className="text-xs text-muted">API keys &amp; playground</p>
            </div>

            <FlowChip label="API key auth" tone="success" />

            <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border-2 border-primary bg-blue-50/50 px-4 py-5 text-center">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
              <p className="font-semibold">API gateway</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                <Chip>RATE LIMIT</Chip>
                <Chip>QUOTA</Chip>
                <Chip>ACCESS</Chip>
              </div>
            </div>

            <FlowChip label="Routing" tone="primary" />

            <div className="flex flex-1 flex-col gap-2">
              <ServiceRow label="Chat AI" status={services?.upstream_9router ?? null} />
              <ServiceRow label="Models AI" status={services?.upstream_9router ?? null} />
              <ServiceRow label="PostgreSQL" status={services?.database ?? null} />
              <ServiceRow label="Redis" status={services?.redis ?? null} />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ----------------------------------------------------------------- KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total responses"
          value={stats ? formatNumber(stats.totals.requests) : "—"}
          delta={deltaLabel(stats?.totals.requests ?? 0, previous?.totals.requests ?? 0)}
          icon={<Activity className="h-5 w-5" />}
          tone="primary"
        />
        <KpiCard
          label="Average latency"
          value={stats ? `${Math.round(stats.totals.avg_latency_ms)} ms` : "—"}
          delta={deltaLabel(stats?.totals.avg_latency_ms ?? 0, previous?.totals.avg_latency_ms ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          label="Total error (4xx/5xx)"
          value={stats ? formatNumber(errors) : "—"}
          delta={deltaLabel(
            errors,
            (previous?.totals.client_4xx ?? 0) + (previous?.totals.server_5xx ?? 0),
          )}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="danger"
        />
        <KpiCard
          label="Traffic / minute"
          value={stats ? trafficPerMinute.toFixed(2) : "—"}
          delta="last 24h"
          icon={<Activity className="h-5 w-5" />}
          tone="primary"
        />
      </div>

      {/* ------------------------------------------------------ service health */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ServiceHealthCard
          name="PostgreSQL"
          detail="Primary datastore"
          status={services?.database ?? null}
          icon={<Database className="h-5 w-5" />}
        />
        <ServiceHealthCard
          name="Redis"
          detail="Rate limit &amp; access cache"
          status={services?.redis ?? null}
          icon={<Server className="h-5 w-5" />}
        />
        <ServiceHealthCard
          name="9router upstream"
          detail={
            settingsQuery.data?.upstream.last_successful_sync_at
              ? `Last sync ${formatRelative(settingsQuery.data.upstream.last_successful_sync_at)}`
              : "Never synced"
          }
          status={services?.upstream_9router ?? null}
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      {/* ------------------------------------------------------------ charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Real-time traffic overview"
            description={
              stats ? `Client volume routed upstream · last 24 hours · ${formatNumber(stats.totals.requests)} req` : undefined
            }
          />
          <CardBody>
            {statsQuery.isLoading ? <LoadingState /> : null}
            {stats && stats.hourly.length === 0 ? (
              <EmptyState title="No traffic in the last 24 hours" description="Requests will appear here as they arrive." />
            ) : null}
            {stats && stats.hourly.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.hourly.map((row) => ({ ...row, label: row.hour.slice(-5) }))}>
                    <defs>
                      <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d26de" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0d26de" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      name="Requests"
                      stroke="#0d26de"
                      strokeWidth={2}
                      fill="url(#trafficFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Usage analytics" description="Upstream status code distribution" />
          <CardBody>
            {statsQuery.isLoading ? <LoadingState /> : null}
            {stats ? <StatusDonut stats={stats} /> : null}
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------- endpoint monitoring */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-success">
                <Server className="h-4 w-4" aria-hidden />
              </span>
              Active endpoint monitoring
            </span>
          }
          description="Live upstream status and latency."
          actions={
            <Link to="/usage" className="text-sm font-medium text-primary hover:underline">
              View analytics →
            </Link>
          }
        />
        <CardBody>
          <Table>
            <THead>
              <TR>
                <TH>Endpoint</TH>
                <TH>Method</TH>
                <TH>Status</TH>
                <TH className="text-right">Avg latency</TH>
                <TH className="text-right">Traffic (24h)</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD className="font-mono text-xs">/v1/chat/completions</TD>
                <TD>
                  <Badge tone="primary">POST</Badge>
                </TD>
                <TD>
                  <ServiceBadge status={services?.upstream_9router ?? null} />
                </TD>
                <TD className="text-right">{stats ? `${Math.round(stats.totals.avg_latency_ms)} ms` : "—"}</TD>
                <TD className="text-right">{stats ? `${formatNumber(stats.totals.requests)} / 24h` : "—"}</TD>
              </TR>
              <TR>
                <TD className="font-mono text-xs">/v1/models</TD>
                <TD>
                  <Badge tone="success">GET</Badge>
                </TD>
                <TD>
                  <ServiceBadge status={services?.upstream_9router ?? null} />
                </TD>
                <TD className="text-right text-muted">—</TD>
                <TD className="text-right">{stats ? `${formatNumber(stats.by_status_code.find((row) => row.upstream_status === 200)?.requests ?? 0)} / 24h` : "—"}</TD>
              </TR>
              {stats?.by_provider.map((row) => (
                <TR key={row.provider}>
                  <TD className="font-mono text-xs">9router → {row.provider}</TD>
                  <TD>
                    <Badge tone="primary">POST</Badge>
                  </TD>
                  <TD>
                    <ServiceBadge status={services?.upstream_9router ?? null} />
                  </TD>
                  <TD className="text-right">{Math.round(row.avg_latency_ms)} ms</TD>
                  <TD className="text-right">{formatNumber(row.requests)} / 24h</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {/* ----------------------------------------------------------- activity */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-danger">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              Recent activity logs
            </span>
          }
          description="Gateway and upstream activity."
          actions={<Badge tone="success">● {live ? "LIVE" : "PAUSED"}</Badge>}
        />
        <CardBody>
          {eventsQuery.isLoading ? <LoadingState /> : null}
          {eventsQuery.data && eventsQuery.data.events.length === 0 ? (
            <EmptyState
              title="No gateway requests yet"
              description="Requests that reach 9router appear here. Rejected calls (bad key, unknown model) are logged in the audit log."
            />
          ) : null}
          {eventsQuery.data && eventsQuery.data.events.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Timestamp</TH>
                  <TH>Client / entity</TH>
                  <TH>Upstream target</TH>
                  <TH>Status code</TH>
                  <TH>Detail</TH>
                </TR>
              </THead>
              <TBody>
                {eventsQuery.data.events.map((event) => (
                  <TR key={event.id}>
                    <TD className="whitespace-nowrap text-muted">
                      {formatDateTime(event.created_at)}
                    </TD>
                    <TD className="font-medium">{event.user_name ?? event.user_email ?? "—"}</TD>
                    <TD className="font-mono text-xs">{event.model_public_name}</TD>
                    <TD>
                      <Badge tone={statusTone(event.upstream_status)}>{statusText(event.upstream_status)}</Badge>
                    </TD>
                    <TD className="text-muted">
                      {event.latency_ms !== null ? `${event.latency_ms} ms` : "—"} · {event.source}
                      {event.usage_estimated ? " · est." : ""}
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

function MemberDashboard({ name }: { name: string }) {
  const { me } = useAuth();
  const eventsQuery = useUsageEvents({ limit: 8 });

  if (!me) return <LoadingState label="Loading your quota…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Welcome back, {name}</h1>
        <p className="mt-1 text-sm text-muted">Your quota and recent activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UsageGauge label="5-hour window" window={me.windows.five_hour} />
        <UsageGauge label="Weekly window" window={me.windows.weekly} />
      </div>

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
          {eventsQuery.data && eventsQuery.data.events.length === 0 ? (
            <EmptyState
              title="No requests yet"
              description="Create an API key and make your first request."
            />
          ) : null}
          {eventsQuery.data && eventsQuery.data.events.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Model</TH>
                  <TH className="text-right">Weighted tokens</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {eventsQuery.data.events.map((event) => (
                  <TR key={event.id}>
                    <TD className="whitespace-nowrap text-muted">{formatDateTime(event.created_at)}</TD>
                    <TD className="font-medium">{event.model_public_name}</TD>
                    <TD className="text-right">{formatNumber(event.weighted_tokens)}</TD>
                    <TD>
                      <Badge tone={statusTone(event.upstream_status)}>{statusText(event.upstream_status)}</Badge>
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

function StatusDonut({ stats }: { stats: UsageStats }) {
  const buckets = useMemo(() => {
    let two = 0;
    let four = 0;
    let five = 0;
    let none = 0;
    for (const row of stats.by_status_code) {
      const code = row.upstream_status;
      if (code === null) none += row.requests;
      else if (code >= 200 && code < 300) two += row.requests;
      else if (code >= 400 && code < 500) four += row.requests;
      else if (code >= 500) five += row.requests;
      else none += row.requests;
    }
    return [
      { name: "2xx success", value: two, color: "#16A34A" },
      { name: "4xx client", value: four, color: "#D97706" },
      { name: "5xx upstream", value: five, color: "#DC2626" },
      { name: "No upstream response", value: none, color: "#94A3B8" },
    ].filter((bucket) => bucket.value > 0);
  }, [stats.by_status_code]);

  const total = stats.totals.requests;

  if (buckets.length === 0) {
    return <EmptyState title="No response codes yet" description="Status codes appear once requests are routed." />;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={buckets} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={2}>
              {buckets.map((bucket) => (
                <Cell key={bucket.name} fill={bucket.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{formatNumber(total)}</span>
          <span className="text-xs uppercase text-muted">responses</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {buckets.map((bucket) => (
          <li key={bucket.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
              {bucket.name}
            </span>
            <span className="font-medium">
              {formatNumber(bucket.value)}
              <span className="ml-1 text-xs text-muted">
                {total > 0 ? `(${percent(bucket.value, total)}%)` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "danger";
}) {
  const tones = {
    primary: "bg-blue-50 text-primary",
    success: "bg-green-50 text-success",
    danger: "bg-red-50 text-danger",
  } as const;
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
            <span className="rounded border border-border bg-surface px-2 py-0.5 font-medium text-foreground">
              {delta}
            </span>
            vs previous 24h
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function ServiceHealthCard({
  name,
  detail,
  status,
  icon,
}: {
  name: string;
  detail: string;
  status: "healthy" | "unhealthy" | "degraded" | null;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-primary">{icon}</span>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="mt-0.5 text-xs text-muted">{detail}</p>
          </div>
        </div>
        <ServiceBadge status={status} />
      </CardBody>
    </Card>
  );
}

function ServiceBadge({ status }: { status: "healthy" | "unhealthy" | "degraded" | null }) {
  if (status === null) return <Badge tone="neutral">unknown</Badge>;
  if (status === "healthy") return <Badge tone="success">● Healthy</Badge>;
  if (status === "degraded") return <Badge tone="warning">● Degraded</Badge>;
  return <Badge tone="danger">● Down</Badge>;
}

function ServiceRow({ label, status }: { label: string; status: "healthy" | "unhealthy" | "degraded" | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
      <span className="text-sm">{label}</span>
      <ServiceBadge status={status} />
    </div>
  );
}

function FlowChip({ label, tone }: { label: string; tone: "success" | "primary" }) {
  const tones = {
    success: "border-green-200 bg-green-50 text-success",
    primary: "border-blue-200 bg-blue-50 text-primary",
  } as const;
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={cn("whitespace-nowrap rounded-md border px-2 py-1 font-medium", tones[tone])}>{label}</span>
      <span className="text-muted">→</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}
