import { useEffect, useState } from "react";
import { PlugZap } from "lucide-react";
import { useSettings, useTestUpstream, useUpdateSettings } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { formatDateTime } from "../../lib/format";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label } from "../../components/ui/Input";

export function SettingsPage() {
  const toast = useToast();
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const testMutation = useTestUpstream();

  const [timezone, setTimezone] = useState("");
  const [syncInterval, setSyncInterval] = useState("");
  const [retention, setRetention] = useState("");
  const [maxInflight, setMaxInflight] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setTimezone(data.default_timezone);
    setSyncInterval(String(data.model_sync_interval_minutes));
    setRetention(String(data.playground_retention_days));
    setMaxInflight(String(data.max_inflight_requests_per_user));
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading) return <LoadingState label="Loading settings…" />;
  if (settingsQuery.isError || !settingsQuery.data) {
    return <ErrorState message="Could not load settings." onRetry={() => void settingsQuery.refetch()} />;
  }

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        default_timezone: timezone,
        model_sync_interval_minutes: Number(syncInterval),
        playground_retention_days: Number(retention),
        max_inflight_requests_per_user: Number(maxInflight),
      });
      toast.success("Settings saved");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not save settings.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Upstream secrets are configured through environment variables and are never editable here.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Upstream connection"
          description={`Base URL: ${settingsQuery.data.upstream.base_url}`}
          actions={
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await testMutation.mutateAsync();
                setTestResult(`${result.success ? "Success" : "Failed"} · HTTP ${result.status} · ${result.message}`);
              }}
              loading={testMutation.isPending}
            >
              <PlugZap className="h-4 w-4" aria-hidden />
              Test connection
            </Button>
          }
        />
        <CardBody className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Status:</span>
            <Badge tone={settingsQuery.data.upstream.configured ? "success" : "warning"}>
              {settingsQuery.data.upstream.configured ? "configured" : "not configured"}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            Last successful sync: {formatDateTime(settingsQuery.data.upstream.last_successful_sync_at)}
          </p>
          {testResult ? <p className="text-sm text-foreground">{testResult}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Editable settings" description="Every change is written to the audit log." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tz">Default display timezone</Label>
              <Input id="tz" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Jakarta" />
            </div>
            <div>
              <Label htmlFor="sync">Model sync interval (minutes)</Label>
              <Input id="sync" type="number" min="15" max="1440" value={syncInterval} onChange={(event) => setSyncInterval(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="retention">Playground retention (days)</Label>
              <Input id="retention" type="number" min="7" max="365" value={retention} onChange={(event) => setRetention(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="inflight">Max in-flight requests per user</Label>
              <Input id="inflight" type="number" min="1" max="20" value={maxInflight} onChange={(event) => setMaxInflight(event.target.value)} />
            </div>
          </div>
          <Button onClick={save} loading={updateMutation.isPending}>
            Save settings
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
