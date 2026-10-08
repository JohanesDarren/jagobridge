import type { AuthUser } from "../types/api";

/**
 * UI permission helpers for display only. The server is always the authority
 * (PRD §7.3).
 */
export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function canManageUsers(user: AuthUser | null | undefined): boolean {
  return isAdmin(user);
}

export function canManageModels(user: AuthUser | null | undefined): boolean {
  return isAdmin(user);
}

export function needsPasswordChange(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.must_change_password);
}

export function needsUsageNotice(user: AuthUser | null | undefined): boolean {
  return Boolean(user && !user.usage_notice_acknowledged);
}
