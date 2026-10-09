import { useMemo, useState } from "react";
import { Download, Server, Users, Zap } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../hooks/useAuth";
import { useUsageEvents, useUsageStats } from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { IDR_PER_TOKEN, formatDateTime, formatIdr, formatNumber, formatRelative, formatTokens } from "../../lib/format";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";
import type { UsageBucket, UsageEvent, UsageStats } from "../../types/api";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
] as const;

const CHART_TABS = [
  { value: "tokens", label: "Tokens" },
  { value: "requests", label: "Requests" },
  { value: "cost", label: "Cost" },
] as const;

const IN_COLOR = "#EA580C";
const CACHED_COLOR = "#0891B2";
const OUT_COLOR = "#16A34A";
const COST_COLOR = "#D97706";

/** 14_759_816 -> "14.8M"; keeps table cells narrow. */
function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value);
}

function rangeBounds(range: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const days: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "60d": 60 };
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }
  if (range === "all") return { from: new Date(2000, 0, 1).toISOString(), to };
  const dayCount = days[range] ?? 7;
  return { from: new Date(now.getTime() - dayCount * 24 * 60 * 60 * 1000).toISOString(), to };
}

export function UsagePage() {
  const { user, me } = useAuth();
  const admin = isAdmin(user);

  const [tab, setTab] = useState<"overview" | "details">("overview");
  const [range, setRange] = useState<string>("7d");
  const [chartTab, setChartTab] = useState<(typeof CHART_TABS)[number]["value"]>("tokens");
  const [page, setPage] = useState(1);

  const statsQuery = useUsageStats({ range });
  const recentQuery = useUsageEvents({ limit: 12 });
  const historyQuery = useUsageEvents({ page, limit: 20 });

  const stats = statsQuery.data;
  const useHourly = range === "today" || range === "24h";
  const bound = rangeBounds(range);
  const exportHref = `/api/v1/usage/export?from=${encodeURIComponent(bound.from)}&to=${encodeURIComponent(bound.to)}`;

  const series = useMemo(() => {
    if (!stats) return [];
    const build = (label: string, row: UsageBucket) => ({
      label,
      fresh_input: Math.max(0, row.prompt_tokens - row.cached_tokens),
      cached: row.cached_tokens,
      output: row.completion_tokens,
      requests: row.requests,
      cost: row.weighted_tokens * IDR_PER_TOKEN,
    });
    return useHourly
      ? stats.hourly.map((row) => build(row.hour.slice(-5), row))
      : stats.daily.map((row) => build(row.day.slice(5), row));
  }, [stats, useHourly]);

  const estimatedCost = (stats?.totals.weighted_tokens ?? 0) * IDR_PER_TOKEN;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Usage &amp; analytics</h1>
          <p className="mt-1 text-sm text-muted">Monitor your API usage, token consumption, and request logs.</p>
        </div>
        <a href={exportHref} download>
          <Button variant="secondary">
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </a>
      </div>

      {/* --------------------------------------------------------- tab switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-md border border-border bg-white p-0.5">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "overview" ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab("details")}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              tab === "details" ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            Details
          </button>
        </div>

        <div className="flex flex-wrap items-center rounded-md border border-border bg-white p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setRange(option.value);
                setPage(1);
              }}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                range === option.value ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {statsQuery.isLoading ? <LoadingState label="Loading usage…" /> : null}
      {statsQuery.isError ? (
        <ErrorState message="Could not load usage." onRetry={() => void statsQuery.refetch()} />
      ) : null}

      {tab === "overview" && stats ? (
        <>
          {/* --------------------------------------------------------- KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Total requests" value={formatNumber(stats.totals.requests)} />
            <Kpi label="Total input tokens" value={formatNumber(stats.totals.prompt_tokens)} color={IN_COLOR} />
            <Kpi label="Cached tokens" value={formatNumber(stats.totals.cached_tokens)} color={CACHED_COLOR} />
            <Kpi label="Output tokens" value={formatNumber(stats.totals.completion_tokens)} color={OUT_COLOR} />
            <Kpi
              label="Est. cost"
              value={formatIdr(estimatedCost)}
              color={COST_COLOR}
              footnote={`Estimated at Rp ${IDR_PER_TOKEN}/weighted token — not actual billing`}
            />
          </div>

          {!admin && me ? (
            <p className="text-xs text-muted">
              5-hour: {formatTokens(me.windows.five_hour.used_tokens)} /{" "}
              {formatTokens(me.windows.five_hour.limit_tokens)} · Weekly:{" "}
              {formatTokens(me.windows.weekly.used_tokens)} / {formatTokens(me.windows.weekly.limit_tokens)}
            </p>
          ) : null}

          {/* ------------------------------------------ flow + recent requests */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Request flow" description="Clients routed through the gateway to upstream providers." />
              <CardBody>
                <RequestFlow stats={stats} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent requests"
                actions={
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setTab("details")}
                  >
                    View all
                  </button>
                }
              />
              <CardBody className="px-0 py-0">
                {recentQuery.isLoading ? <LoadingState /> : null}
                {recentQuery.data && recentQuery.data.events.length === 0 ? (
                  <EmptyState title="No requests yet" />
                ) : null}
                {recentQuery.data && recentQuery.data.events.length > 0 ? (
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Model</TH>
                          <TH className="text-right">In / Out</TH>
                          <TH className="text-right">When</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {recentQuery.data.events.map((event) => (
                          <TR key={event.id}>
                            <TD>
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    event.status === "success" ? "bg-success" : event.status === "client_cancelled" ? "bg-warning" : "bg-danger",
                                  )}
                                />
                                <span className="truncate text-xs font-medium">
                                  {event.model_public_name.split("/").pop()}
                                </span>
                              </span>
                            </TD>
                            <TD className="whitespace-nowrap text-right text-xs">
                              <span style={{ color: IN_COLOR }}>{compact(event.prompt_tokens)}↑</span>{" "}
                              <span style={{ color: OUT_COLOR }}>{compact(event.completion_tokens)}↓</span>
                            </TD>
                            <TD className="whitespace-nowrap text-right text-xs text-muted">
                              {formatRelative(event.created_at)}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {/* ------------------------------------------------------ chart tabs */}
          <Card>
            <CardBody className="px-0 py-0">
              <div className="flex items-center gap-1 border-b border-border px-5">
                {CHART_TABS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setChartTab(option.value)}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                      chartTab === option.value
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="px-5 py-4">
                {series.length === 0 ? (
                  <EmptyState title="No usage in this range" description="Try a different range." />
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartTab === "tokens" ? (
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis fontSize={12} tickFormatter={(value: number) => compact(value)} />
                          <Tooltip formatter={(value: number) => formatNumber(value)} />
                          <Legend />
                          <Bar dataKey="fresh_input" name="Input tokens" stackId="tokens" fill={IN_COLOR} />
                          <Bar dataKey="cached" name="Cached tokens" stackId="tokens" fill={CACHED_COLOR} />
                          <Bar dataKey="output" name="Output tokens" stackId="tokens" fill={OUT_COLOR} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : chartTab === "requests" ? (
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis fontSize={12} allowDecimals={false} />
                          <Tooltip formatter={(value: number) => formatNumber(value)} />
                          <Bar dataKey="requests" name="Requests" fill="#0d26de" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" fontSize={12} />
                          <YAxis fontSize={12} tickFormatter={(value: number) => compact(value)} />
                          <Tooltip formatter={(value: number) => formatIdr(value)} />
                          <Bar dataKey="cost" name="Est. cost" fill={COST_COLOR} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </>
      ) : null}

      {tab === "details" && stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Kpi label="Requests" value={formatNumber(stats.totals.requests)} />
            <Kpi label="Weighted tokens" value={formatTokens(stats.totals.weighted_tokens)} />
            <Kpi label="Errors" value={formatNumber(stats.totals.errors)} color="#DC2626" />
            <Kpi
              label="Latency p95"
              value={stats.latency.p95 ? `${Math.round(stats.latency.p95)} ms` : "—"}
              color={CACHED_COLOR}
            />
          </div>

          <Card>
            <CardHeader title="Usage by model" description={`Range ${formatDateTime(stats.range.from)} → ${formatDateTime(stats.range.to)}`} />
            <CardBody>
              {stats.by_model.length === 0 ? (
                <EmptyState title="No usage in this range" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Model</TH>
                      <TH className="text-right">Requests</TH>
                      <TH className="text-right">Weighted tokens</TH>
                      <TH className="text-right">Latency p50</TH>
                      <TH className="text-right">Latency p95</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {stats.by_model.map((row) => (
                      <TR key={row.model_public_name}>
                        <TD className="font-medium">{row.model_public_name}</TD>
                        <TD className="text-right">{formatNumber(row.requests)}</TD>
                        <TD className="text-right">{formatTokens(row.weighted_tokens)}</TD>
                        <TD className="text-right">{row.latency?.p50 ? `${Math.round(row.latency.p50)} ms` : "—"}</TD>
                        <TD className="text-right">{row.latency?.p95 ? `${Math.round(row.latency.p95)} ms` : "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {admin && stats.by_user.length > 0 ? (
            <Card>
              <CardHeader title="Usage by client" />
              <CardBody>
                <Table>
                  <THead>
                    <TR>
                      <TH>Client</TH>
                      <TH className="text-right">Requests</TH>
                      <TH className="text-right">Weighted tokens</TH>
                      <TH className="text-right">Est. cost</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {stats.by_user.map((row) => (
                      <TR key={row.user_id}>
                        <TD className="font-mono text-xs">{row.user_id.slice(0, 8)}…</TD>
                        <TD className="text-right">{formatNumber(row.requests)}</TD>
                        <TD className="text-right">{formatTokens(row.weighted_tokens)}</TD>
                        <TD className="text-right">{formatIdr(row.weighted_tokens * IDR_PER_TOKEN)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Request history" />
            <CardBody>
              {historyQuery.isLoading ? <LoadingState /> : null}
              {historyQuery.isError ? (
                <ErrorState message="Could not load requests." onRetry={() => void historyQuery.refetch()} />
              ) : null}
              {historyQuery.data && historyQuery.data.events.length === 0 ? (
                <EmptyState title="No requests yet" />
              ) : null}
              {historyQuery.data && historyQuery.data.events.length > 0 ? (
                <>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Time</TH>
                        <TH>Model</TH>
                        <TH>Source</TH>
                        <TH className="text-right">Prompt</TH>
                        <TH className="text-right">Cached</TH>
                        <TH className="text-right">Completion</TH>
                        <TH className="text-right">Weighted</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {historyQuery.data.events.map((event) => (
                        <TR key={event.id}>
                          <TD className="whitespace-nowrap text-muted">{formatDateTime(event.created_at)}</TD>
                          <TD className="font-medium">{event.model_public_name}</TD>
                          <TD>{event.source}</TD>
                          <TD className="text-right">{formatNumber(event.prompt_tokens)}</TD>
                          <TD className="text-right">{formatNumber(event.cached_tokens)}</TD>
                          <TD className="text-right">{formatNumber(event.completion_tokens)}</TD>
                          <TD className="text-right">
                            {formatNumber(event.weighted_tokens)}
                            {event.usage_estimated ? <span className="ml-1 text-xs text-warning">est.</span> : null}
                          </TD>
                          <TD>
                            <StatusBadge event={event} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>

                  {historyQuery.data.meta.total_pages > 1 ? (
                    <div className="mt-4 flex items-center justify-between text-sm text-muted">
                      <span>
                        Page {historyQuery.data.meta.page} of {historyQuery.data.meta.total_pages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!historyQuery.data.meta.has_prev}
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!historyQuery.data.meta.has_next}
                          onClick={() => setPage((current) => current + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function StatusBadge({ event }: { event: UsageEvent }) {
  if (event.upstream_status !== null) {
    const tone =
      event.upstream_status >= 200 && event.upstream_status < 300
        ? "success"
        : event.upstream_status >= 500
          ? "danger"
          : "warning";
    return <Badge tone={tone}>{event.upstream_status}</Badge>;
  }
  return (
    <Badge tone={event.status === "client_cancelled" ? "warning" : "neutral"}>
      {event.status === "client_cancelled" ? "cancelled" : "no upstream"}
    </Badge>
  );
}

function Kpi({
  label,
  value,
  color,
  footnote,
}: {
  label: string;
  value: string;
  color?: string;
  footnote?: string;
}) {
  return (
    <Card>
      <CardBody className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={color ? { color } : undefined}>
          {value}
        </p>
        {footnote ? <p className="mt-1 text-[10px] text-muted">{footnote}</p> : null}
      </CardBody>
    </Card>
  );
}

/**
 * Three-column flow: clients -> gateway -> upstream providers. Node width and
 * the counters come from real traffic in the selected range.
 */
function RequestFlow({ stats }: { stats: UsageStats }) {
  const clients = stats.by_user.slice(0, 6);
  const providers = stats.by_provider.slice(0, 8);
  const total = stats.totals.requests;

  if (total === 0 && clients.length === 0 && providers.length === 0) {
    return <EmptyState title="No traffic in this range" description="Requests appear here as clients call the gateway." />;
  }

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Clients</p>
        {clients.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          clients.map((client) => (
            <div
              key={client.user_id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-mono text-xs">{client.user_id.slice(0, 8)}…</span>
              </span>
              <span className="text-xs font-medium text-muted">{formatNumber(client.requests)} req</span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
          API key auth
        </span>
        <span className="text-muted">→</span>
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-primary bg-blue-50/50 px-5 py-4 text-center">
          <Zap className="h-5 w-5 text-primary" aria-hidden />
          <p className="text-sm font-semibold">JagoBridge</p>
          <p className="text-xs text-muted">{formatNumber(total)} req</p>
        </div>
        <span className="text-muted">→</span>
        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Routing
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Upstream providers</p>
        {providers.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          providers.map((row) => (
            <div
              key={row.provider}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <Server className="h-3.5 w-3.5 text-muted" aria-hidden />
                {row.provider}
              </span>
              <span className="text-xs font-medium text-muted">{formatNumber(row.requests)} req</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
