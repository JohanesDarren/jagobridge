import { useEffect, useState } from "react";
import { Check, Copy, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useFeatures, useModelCatalog, useProfile, useProfileMutations, useProfiles } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { formatPrice, formatRateLimit, formatTokens, tokensToIdr } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Select, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import type { AccessProfile, OverageAction } from "../../types/api";

const OVERAGE_LABEL: Record<OverageAction, string> = {
  cutoff: "AUTO CUT-OFF",
  allow: "ALLOW OVERAGE",
};

export function PackagesPage() {
  const toast = useToast();
  const profilesQuery = useProfiles();
  const catalogQuery = useModelCatalog();
  const featuresQuery = useFeatures();
  const { create, update, setModels, setFeatures, remove } = useProfileMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const detailQuery = useProfile(editingId ?? undefined);

  const [name, setName] = useState("");
  const [tierLabel, setTierLabel] = useState("");
  const [description, setDescription] = useState("");
  const [priceIdr, setPriceIdr] = useState("0");
  const [allowAll, setAllowAll] = useState(false);
  const [limit5h, setLimit5h] = useState("");
  const [limitWeekly, setLimitWeekly] = useState("");
  const [limitRpm, setLimitRpm] = useState("");
  const [maxOutput, setMaxOutput] = useState("");
  const [overageAction, setOverageAction] = useState<OverageAction>("cutoff");
  const [isDefault, setIsDefault] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccessProfile | null>(null);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    setName(detail.name);
    setTierLabel(detail.tier_label ?? "");
    setDescription(detail.description ?? "");
    setPriceIdr(String(detail.price_idr));
    setAllowAll(detail.allow_all_models);
    setLimit5h(String(detail.limit_5h_tokens));
    setLimitWeekly(String(detail.limit_weekly_tokens));
    setLimitRpm(String(detail.limit_rpm));
    setMaxOutput(String(detail.max_output_tokens_per_request));
    setOverageAction(detail.overage_action);
    setIsDefault(detail.is_default);
    setSelectedModels(detail.model_ids ?? []);
    setSelectedFeatures(detail.feature_ids ?? []);
  }, [detailQuery.data]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setTierLabel("");
    setDescription("");
    setPriceIdr("0");
    setAllowAll(false);
    setLimit5h("0");
    setLimitWeekly("0");
    setLimitRpm("0");
    setMaxOutput("0");
    setOverageAction("cutoff");
    setIsDefault(false);
    setSelectedModels([]);
    setSelectedFeatures([]);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    setError(null);
    const payload = {
      name: name.trim(),
      tier_label: tierLabel.trim() || null,
      description: description.trim() || null,
      price_idr: Number(priceIdr) || 0,
      allow_all_models: allowAll,
      limit_5h_tokens: Number(limit5h) || 0,
      limit_weekly_tokens: Number(limitWeekly) || 0,
      limit_rpm: Number(limitRpm) || 0,
      max_output_tokens_per_request: Number(maxOutput) || 0,
      overage_action: overageAction,
      is_default: isDefault,
    };
    try {
      const profile = editingId
        ? await update.mutateAsync({ id: editingId, patch: payload })
        : await create.mutateAsync(payload);
      await setModels.mutateAsync({ id: profile.id, allow_all_models: allowAll, model_ids: selectedModels });
      await setFeatures.mutateAsync({ id: profile.id, feature_ids: selectedFeatures });
      toast.success(editingId ? "Package updated" : "Package created");
      setEditorOpen(false);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the package.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success("Package deleted");
      setPendingDelete(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Could not delete the package.";
      toast.error(
        caught instanceof ApiError && caught.code === "PROFILE_IN_USE"
          ? `${message} Reassign its clients first.`
          : message,
      );
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Package ID copied");
    } catch {
      toast.error("Could not copy the ID");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Package management</h1>
              <p className="mt-1 text-sm text-muted">
                Available API packages — each sets quotas and rate limits for its clients.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add package
          </Button>
        </CardBody>
      </Card>

      {profilesQuery.isLoading ? <LoadingState label="Loading packages…" /> : null}
      {profilesQuery.isError ? (
        <ErrorState message="Could not load packages." onRetry={() => void profilesQuery.refetch()} />
      ) : null}
      {profilesQuery.data && profilesQuery.data.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No packages yet"
              description="Create a package to start assigning quotas to your clients."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add package
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : null}

      {profilesQuery.data && profilesQuery.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {profilesQuery.data.map((profile) => (
            <PackageCard
              key={profile.id}
              profile={profile}
              onEdit={() => openEdit(profile.id)}
              onDelete={() => setPendingDelete(profile)}
              onCopyId={() => void copyId(profile.id)}
            />
          ))}
        </div>
      ) : null}

      <Modal
        open={editorOpen}
        title={editingId ? "Edit package" : "New package"}
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              loading={create.isPending || update.isPending || setModels.isPending || setFeatures.isPending}
              disabled={name.trim().length === 0}
            >
              Save package
            </Button>
          </>
        }
      >
        {editingId && detailQuery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pkg-name">Name</Label>
                <Input id="pkg-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="pkg-tier">Tier label</Label>
                <Input
                  id="pkg-tier"
                  value={tierLabel}
                  placeholder="Tingkat Gratis"
                  onChange={(event) => setTierLabel(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pkg-desc">Description</Label>
              <Textarea
                id="pkg-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pkg-price">Price per month (IDR)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  value={priceIdr}
                  onChange={(event) => setPriceIdr(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pkg-rpm">Rate limit (req/min, 0 = unlimited)</Label>
                <Input
                  id="pkg-rpm"
                  type="number"
                  min="0"
                  value={limitRpm}
                  onChange={(event) => setLimitRpm(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pkg-5h">5-hour quota (tokens, 0 = unlimited)</Label>
                <Input
                  id="pkg-5h"
                  type="number"
                  min="0"
                  value={limit5h}
                  onChange={(event) => setLimit5h(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pkg-weekly">Weekly quota (tokens, 0 = unlimited)</Label>
                <Input
                  id="pkg-weekly"
                  type="number"
                  min="0"
                  value={limitWeekly}
                  onChange={(event) => setLimitWeekly(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pkg-max">Max output per request (0 = provider default)</Label>
                <Input
                  id="pkg-max"
                  type="number"
                  min="0"
                  value={maxOutput}
                  onChange={(event) => setMaxOutput(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pkg-overage">Overage</Label>
                <Select
                  id="pkg-overage"
                  value={overageAction}
                  onChange={(event) => setOverageAction(event.target.value as OverageAction)}
                >
                  <option value="cutoff">Auto cut-off</option>
                  <option value="allow">Allow overage</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowAll} onChange={(event) => setAllowAll(event.target.checked)} />
                Allow all models (overrides the list below)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                />
                Make this the default package
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Entitled features</p>
              <div className="grid grid-cols-2 gap-2">
                {(featuresQuery.data ?? []).map((feature) => (
                  <label key={feature.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(feature.id)}
                      onChange={(event) =>
                        setSelectedFeatures((current) =>
                          event.target.checked
                            ? [...current, feature.id]
                            : current.filter((id) => id !== feature.id),
                        )
                      }
                    />
                    {feature.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Allowed models</p>
              {allowAll ? (
                <p className="text-xs text-muted">All enabled and available models are allowed.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(catalogQuery.data?.models ?? []).map((model) => (
                    <label key={model.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.id)}
                        onChange={(event) =>
                          setSelectedModels((current) =>
                            event.target.checked
                              ? [...current, model.id]
                              : current.filter((id) => id !== model.id),
                          )
                        }
                      />
                      <span className="font-mono text-xs">{model.public_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
        )}
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title="Delete package"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={confirmDelete}>
              Delete {pendingDelete?.name}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Packages that still have clients assigned cannot be deleted. Reassign those clients first.
        </p>
      </Modal>
    </div>
  );
}

function PackageCard({
  profile,
  onEdit,
  onDelete,
  onCopyId,
}: {
  profile: AccessProfile;
  onEdit: () => void;
  onDelete: () => void;
  onCopyId: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const weeklyQuotaIdr = tokensToIdr(profile.limit_weekly_tokens);

  return (
    <Card className={cn("relative flex flex-col", profile.is_default && "ring-2 ring-primary")}>
      {profile.is_default ? (
        <span className="absolute -top-2 right-4">
          <Badge tone="primary">default</Badge>
        </span>
      ) : null}
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{profile.name}</h2>
              {profile.tier_label ? <Badge tone="neutral">{profile.tier_label}</Badge> : null}
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted">
              ID: {profile.id.slice(0, 8)}
              <button
                type="button"
                aria-label="Copy package ID"
                className="rounded p-0.5 hover:text-foreground"
                onClick={() => {
                  onCopyId();
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {profile.description ? (
          <p className="text-sm text-muted">{profile.description}</p>
        ) : null}

        <dl className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Price</dt>
            <dd className="font-medium">
              {formatPrice(profile.price_idr)}
              <span className="text-xs text-muted"> / month</span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Rate limit</dt>
            <dd className="font-medium">{formatRateLimit(profile.limit_rpm)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Overage</dt>
            <dd>
              <Badge tone={profile.overage_action === "cutoff" ? "danger" : "warning"}>
                {OVERAGE_LABEL[profile.overage_action]}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Clients</dt>
            <dd className="font-medium">{profile.user_count ?? 0}</dd>
          </div>
        </dl>

        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Allowed models</p>
          {profile.allow_all_models ? (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <Check className="mt-0.5 h-4 w-4 text-success" aria-hidden />
              <div>
                <p className="text-sm font-medium text-success">Unlimited access</p>
                <p className="text-xs uppercase text-success">All models (*)</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                {profile.model_ids?.length ?? 0} models selected
              </p>
              <p className="text-xs text-muted">
                Weekly quota {formatTokens(profile.limit_weekly_tokens)}
                {profile.limit_weekly_tokens > 0 ? ` · ${formatPrice(weeklyQuotaIdr)}` : ""}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto flex justify-end gap-1 border-t border-border pt-3">
          <Button variant="ghost" size="sm" aria-label={`Edit ${profile.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${profile.name}`} onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
