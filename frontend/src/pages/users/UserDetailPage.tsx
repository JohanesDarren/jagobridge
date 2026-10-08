import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Trash2 } from "lucide-react";
import {
  useFeatures,
  useModelCatalog,
  useProfiles,
  useUserDetail,
  useUserMutations,
} from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { formatDateTime } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";
import type { OverrideEffect } from "../../types/overrides";

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const detailQuery = useUserDetail(id);
  const profilesQuery = useProfiles();
  const catalogQuery = useModelCatalog();
  const featuresQuery = useFeatures();
  const { update, resetPassword, remove, setModelAccess, setFeatureAccess } = useUserMutations();

  const [profileId, setProfileId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [limit5h, setLimit5h] = useState("");
  const [limitWeekly, setLimitWeekly] = useState("");
  const [limitRpm, setLimitRpm] = useState("");
  const [modelEffects, setModelEffects] = useState<Record<string, OverrideEffect>>({});
  const [featureEffects, setFeatureEffects] = useState<Record<string, OverrideEffect>>({});
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const data = detailQuery.data;
    if (!data) return;
    setProfileId(data.user.access_profile_id ?? "");
    setIsActive(data.user.is_active);
    setLimit5h(data.user.limit_5h_tokens_override?.toString() ?? "");
    setLimitWeekly(data.user.limit_weekly_tokens_override?.toString() ?? "");
    setLimitRpm(data.user.limit_rpm_override?.toString() ?? "");
    setModelEffects(
      Object.fromEntries(data.effective.model_overrides.map((row) => [row.model_id, row.effect])),
    );
    setFeatureEffects(
      Object.fromEntries(data.effective.feature_overrides.map((row) => [row.feature_id, row.effect])),
    );
  }, [detailQuery.data]);

  if (detailQuery.isLoading) return <LoadingState label="Loading user…" />;
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState message="Could not load this user." onRetry={() => void detailQuery.refetch()} />;
  }

  const { user, effective } = detailQuery.data;

  const parseOverride = (value: string): number | null => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const saveProfileAndLimits = async () => {
    try {
      await update.mutateAsync({
        id: user.id,
        patch: {
          access_profile_id: profileId || null,
          is_active: isActive,
          limit_5h_tokens_override: parseOverride(limit5h),
          limit_weekly_tokens_override: parseOverride(limitWeekly),
          limit_rpm_override: parseOverride(limitRpm),
        },
      });
      toast.success("User updated");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update the user.");
    }
  };

  const saveModelOverrides = async () => {
    const overrides = Object.entries(modelEffects).map(([modelId, effect]) => ({
      model_id: modelId,
      effect,
    }));
    try {
      await setModelAccess.mutateAsync({ id: user.id, overrides });
      toast.success("Model access updated");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update model access.");
    }
  };

  const saveFeatureOverrides = async () => {
    const overrides = Object.entries(featureEffects).map(([featureId, effect]) => ({
      feature_id: featureId,
      effect,
    }));
    try {
      await setFeatureAccess.mutateAsync({ id: user.id, overrides });
      toast.success("Feature access updated");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update feature access.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/users" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to users
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "active" : "inactive"}</Badge>
          <Badge tone={user.role === "admin" ? "primary" : "neutral"}>{user.role}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader title="Access and limits" description="Empty means inherit from the profile. 0 means unlimited." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="profile">Access profile</Label>
              <Select id="profile" value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                <option value="">None</option>
                {(profilesQuery.data ?? []).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Account active
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="limit-5h">5-hour override</Label>
              <Input id="limit-5h" type="number" min="0" value={limit5h} onChange={(event) => setLimit5h(event.target.value)} placeholder="inherit" />
            </div>
            <div>
              <Label htmlFor="limit-weekly">Weekly override</Label>
              <Input id="limit-weekly" type="number" min="0" value={limitWeekly} onChange={(event) => setLimitWeekly(event.target.value)} placeholder="inherit" />
            </div>
            <div>
              <Label htmlFor="limit-rpm">RPM override</Label>
              <Input id="limit-rpm" type="number" min="0" value={limitRpm} onChange={(event) => setLimitRpm(event.target.value)} placeholder="inherit" />
            </div>
          </div>

          <p className="text-xs text-muted">
            Effective limits: 5-hour {effective.limits.limit_5h_tokens}, weekly {effective.limits.limit_weekly_tokens},
            RPM {effective.limits.limit_rpm}. Last sign-in: {formatDateTime(user.last_login_at)}.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveProfileAndLimits} loading={update.isPending}>
              Save changes
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const result = await resetPassword.mutateAsync(user.id);
                  setTempPassword(result.temporary_password);
                } catch (caught) {
                  toast.error(caught instanceof ApiError ? caught.message : "Could not reset the password.");
                }
              }}
              loading={resetPassword.isPending}
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              Reset password
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete user
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Model overrides" description="Per-user allow or deny wins over the profile." />
        <CardBody className="space-y-3">
          <Table>
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Effect</TH>
              </TR>
            </THead>
            <TBody>
              {(catalogQuery.data?.models ?? []).map((model) => (
                <TR key={model.id}>
                  <TD className="font-mono text-xs">{model.public_name}</TD>
                  <TD>
                    <Select
                      value={modelEffects[model.id] ?? "inherit"}
                      onChange={(event) => {
                        const value = event.target.value as OverrideEffect;
                        setModelEffects((current) => {
                          const next = { ...current };
                          if (value === "inherit") delete next[model.id];
                          else next[model.id] = value;
                          return next;
                        });
                      }}
                      className="max-w-[160px]"
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </Select>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Button onClick={saveModelOverrides} loading={setModelAccess.isPending} size="sm">
            Save model overrides
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Feature overrides" />
        <CardBody className="space-y-3">
          <Table>
            <THead>
              <TR>
                <TH>Feature</TH>
                <TH>Effect</TH>
              </TR>
            </THead>
            <TBody>
              {(featuresQuery.data ?? []).map((feature) => (
                <TR key={feature.id}>
                  <TD className="font-medium">{feature.name}</TD>
                  <TD>
                    <Select
                      value={featureEffects[feature.id] ?? "inherit"}
                      onChange={(event) => {
                        const value = event.target.value as OverrideEffect;
                        setFeatureEffects((current) => {
                          const next = { ...current };
                          if (value === "inherit") delete next[feature.id];
                          else next[feature.id] = value;
                          return next;
                        });
                      }}
                      className="max-w-[160px]"
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </Select>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Button onClick={saveFeatureOverrides} loading={setFeatureAccess.isPending} size="sm">
            Save feature overrides
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={tempPassword !== null}
        title="Temporary password"
        onClose={() => setTempPassword(null)}
        footer={<Button onClick={() => setTempPassword(null)}>Done</Button>}
      >
        <p className="text-sm text-muted">Share this with the user securely. It will not be shown again.</p>
        <code className="mt-3 block rounded-md bg-surface px-3 py-2 font-mono text-sm">{tempPassword}</code>
      </Modal>

      <Modal
        open={confirmDelete}
        title="Delete user"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(user.id);
                  toast.success("User deleted");
                  navigate("/users");
                } catch (caught) {
                  toast.error(caught instanceof ApiError ? caught.message : "Could not delete the user.");
                }
              }}
            >
              Delete {user.name}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This soft-deletes the account, revokes API keys, and anonymizes personal data. Usage history is kept with an
          anonymized reference.
        </p>
      </Modal>
    </div>
  );
}
