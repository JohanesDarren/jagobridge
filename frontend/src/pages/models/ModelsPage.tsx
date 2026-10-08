import { useState } from "react";
import { Copy, RefreshCw, Settings2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  useAvailableModels,
  useModelCatalog,
  useSyncModels,
  useUpdateModel,
} from "../../hooks/resources";
import { isAdmin } from "../../lib/permissions";
import { formatDateTime } from "../../lib/format";
import { ApiError } from "../../lib/api-client";
import { useToast } from "../../hooks/useToast";
import type { Model } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

const GATEWAY_BASE_URL = `${window.location.origin}/v1`;

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copied`);
        } catch {
          toast.error("Could not copy to the clipboard");
        }
      }}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}

export function ModelsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Model | null>(null);
  const [publicName, setPublicName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [multiplier, setMultiplier] = useState("1.00");
  const [enabled, setEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toast = useToast();
  const catalogQuery = useModelCatalog(search);
  const availableQuery = useAvailableModels();
  const syncMutation = useSyncModels();
  const updateMutation = useUpdateModel();

  const openEditor = (model: Model) => {
    setEditing(model);
    setPublicName(model.public_name);
    setDisplayName(model.display_name);
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
          display_name: displayName.trim(),
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
                description="An administrator must enable models and grant them to your profile."
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Model catalog</h1>
          <p className="mt-1 text-sm text-muted">
            Synced from 9router. New models start disabled until an administrator enables them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search models…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56"
          />
          <Button onClick={runSync} loading={syncMutation.isPending}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Sync now
          </Button>
        </div>
      </div>

      {catalogQuery.data?.sync.last_successful_sync_at ? (
        <p className="text-xs text-muted">
          Last successful sync: {formatDateTime(catalogQuery.data.sync.last_successful_sync_at)}
        </p>
      ) : (
        <p className="text-xs text-warning">No successful sync yet. Configure the upstream key and run a sync.</p>
      )}

      <Card>
        <CardBody>
          {catalogQuery.isLoading ? <LoadingState /> : null}
          {catalogQuery.isError ? <ErrorState message="Could not load the catalog." onRetry={() => void catalogQuery.refetch()} /> : null}
          {catalogQuery.data && catalogQuery.data.models.length === 0 ? (
            <EmptyState title="No models in the catalog" description="Run a sync to import models from 9router." />
          ) : null}
          {catalogQuery.data && catalogQuery.data.models.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Public name</TH>
                  <TH>Display name</TH>
                  <TH>Provider</TH>
                  <TH>Multiplier</TH>
                  <TH>Status</TH>
                  <TH>Last sync</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {catalogQuery.data.models.map((model) => (
                  <TR key={model.id}>
                    <TD className="font-mono text-xs">{model.public_name}</TD>
                    <TD className="font-medium">{model.display_name}</TD>
                    <TD className="text-muted">{model.provider_label ?? "—"}</TD>
                    <TD>×{model.token_multiplier.toFixed(2)}</TD>
                    <TD>
                      {!model.is_available ? (
                        <Badge tone="danger">unavailable</Badge>
                      ) : model.is_enabled ? (
                        <Badge tone="success">enabled</Badge>
                      ) : (
                        <Badge>disabled</Badge>
                      )}
                    </TD>
                    <TD className="text-muted">{formatDateTime(model.last_synced_at)}</TD>
                    <TD>
                      <Button variant="ghost" size="sm" onClick={() => openEditor(model)} aria-label="Edit model">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>

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
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
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
            Enable this model for members
          </label>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
