import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Eye,
  History,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import {
  useInvitationMutations,
  useInvitations,
  useProfiles,
  useUsageEvents,
  useUserMutations,
  useUsers,
} from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { formatDateTime, formatIdr, formatNumber, formatRelative, formatTokens, percent, tokensToIdr } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";
import type { User } from "../../types/api";

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [profileId, setProfileId] = useState("");
  const [page, setPage] = useState(1);

  const usersQuery = useUsers({ search, status, profileId, page, limit: 20 });
  const invitationsQuery = useInvitations();
  const profilesQuery = useProfiles();
  const { create, resend, revoke } = useInvitationMutations();
  const { update, remove } = useUserMutations();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteProfileId, setInviteProfileId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [historyUser, setHistoryUser] = useState<User | null>(null);

  const historyQuery = useUsageEvents({ user_id: historyUser?.id, limit: 10, page: 1 });

  const syncUsers = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await usersQuery.refetch();
      toast.success("Client data refreshed");
    } catch {
      toast.error("Could not refresh clients");
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await update.mutateAsync({ id: user.id, patch: { is_active: !user.is_active } });
      toast.success(user.is_active ? "Client deactivated" : "Client activated");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update the client.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success("Client deleted");
      setPendingDelete(null);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete the client.");
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Client ID copied");
    } catch {
      toast.error("Could not copy the ID");
    }
  };

  const submitInvite = async () => {
    setError(null);
    try {
      await create.mutateAsync({ email: email.trim(), role: inviteRole, access_profile_id: inviteProfileId });
      toast.success("Invitation sent");
      setInviteOpen(false);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not send the invitation.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Client management</h1>
              <p className="mt-1 text-sm text-muted">
                Manage client applications and the API keys that access JagoBridge.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="border-green-200 bg-green-50 text-success hover:bg-green-100"
              onClick={() => void syncUsers()}
            >
              <RefreshCw className={cn("h-4 w-4", usersQuery.isFetching && "animate-spin")} aria-hidden />
              Sync users
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add client
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="user-search">Search</Label>
            <Input
              id="user-search"
              placeholder="Name or email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="user-status">Status</Label>
            <Select id="user-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="user-package">Package</Label>
            <Select
              id="user-package"
              value={profileId}
              onChange={(event) => {
                setProfileId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {(profilesQuery.data ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clients"
          description={usersQuery.data ? `${usersQuery.data.meta.total} clients` : undefined}
        />
        <CardBody>
          {usersQuery.isLoading ? <LoadingState label="Loading clients…" /> : null}
          {usersQuery.isError ? (
            <ErrorState message="Could not load clients." onRetry={() => void usersQuery.refetch()} />
          ) : null}
          {usersQuery.data && usersQuery.data.users.length === 0 ? (
            <EmptyState title="No clients found" description="Adjust the filters or add a client." />
          ) : null}
          {usersQuery.data && usersQuery.data.users.length > 0 ? (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Client name</TH>
                    <TH>Package</TH>
                    <TH>Status</TH>
                    <TH className="min-w-[240px]">Quota usage</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {usersQuery.data.users.map((user) => (
                    <TR key={user.id}>
                      <TD>
                        <Link to={`/users/${user.id}`} className="font-medium text-foreground hover:text-primary">
                          {user.name}
                        </Link>
                        <p className="text-xs text-muted">{user.email}</p>
                        <IdChip id={user.id} onCopy={() => void copyId(user.id)} />
                      </TD>
                      <TD>
                        {user.access_profile_name ? (
                          <Badge tone="primary">{user.access_profile_name.toUpperCase()}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={user.is_active ? "success" : "neutral"}>
                          {user.is_active ? "AKTIF" : "INAKTIF"}
                        </Badge>
                      </TD>
                      <TD>
                        <QuotaCell user={user} />
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            to={`/users/${user.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-surface"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </Link>
                          <Link
                            to={`/users/${user.id}`}
                            aria-label={`Edit ${user.name}`}
                            className="inline-flex h-8 items-center justify-center rounded-md px-2 text-foreground hover:bg-surface"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <Button variant="ghost" size="sm" aria-label={`Sync ${user.name}`} onClick={() => void usersQuery.refetch()}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={user.is_active ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                            onClick={() => void toggleActive(user)}
                          >
                            <Power className={cn("h-4 w-4", user.is_active ? "text-success" : "text-muted")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`History for ${user.name}`}
                            onClick={() => setHistoryUser(user)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${user.name}`}
                            onClick={() => setPendingDelete(user)}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {usersQuery.data.meta.total_pages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                  <span>
                    Page {usersQuery.data.meta.page} of {usersQuery.data.meta.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!usersQuery.data.meta.has_prev}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!usersQuery.data.meta.has_next}
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

      <Card>
        <CardHeader title="Pending invitations" />
        <CardBody>
          {invitationsQuery.isLoading ? <LoadingState /> : null}
          {invitationsQuery.data && invitationsQuery.data.length === 0 ? (
            <EmptyState title="No pending invitations" />
          ) : null}
          {invitationsQuery.data && invitationsQuery.data.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Expires</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {invitationsQuery.data.map((invitation) => (
                  <TR key={invitation.id}>
                    <TD className="font-medium">{invitation.email}</TD>
                    <TD>{invitation.role}</TD>
                    <TD className="text-muted">{formatDateTime(invitation.expires_at)}</TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Resend invitation"
                          onClick={async () => {
                            try {
                              const result = await resend.mutateAsync(invitation.id);
                              if (result.invite_url) {
                                await navigator.clipboard.writeText(result.invite_url).catch(() => undefined);
                                toast.success("Invitation resent. Link copied.");
                              } else {
                                toast.success("Invitation resent");
                              }
                            } catch (caught) {
                              toast.error(caught instanceof ApiError ? caught.message : "Could not resend");
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Revoke invitation"
                          onClick={async () => {
                            try {
                              await revoke.mutateAsync(invitation.id);
                              toast.success("Invitation revoked");
                            } catch (caught) {
                              toast.error(caught instanceof ApiError ? caught.message : "Could not revoke");
                            }
                          }}
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
        open={inviteOpen}
        title="Add a client"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitInvite}
              loading={create.isPending}
              disabled={email.trim().length === 0 || inviteProfileId === ""}
            >
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="new@team.example"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="invite-profile">Package</Label>
            <Select
              id="invite-profile"
              value={inviteProfileId}
              onChange={(event) => setInviteProfileId(event.target.value)}
            >
              <option value="">Select a package…</option>
              {(profilesQuery.data ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.is_default ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-xs text-muted">The invitation link is valid for 72 hours and can be used once.</p>
        </div>
      </Modal>

      <Modal
        open={historyUser !== null}
        title={`History — ${historyUser?.name ?? ""}`}
        onClose={() => setHistoryUser(null)}
        footer={
          <Button variant="secondary" onClick={() => setHistoryUser(null)}>
            Close
          </Button>
        }
      >
        {historyQuery.isLoading ? <LoadingState label="Loading history…" /> : null}
        {historyQuery.data && historyQuery.data.events.length === 0 ? (
          <EmptyState title="No requests recorded yet" />
        ) : null}
        {historyQuery.data && historyQuery.data.events.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Model</TH>
                <TH className="text-right">Weighted</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {historyQuery.data.events.map((event) => (
                <TR key={event.id}>
                  <TD className="whitespace-nowrap text-muted">{formatRelative(event.created_at)}</TD>
                  <TD className="font-medium">{event.model_public_name}</TD>
                  <TD className="text-right">{formatNumber(event.weighted_tokens)}</TD>
                  <TD>
                    <Badge tone={event.status === "success" ? "success" : "danger"}>{event.status}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : null}
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title="Delete client"
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
          This soft-deletes the account, revokes its API keys, and anonymizes personal data. Usage history is kept with
          an anonymized reference.
        </p>
      </Modal>
    </div>
  );
}

function IdChip({ id, onCopy }: { id: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted">
      ID: {id.slice(0, 12)}
      <button
        type="button"
        aria-label="Copy client ID"
        className="rounded p-0.5 hover:text-foreground"
        onClick={() => {
          onCopy();
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function QuotaCell({ user }: { user: User }) {
  const weekly = user.usage?.weekly;
  const fiveHour = user.usage?.five_hour;
  if (!weekly || weekly.limit_tokens <= 0) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Unlimited</p>
        <p className="text-xs text-muted">
          {formatTokens(weekly?.used_tokens ?? 0)} token used{fiveHour ? " (5h)" : ""}
        </p>
      </div>
    );
  }

  const usedPct = percent(weekly.used_tokens, weekly.limit_tokens);
  const barTone = usedPct >= 100 ? "bg-danger" : usedPct >= 80 ? "bg-warning" : "bg-primary";

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">
        {formatIdr(tokensToIdr(weekly.used_tokens))}
        <span className="font-normal text-muted"> / {formatIdr(tokensToIdr(weekly.limit_tokens))}</span>
      </p>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Zap className="h-3 w-3 text-success" aria-hidden />
        <span>
          {formatNumber(weekly.used_tokens)} / {formatNumber(weekly.limit_tokens)} token
        </span>
        <span className="rounded border border-border bg-surface px-1 py-0.5 font-medium text-foreground">
          {formatTokens(weekly.limit_tokens)} token
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={usedPct}>
        <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${usedPct}%` }} />
      </div>
    </div>
  );
}
