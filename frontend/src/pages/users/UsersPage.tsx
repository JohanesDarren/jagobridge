import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useInvitationMutations, useInvitations, useProfiles, useUsers } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { formatDateTime, formatRelative } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

export function UsersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const usersQuery = useUsers({ search, status, role, page, limit: 20 });
  const invitationsQuery = useInvitations();
  const profilesQuery = useProfiles();
  const { create, resend, revoke } = useInvitationMutations();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [profileId, setProfileId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitInvite = async () => {
    setError(null);
    try {
      await create.mutateAsync({ email: email.trim(), role: inviteRole, access_profile_id: profileId });
      toast.success("Invitation sent");
      setInviteOpen(false);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not send the invitation.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-muted">Manage the team roster, profiles, and access.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Invite user
        </Button>
      </div>

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
            <Label htmlFor="user-role">Role</Label>
            <Select id="user-role" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Team members"
          description={usersQuery.data ? `${usersQuery.data.meta.total} users` : undefined}
        />
        <CardBody>
          {usersQuery.isLoading ? <LoadingState /> : null}
          {usersQuery.isError ? <ErrorState message="Could not load users." onRetry={() => void usersQuery.refetch()} /> : null}
          {usersQuery.data && usersQuery.data.users.length === 0 ? (
            <EmptyState title="No users found" description="Adjust the filters or invite someone." />
          ) : null}
          {usersQuery.data && usersQuery.data.users.length > 0 ? (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH>Profile</TH>
                    <TH>Status</TH>
                    <TH>Last sign-in</TH>
                  </TR>
                </THead>
                <TBody>
                  {usersQuery.data.users.map((user) => (
                    <TR key={user.id}>
                      <TD>
                        <Link to={`/users/${user.id}`} className="font-medium text-primary hover:underline">
                          {user.name}
                        </Link>
                      </TD>
                      <TD className="text-muted">{user.email}</TD>
                      <TD>{user.role}</TD>
                      <TD>{user.access_profile_name ?? "—"}</TD>
                      <TD>
                        <Badge tone={user.is_active ? "success" : "neutral"}>
                          {user.is_active ? "active" : "inactive"}
                        </Badge>
                      </TD>
                      <TD className="text-muted">{formatRelative(user.last_login_at)}</TD>
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
        title="Invite a team member"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitInvite}
              loading={create.isPending}
              disabled={email.trim().length === 0 || profileId === ""}
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
            <Label htmlFor="invite-profile">Access profile</Label>
            <Select id="invite-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">Select a profile…</option>
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
    </div>
  );
}
