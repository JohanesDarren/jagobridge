import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useApiKeyMutations, useApiKeys } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { formatDateTime, formatRelative } from "../../lib/format";
import type { CreatedApiKey } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

export function ApiKeysPage() {
  const toast = useToast();
  const keysQuery = useApiKeys();
  const { create, revoke } = useApiKeyMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string; name: string } | null>(null);

  const submitCreate = async () => {
    setError(null);
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setCreated(result);
      setCreateOpen(false);
      setName("");
      setExpiresAt("");
      toast.success("API key created");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create the key.");
    }
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke) return;
    try {
      await revoke.mutateAsync(pendingRevoke.id);
      toast.success("API key revoked");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not revoke the key.");
    } finally {
      setPendingRevoke(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">API keys</h1>
          <p className="mt-1 text-sm text-muted">
            Keys are shown once. Store them securely — only a hash and prefix are kept. Maximum 10 active keys.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create key
        </Button>
      </div>

      <Card>
        <CardHeader title="Your keys" />
        <CardBody>
          {keysQuery.isLoading ? <LoadingState /> : null}
          {keysQuery.isError ? <ErrorState message="Could not load your keys." onRetry={() => void keysQuery.refetch()} /> : null}
          {keysQuery.data && keysQuery.data.length === 0 ? (
            <EmptyState title="No API keys yet" description="Create a key to call the gateway from your tools." />
          ) : null}
          {keysQuery.data && keysQuery.data.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Prefix</TH>
                  <TH>Created</TH>
                  <TH>Last used</TH>
                  <TH>Expires</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {keysQuery.data.map((key) => (
                  <TR key={key.id}>
                    <TD className="font-medium">{key.name}</TD>
                    <TD className="font-mono text-xs">{key.key_prefix}…</TD>
                    <TD className="text-muted">{formatDateTime(key.created_at)}</TD>
                    <TD className="text-muted">{formatRelative(key.last_used_at)}</TD>
                    <TD className="text-muted">{formatDateTime(key.expires_at)}</TD>
                    <TD>
                      <Badge tone={key.status === "active" ? "success" : key.status === "expired" ? "warning" : "neutral"}>
                        {key.status}
                      </Badge>
                    </TD>
                    <TD>
                      {key.status === "active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingRevoke({ id: key.id, name: key.name })}
                          aria-label={`Revoke ${key.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        title="Create an API key"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate} loading={create.isPending} disabled={name.trim().length === 0}>
              Create key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="laptop-ide"
            />
          </div>
          <div>
            <Label htmlFor="key-expiry">Expiry (optional)</Label>
            <Input
              id="key-expiry"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
            <p className="mt-1 text-xs text-muted">Leave empty for no expiry. Maximum 1 year from now.</p>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={created !== null}
        title="Copy your API key now"
        onClose={() => setCreated(null)}
        footer={
          <Button onClick={() => setCreated(null)}>Done</Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            This key will not be shown again. Copy it and store it securely.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-sm">
              {created?.key}
            </code>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!created) return;
                try {
                  await navigator.clipboard.writeText(created.key);
                  toast.success("Key copied");
                } catch {
                  toast.error("Could not copy to the clipboard");
                }
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={pendingRevoke !== null}
        title="Revoke API key"
        onClose={() => setPendingRevoke(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRevoke(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRevoke} loading={revoke.isPending}>
              Revoke key
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Revoke <strong>{pendingRevoke?.name}</strong>? Any tool using it will immediately stop working. This cannot
          be undone.
        </p>
      </Modal>
    </div>
  );
}
