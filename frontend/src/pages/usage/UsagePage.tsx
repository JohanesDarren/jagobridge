import { useState } from "react";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../hooks/useAuth";
import { useUsageEvents, useUsageStats } from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { formatDateTime, formatNumber, formatTokens } from "../../lib/format";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Input";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

const RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export function UsagePage() {
  const { user, me } = useAuth();
  const admin = isAdmin(user);
  const [range, setRange] = useState("7d");
  const [page, setPage] = useState(1);

  const statsQuery = useUsageStats({ range });
  const eventsQuery = useUsageEvents({ page, limit: 20 });

  const exportHref = `/api/v1/usage/export?from=${encodeURIComponent(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  )}&to=${encodeURIComponent(new Date().toISOString())}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{admin ? "Team usage" : "My usage"}</h1>
          <p className="mt-1 text-sm text-muted">Weighted tokens, requests, and per-model breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onChange={(event) => setRange(event.target.value)} className="w-40">
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <a href={exportHref} download>
            <Button variant="secondary">
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-muted">Weighted tokens</p>
            <p className="text-2xl font-semibold">
              {statsQuery.data ? formatTokens(statsQuery.data.totals.weighted_tokens) : "—"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-muted">Requests</p>
            <p className="text-2xl font-semibold">
              {statsQuery.data ? formatNumber(statsQuery.data.totals.requests) : "—"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase text-muted">Latency p95</p>
            <p className="text-2xl font-semibold">
              {statsQuery.data?.latency.p95 ? `${Math.round(statsQuery.data.latency.p95)} ms` : "—"}
            </p>
          </CardBody>
        </Card>
      </div>

      {me && !admin ? (
        <p className="text-xs text-muted">
          5-hour: {formatTokens(me.windows.five_hour.used_tokens)} / {formatTokens(me.windows.five_hour.limit_tokens)} ·
          Weekly: {formatTokens(me.windows.weekly.used_tokens)} / {formatTokens(me.windows.weekly.limit_tokens)}
        </p>
      ) : null}

      <Card>
        <CardHeader title="Daily usage" />
        <CardBody>
          {statsQuery.isLoading ? <LoadingState /> : null}
          {statsQuery.isError ? <ErrorState message="Could not load usage." onRetry={() => void statsQuery.refetch()} /> : null}
          {statsQuery.data && statsQuery.data.daily.length === 0 ? (
            <EmptyState title="No usage in this range" description="Try a different date range." />
          ) : null}
          {statsQuery.data && statsQuery.data.daily.length > 0 ? (
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
          ) : null}
        </CardBody>
      </Card>

      {statsQuery.data && statsQuery.data.by_model.length > 0 ? (
        <Card>
          <CardHeader title="Usage by model" />
          <CardBody>
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
                {statsQuery.data.by_model.map((row) => (
                  <TR key={row.model_public_name}>
                    <TD className="font-medium">{row.model_public_name}</TD>
                    <TD className="text-right">{formatNumber(row.requests)}</TD>
                    <TD className="text-right">{formatTokens(row.weighted_tokens)}</TD>
                    <TD className="text-right">
                      {row.latency?.p50 ? `${Math.round(row.latency.p50)} ms` : "—"}
                    </TD>
                    <TD className="text-right">
                      {row.latency?.p95 ? `${Math.round(row.latency.p95)} ms` : "—"}
                    </TD>
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
          {eventsQuery.isLoading ? <LoadingState /> : null}
          {eventsQuery.isError ? <ErrorState message="Could not load requests." onRetry={() => void eventsQuery.refetch()} /> : null}
          {eventsQuery.data && eventsQuery.data.events.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : null}
          {eventsQuery.data && eventsQuery.data.events.length > 0 ? (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Time</TH>
                    <TH>Model</TH>
                    <TH>Source</TH>
                    <TH className="text-right">Prompt</TH>
                    <TH className="text-right">Completion</TH>
                    <TH className="text-right">Weighted</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {eventsQuery.data.events.map((event) => (
                    <TR key={event.id}>
                      <TD className="whitespace-nowrap text-muted">{formatDateTime(event.created_at)}</TD>
                      <TD className="font-medium">{event.model_public_name}</TD>
                      <TD>{event.source}</TD>
                      <TD className="text-right">{formatNumber(event.prompt_tokens)}</TD>
                      <TD className="text-right">{formatNumber(event.completion_tokens)}</TD>
                      <TD className="text-right">
                        {formatNumber(event.weighted_tokens)}
                        {event.usage_estimated ? <span className="ml-1 text-xs text-warning">est.</span> : null}
                      </TD>
                      <TD>
                        <Badge tone={event.status === "success" ? "success" : event.status === "client_cancelled" ? "warning" : "danger"}>
                          {event.status}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {eventsQuery.data.meta.total_pages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                  <span>
                    Page {eventsQuery.data.meta.page} of {eventsQuery.data.meta.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!eventsQuery.data.meta.has_prev}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!eventsQuery.data.meta.has_next}
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
    </div>
  );
}
