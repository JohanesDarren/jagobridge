import { useState } from "react";
import { useAuditLogs } from "../../hooks/resources";
import { formatDateTime } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Select } from "../../components/ui/Input";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

const TARGET_TYPES = ["user", "access_profile", "model", "feature", "api_key", "system_settings", "user_invitation"];

export function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(1);

  const auditQuery = useAuditLogs({ action, target_type: targetType, page, limit: 25 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-muted">
          Append-only record of administrative and security events. Entries are kept for 365 days.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="audit-action">Action</Label>
            <Input
              id="audit-action"
              placeholder="e.g. model.sync"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="audit-target">Target type</Label>
            <Select
              id="audit-target"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Entries"
          description={auditQuery.data ? `${auditQuery.data.meta.total} entries` : undefined}
        />
        <CardBody>
          {auditQuery.isLoading ? <LoadingState /> : null}
          {auditQuery.isError ? <ErrorState message="Could not load the audit log." onRetry={() => void auditQuery.refetch()} /> : null}
          {auditQuery.data && auditQuery.data.entries.length === 0 ? <EmptyState title="No entries found" /> : null}
          {auditQuery.data && auditQuery.data.entries.length > 0 ? (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Time</TH>
                    <TH>Action</TH>
                    <TH>Target</TH>
                    <TH>Actor</TH>
                    <TH>Changes</TH>
                  </TR>
                </THead>
                <TBody>
                  {auditQuery.data.entries.map((entry) => (
                    <TR key={entry.id}>
                      <TD className="whitespace-nowrap text-muted">{formatDateTime(entry.created_at)}</TD>
                      <TD className="font-mono text-xs">{entry.action}</TD>
                      <TD>
                        {entry.target_type}
                        {entry.target_id ? <span className="text-muted"> · {entry.target_id.slice(0, 8)}…</span> : null}
                      </TD>
                      <TD className="font-mono text-xs">
                        {entry.actor_user_id ? `${entry.actor_user_id.slice(0, 8)}…` : "system"}
                      </TD>
                      <TD>
                        {entry.before_state || entry.after_state ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-primary">View</summary>
                            <pre className="mt-1 max-w-sm overflow-x-auto rounded bg-surface p-2 text-xs">
                              {JSON.stringify({ before: entry.before_state, after: entry.after_state }, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {auditQuery.data.meta.total_pages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                  <span>
                    Page {auditQuery.data.meta.page} of {auditQuery.data.meta.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!auditQuery.data.meta.has_prev}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!auditQuery.data.meta.has_next}
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
