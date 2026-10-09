import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Cpu,
  Pencil,
  Power,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  useAvailableModels,
  useModelCatalog,
  useSettings,
  useSyncModels,
  useUpdateModel,
} from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { formatDateTime } from "../../lib/format";
import { ApiError } from "../../lib/api-client";
import { useToast } from "../../hooks/useToast";
import { cn } from "../../lib/utils";
import type { Model } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

const GATEWAY_BASE_URL = `${window.location.origin}/v1`;
const FALLBACK_UPSTREAM = "https://9router.jagoai.dev/v1";

/** 0.8x = cheaper than standard, 1x = standard, above 1x = premium. */
function multiplierLabel(value: number): { label: string; tone: "success" | "neutral" | "warning" } {
  if (value < 1) return { label: "Hemat", tone: "success" };
  if (value > 1) return { label: "Premium", tone: "warning" };
  return { label: "Standar", tone: "neutral" };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="rounded p-0.5 text-muted hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
          toast.success(`${label} copied`);
        } catch {
          toast.error("Could not copy to the clipboard");
        }
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function ModelsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Model | null>(null);
  const [publicName, setPublicName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [multiplier, setMultiplier] = useState("1.00");
  const [enabled, setEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const catalogQuery = useModelCatalog();
  const availableQuery = useAvailableModels();
  const settingsQuery = useSettings();
  const syncMutation = useSyncModels();
  const updateMutation = useUpdateModel();

  const models = useMemo(() => catalogQuery.data?.models ?? [], [catalogQuery.data]);

  const providers = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();
    for (const model of models) {
      const key = model.provider_label ?? "unknown";
      const entry = counts.get(key) ?? { total: 0, active: 0 };
      entry.total += 1;
      if (model.is_enabled && model.is_available) entry.active += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return models.filter((model) => {
      const provider = model.provider_label ?? "unknown";
      if (providerFilter && provider !== providerFilter) return false;
      if (statusFilter === "active" && !(model.is_enabled && model.is_available)) return false;
      if (statusFilter === "inactive" && model.is_enabled && model.is_available) return false;
      if (!term) return true;
      return (
        model.public_name.toLowerCase().includes(term) ||
        model.display_name.toLowerCase().includes(term) ||
        model.upstream_id.toLowerCase().includes(term)
      );
    });
  }, [models, search, providerFilter, statusFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Model[]>();
    for (const model of filtered) {
      const key = model.provider_label ?? "unknown";
      groups.set(key, [...(groups.get(key) ?? []), model]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const activeCount = models.filter((model) => model.is_enabled && model.is_available).length;
  const upstreamBaseUrl = settingsQuery.data?.upstream.base_url ?? FALLBACK_UPSTREAM;

  const openEditor = (model: Model) => {
    setEditing(model);
    setPublicName(model.public_name);
    setDisplayName(model.display_name === model.upstream_id ? "" : model.display_name);
    setMultiplier(model.token_multiplier.toFixed(2));
    setEnabled(model.is_enabled);
    setFormError(null);
  };

  const saveModel = async () => {
    if (!editing) return;
    setFormError(null);
    const parsedMultiplier = Number(multiplier);
    if (Number.isNaN(parsedMultiplier) || parsedMultiplier < 0.01 || parsedMultiplier > 100) {
      setFormError("Token multiplier must be between 0.01 and 100.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        patch: {
          public_name: publicName.trim(),
          display_name: displayName.trim() || publicName.trim(),
          token_multiplier: parsedMultiplier,
          is_enabled: enabled,
        },
      });
      toast.success("Model updated");
      setEditing(null);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not update the model.");
    }
  };

  const toggleModel = async (model: Model) => {
    try {
      await updateMutation.mutateAsync({ id: model.id, patch: { is_enabled: !model.is_enabled } });
      toast.success(model.is_enabled ? `${model.public_name} disabled` : `${model.public_name} enabled`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update the model.");
    }
  };

  const runSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(
        `Sync complete: ${result.added} added, ${result.updated} updated, ${result.marked_unavailable} unavailable`,
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Sync failed");
    }
  };

  if (!admin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Models</h1>
          <p className="mt-1 text-sm text-muted">Models you can use with your API key or the playground.</p>
        </div>

        <Card>
          <CardHeader
            title="Gateway connection"
            description="Point your OpenAI-compatible tools at this base URL and use your JagoBridge API key."
            actions={<CopyButton value={GATEWAY_BASE_URL} label="Base URL" />}
          />
          <CardBody>
            <code className="block overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-sm">
              {GATEWAY_BASE_URL}
            </code>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Available models" />
          <CardBody>
            {availableQuery.isLoading ? <LoadingState /> : null}
            {availableQuery.isError ? <ErrorState message="Could not load models." onRetry={() => void availableQuery.refetch()} /> : null}
            {availableQuery.data && availableQuery.data.length === 0 ? (
              <EmptyState
                title="No models available"
                description="An administrator must enable models and grant them to your package."
              />
            ) : null}
            {availableQuery.data && availableQuery.data.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Model name</TH>
                    <TH>Display name</TH>
                    <TH>Capabilities</TH>
                    <TH>Multiplier</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {availableQuery.data.map((model) => (
                    <TR key={model.id}>
                      <TD className="font-mono text-xs">{model.public_name}</TD>
                      <TD className="font-medium">{model.display_name}</TD>
                      <TD className="space-x-1">
                        {model.capabilities.tool_calling ? <Badge tone="primary">tools</Badge> : null}
                        {model.capabilities.vision_input ? <Badge tone="primary">vision</Badge> : null}
                        {model.capabilities.json_mode ? <Badge tone="primary">json</Badge> : null}
                      </TD>
                      <TD>×{model.token_multiplier.toFixed(2)}</TD>
                      <TD>
                        <CopyButton value={model.public_name} label="Model name" />
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

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Model catalog</h1>
              <p className="mt-1 text-sm text-muted">
                Manage the models exposed by the {upstreamBaseUrl} upstream. Set status, display alias and token
                multiplier.
              </p>
            </div>
          </div>
          <Button onClick={runSync} loading={syncMutation.isPending}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Sync all
          </Button>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total models" value={String(models.length)} icon={<Cpu className="h-5 w-5" />} tone="primary" />
        <StatCard label="Providers" value={String(providers.length)} icon={<Server className="h-5 w-5" />} tone="primary" />
        <StatCard
          label="Active models"
          value={`${activeCount} / ${models.length}`}
          icon={<Zap className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Inactive models"
          value={String(models.length - activeCount)}
          icon={<Power className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              aria-label="Search models"
              placeholder="Search model, provider, or alias…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={providerFilter === ""} onClick={() => setProviderFilter("")}>
              All ({models.length})
            </FilterChip>
            {providers.map(([provider, counts]) => (
              <FilterChip
                key={provider}
                active={providerFilter === provider}
                onClick={() => setProviderFilter(provider)}
              >
                {provider} ({counts.total})
              </FilterChip>
            ))}
          </div>
          <div className="flex items-center rounded-md border border-border p-0.5">
            {(["all", "active", "inactive"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === value ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {catalogQuery.isLoading ? <LoadingState label="Loading catalog…" /> : null}
      {catalogQuery.isError ? (
        <ErrorState message="Could not load the catalog." onRetry={() => void catalogQuery.refetch()} />
      ) : null}
      {catalogQuery.data ? (
        <p className="text-xs text-muted">
          {catalogQuery.data.sync.last_successful_sync_at
            ? `Last successful sync: ${formatDateTime(catalogQuery.data.sync.last_successful_sync_at)}`
            : "No successful sync yet. Configure the upstream key and run a sync."}
        </p>
      ) : null}

      {!catalogQuery.isLoading && filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="No models match" description="Adjust the search, provider, or status filter." />
          </CardBody>
        </Card>
      ) : null}

      {grouped.map(([provider, providerModels]) => {
        const active = providerModels.filter((model) => model.is_enabled && model.is_available).length;
        return (
          <Card key={provider}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-success">
                    <Server className="h-4 w-4" aria-hidden />
                  </span>
                  {provider}
                </span>
              }
              description={
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="font-mono text-xs">{upstreamBaseUrl}</span>
                </span>
              }
              actions={<Badge tone={active === providerModels.length ? "success" : "neutral"}>{active} / {providerModels.length} ACTIVE</Badge>}
            />
            <CardBody>
              <Table>
                <THead>
                  <TR>
                    <TH>Model AI &amp; ID</TH>
                    <TH>Token multiplier</TH>
                    <TH>Status</TH>
                    <TH>Alias / display name</TH>
                    <TH>Provider</TH>
                  </TR>
                </THead>
                <TBody>
                  {providerModels.map((model) => {
                    const { label, tone } = multiplierLabel(model.token_multiplier);
                    return (
                      <TR key={model.id}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-muted">
                              {provider}/
                            </span>
                            <span className="font-medium text-foreground">{model.public_name}</span>
                            <CopyButton value={model.public_name} label="Model name" />
                          </div>
                          <p className="mt-0.5 font-mono text-xs text-muted">{model.upstream_id}</p>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium">
                              <Zap className="h-3 w-3 text-primary" aria-hidden />
                              {model.token_multiplier.toFixed(2)}x
                            </span>
                            <Badge tone={tone}>{label}</Badge>
                          </div>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <StatusToggle
                              enabled={model.is_enabled}
                              label={`${model.is_enabled ? "Disable" : "Enable"} ${model.public_name}`}
                              disabled={!model.is_available}
                              onToggle={() => void toggleModel(model)}
                            />
                            <span className={cn("text-xs font-medium", model.is_enabled ? "text-success" : "text-muted")}>
                              {!model.is_available ? "Unavailable" : model.is_enabled ? "Aktif" : "Mati"}
                            </span>
                          </div>
                        </TD>
                        <TD>
                          {model.display_name && model.display_name !== model.upstream_id ? (
                            <span className="text-sm">{model.display_name}</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </TD>
                        <TD>
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone="neutral">{(model.provider_label ?? "unknown").toUpperCase()}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Set alias for ${model.public_name}`}
                              onClick={() => openEditor(model)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="text-xs">Set alias</span>
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        );
      })}

      <Modal
        open={editing !== null}
        title={`Edit ${editing?.public_name ?? "model"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveModel} loading={updateMutation.isPending}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="public_name">Public name</Label>
            <Input id="public_name" value={publicName} onChange={(event) => setPublicName(event.target.value)} />
            <p className="mt-1 text-xs text-muted">
              Lowercase letters, digits, dots, hyphens, and slashes. Clients send this in requests.
            </p>
          </div>
          <div>
            <Label htmlFor="display_name">Alias / display name</Label>
            <Input
              id="display_name"
              value={displayName}
              placeholder="e.g. Claude 3.5 Sonnet"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="multiplier">Token multiplier</Label>
            <Input
              id="multiplier"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={multiplier}
              onChange={(event) => setMultiplier(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enable this model for clients
          </label>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning";
}) {
  const tones = {
    primary: "bg-blue-50 text-primary",
    success: "bg-green-50 text-success",
    warning: "bg-amber-50 text-warning",
  } as const;
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-blue-50 text-primary"
          : "border-border bg-white text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StatusToggle({
  enabled,
  disabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        enabled ? "bg-success" : "bg-border",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
