import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, buildQuery } from "../lib/api-client";
import type {
  AccessProfile,
  ApiKey,
  AuditLogEntry,
  ConnectionTest,
  CreatedApiKey,
  Feature,
  Invitation,
  Model,
  ModelCatalogResponse,
  PaginatedEnvelope,
  Settings,
  SuccessEnvelope,
  SyncResult,
  UsageEvent,
  UsageStats,
  User,
  UserDetail,
} from "../types/api";

// ------------------------------------------------------------------ models
export function useModelCatalog(search?: string) {
  return useQuery({
    queryKey: ["models", "catalog", search ?? ""],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<ModelCatalogResponse>>(
        `/models${buildQuery({ search })}`,
      );
      return response.data;
    },
  });
}

export function useAvailableModels() {
  return useQuery({
    queryKey: ["models", "available"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<Model[]>>("/models/available");
      return response.data;
    },
  });
}

export function useSyncModels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest<SuccessEnvelope<SyncResult>>("/models/sync", { method: "POST" });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Record<string, unknown> }) => {
      const response = await apiRequest<SuccessEnvelope<Model>>(`/models/${input.id}`, {
        method: "PATCH",
        body: input.patch,
      });
      return response.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["models"] }),
  });
}

// ---------------------------------------------------------------- features
export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<Feature[]>>("/features");
      return response.data;
    },
  });
}

export function useUpdateFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_enabled: boolean }) => {
      const response = await apiRequest<SuccessEnvelope<Feature>>(`/features/${input.id}`, {
        method: "PATCH",
        body: { is_enabled: input.is_enabled },
      });
      return response.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["features"] }),
  });
}

// ----------------------------------------------------------------- profiles
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile[]>>("/access-profiles");
      return response.data;
    },
  });
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["profiles", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile>>(`/access-profiles/${id}`);
      return response.data;
    },
  });
}

export function useProfileMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["profiles"] });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile>>("/access-profiles", {
        method: "POST",
        body,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: Record<string, unknown> }) => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile>>(
        `/access-profiles/${input.id}`,
        { method: "PATCH", body: input.patch },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const setModels = useMutation({
    mutationFn: async (input: { id: string; allow_all_models: boolean; model_ids: string[] }) => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile>>(
        `/access-profiles/${input.id}/models`,
        { method: "PUT", body: { allow_all_models: input.allow_all_models, model_ids: input.model_ids } },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const setFeatures = useMutation({
    mutationFn: async (input: { id: string; feature_ids: string[] }) => {
      const response = await apiRequest<SuccessEnvelope<AccessProfile>>(
        `/access-profiles/${input.id}/features`,
        { method: "PUT", body: { feature_ids: input.feature_ids } },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/access-profiles/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { create, update, setModels, setFeatures, remove };
}

// -------------------------------------------------------------------- users
export function useUsers(filters: {
  search?: string;
  status?: string;
  role?: string;
  profileId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: async () => {
      const response = await apiRequest<PaginatedEnvelope<User>>(`/users${buildQuery(filters)}`);
      return { users: response.data, meta: response.meta };
    },
  });
}

export function useUserDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["users", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<UserDetail>>(`/users/${id}`);
      return response.data;
    },
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["users"] });

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: Record<string, unknown> }) => {
      const response = await apiRequest<SuccessEnvelope<User>>(`/users/${input.id}`, {
        method: "PATCH",
        body: input.patch,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const resetPassword = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest<SuccessEnvelope<{ temporary_password: string }>>(
        `/users/${id}/reset-password`,
        { method: "POST" },
      );
      return response.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/users/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  const setModelAccess = useMutation({
    mutationFn: async (input: { id: string; overrides: Array<{ model_id: string; effect: string }> }) => {
      await apiRequest(`/users/${input.id}/model-access`, { method: "PUT", body: { overrides: input.overrides } });
    },
    onSuccess: invalidate,
  });

  const setFeatureAccess = useMutation({
    mutationFn: async (input: { id: string; overrides: Array<{ feature_id: string; effect: string }> }) => {
      await apiRequest(`/users/${input.id}/feature-access`, {
        method: "PUT",
        body: { overrides: input.overrides },
      });
    },
    onSuccess: invalidate,
  });

  return { update, resetPassword, remove, setModelAccess, setFeatureAccess };
}

export function useInvitations() {
  return useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<Invitation[]>>("/users/invitations");
      return response.data;
    },
  });
}

export function useInvitationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["invitations"] });

  const create = useMutation({
    mutationFn: async (body: { email: string; role: string; access_profile_id: string }) => {
      const response = await apiRequest<SuccessEnvelope<Invitation>>("/users/invitations", {
        method: "POST",
        body,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const resend = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest<SuccessEnvelope<Invitation>>(`/users/invitations/${id}/resend`, {
        method: "POST",
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/users/invitations/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { create, resend, revoke };
}

// ---------------------------------------------------------------- api keys
export function useApiKeys(userId?: string) {
  return useQuery({
    queryKey: ["api-keys", userId ?? "me"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<ApiKey[]>>(`/api-keys${buildQuery({ user_id: userId })}`);
      return response.data;
    },
  });
}

export function useApiKeyMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["api-keys"] });

  const create = useMutation({
    mutationFn: async (body: { name: string; expires_at: string | null }) => {
      const response = await apiRequest<SuccessEnvelope<CreatedApiKey>>("/api-keys", {
        method: "POST",
        body,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api-keys/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { create, revoke };
}

// ------------------------------------------------------------------- usage
export function useUsageSummary(userId?: string) {
  return useQuery({
    queryKey: ["usage", "summary", userId ?? "me"],
    queryFn: async () => {
      const response = await apiRequest<
        SuccessEnvelope<{
          user_id: string;
          windows: { five_hour: import("../types/api").WindowUsage; weekly: import("../types/api").WindowUsage };
          rpm: { limit: number };
          calculated_at: string;
        }>
      >(`/usage/summary${buildQuery({ user_id: userId })}`);
      return response.data;
    },
  });
}

export function useUsageStats(params: { range: string; from?: string; to?: string; user_id?: string }) {
  return useQuery({
    queryKey: ["usage", "stats", params],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<UsageStats>>(`/usage/stats${buildQuery(params)}`);
      return response.data;
    },
  });
}

export function useUsageEvents(params: { page?: number; limit?: number; user_id?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["usage", "events", params],
    queryFn: async () => {
      const response = await apiRequest<PaginatedEnvelope<UsageEvent>>(`/usage/events${buildQuery(params)}`);
      return { events: response.data, meta: response.meta };
    },
  });
}

// ---------------------------------------------------------------- settings
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await apiRequest<SuccessEnvelope<Settings>>("/settings");
      return response.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const response = await apiRequest<SuccessEnvelope<Settings>>("/settings", { method: "PATCH", body: patch });
      return response.data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useTestUpstream() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest<SuccessEnvelope<ConnectionTest>>("/settings/test-upstream", {
        method: "POST",
      });
      return response.data;
    },
  });
}

// -------------------------------------------------------------- audit logs
export function useAuditLogs(filters: { page?: number; limit?: number; action?: string; target_type?: string }) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const response = await apiRequest<PaginatedEnvelope<AuditLogEntry>>(`/audit-logs${buildQuery(filters)}`);
      return { entries: response.data, meta: response.meta };
    },
  });
}
