import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFeatures, useModelCatalog, useProfile, useProfileMutations, useProfiles } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { formatTokens } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Textarea } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

export function AccessProfilesPage() {
  const toast = useToast();
  const profilesQuery = useProfiles();
  const catalogQuery = useModelCatalog();
  const featuresQuery = useFeatures();
  const { create, update, setModels, setFeatures, remove } = useProfileMutations();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const detailQuery = useProfile(editingId ?? undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowAll, setAllowAll] = useState(false);
  const [limit5h, setLimit5h] = useState("");
  const [limitWeekly, setLimitWeekly] = useState("");
  const [limitRpm, setLimitRpm] = useState("");
  const [maxOutput, setMaxOutput] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    setName(detail.name);
    setDescription(detail.description ?? "");
    setAllowAll(detail.allow_all_models);
    setLimit5h(String(detail.limit_5h_tokens));
    setLimitWeekly(String(detail.limit_weekly_tokens));
    setLimitRpm(String(detail.limit_rpm));
    setMaxOutput(String(detail.max_output_tokens_per_request));
    setIsDefault(detail.is_default);
    setSelectedModels(detail.model_ids ?? []);
    setSelectedFeatures(detail.feature_ids ?? []);
  }, [detailQuery.data]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setAllowAll(false);
    setLimit5h("0");
    setLimitWeekly("0");
    setLimitRpm("0");
    setMaxOutput("0");
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
      description: description.trim() || null,
      allow_all_models: allowAll,
      limit_5h_tokens: Number(limit5h) || 0,
      limit_weekly_tokens: Number(limitWeekly) || 0,
      limit_rpm: Number(limitRpm) || 0,
      max_output_tokens_per_request: Number(maxOutput) || 0,
      is_default: isDefault,
    };
    try {
      const profile = editingId
        ? await update.mutateAsync({ id: editingId, patch: payload })
        : await create.mutateAsync(payload);
      await setModels.mutateAsync({
        id: profile.id,
        allow_all_models: allowAll,
        model_ids: selectedModels,
      });
      await setFeatures.mutateAsync({ id: profile.id, feature_ids: selectedFeatures });
      toast.success(editingId ? "Profile updated" : "Profile created");
      setEditorOpen(false);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the profile.");
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Profile deleted");
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Could not delete the profile.";
      toast.error(
        caught instanceof ApiError && caught.code === "PROFILE_IN_USE"
          ? `${message} Reassign its users first.`
          : message,
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Access profiles</h1>
          <p className="mt-1 text-sm text-muted">
            Reusable bundles of models, features, and limits. Changes apply within 60 seconds.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New profile
        </Button>
      </div>

      <Card>
        <CardBody>
          {profilesQuery.isLoading ? <LoadingState /> : null}
          {profilesQuery.isError ? <ErrorState message="Could not load profiles." onRetry={() => void profilesQuery.refetch()} /> : null}
          {profilesQuery.data && profilesQuery.data.length === 0 ? (
            <EmptyState title="No profiles yet" description="Create a profile to assign to your team." />
          ) : null}
          {profilesQuery.data && profilesQuery.data.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Models</TH>
                  <TH className="text-right">5-hour</TH>
                  <TH className="text-right">Weekly</TH>
                  <TH className="text-right">RPM</TH>
                  <TH className="text-right">Users</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {profilesQuery.data.map((profile) => (
                  <TR key={profile.id}>
                    <TD>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => openEdit(profile.id)}
                      >
                        {profile.name}
                      </button>
                      {profile.is_default ? (
                        <span className="ml-2">
                          <Badge tone="primary">default</Badge>
                        </span>
                      ) : null}
                    </TD>
                    <TD>{profile.allow_all_models ? "All" : "Selected"}</TD>
                    <TD className="text-right">{formatTokens(profile.limit_5h_tokens)}</TD>
                    <TD className="text-right">{formatTokens(profile.limit_weekly_tokens)}</TD>
                    <TD className="text-right">{profile.limit_rpm === 0 ? "∞" : profile.limit_rpm}</TD>
                    <TD className="text-right">{profile.user_count ?? 0}</TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${profile.name}`}
                          onClick={() => void deleteProfile(profile.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={editorOpen}
        title={editingId ? "Edit access profile" : "New access profile"}
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={create.isPending || update.isPending} disabled={name.trim().length === 0}>
              Save profile
            </Button>
          </>
        }
      >
        {editingId && detailQuery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="profile-desc">Description</Label>
              <Textarea id="profile-desc" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-5h">5-hour limit (0 = unlimited)</Label>
                <Input id="p-5h" type="number" min="0" value={limit5h} onChange={(event) => setLimit5h(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-weekly">Weekly limit (0 = unlimited)</Label>
                <Input id="p-weekly" type="number" min="0" value={limitWeekly} onChange={(event) => setLimitWeekly(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-rpm">RPM (0 = unlimited)</Label>
                <Input id="p-rpm" type="number" min="0" value={limitRpm} onChange={(event) => setLimitRpm(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-max">Max output per request (0 = provider default)</Label>
                <Input id="p-max" type="number" min="0" value={maxOutput} onChange={(event) => setMaxOutput(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowAll} onChange={(event) => setAllowAll(event.target.checked)} />
                Allow all models (overrides the list below)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
                Make this the default profile
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
                            event.target.checked ? [...current, model.id] : current.filter((id) => id !== model.id),
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
    </div>
  );
}
