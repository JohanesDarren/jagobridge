import { describe, expect, it } from "vitest";
import {
  canManageModels,
  canManageUsers,
  isAdmin,
  needsPasswordChange,
  needsUsageNotice,
} from "../src/lib/permissions";
import type { AuthUser } from "../src/types/api";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    name: "Test",
    email: "test@jago.com",
    role: "member",
    must_change_password: false,
    usage_notice_acknowledged: true,
    ...overrides,
  };
}

/**
 * These drive what the UI shows (menu items, guards). The server is still the
 * authority (PRD 7.3), but the client must not offer admin actions to members.
 */
describe("permissions", () => {
  describe("isAdmin", () => {
    it("is true only for the admin role", () => {
      expect(isAdmin(user({ role: "admin" }))).toBe(true);
      expect(isAdmin(user({ role: "member" }))).toBe(false);
    });

    it("is false for null and undefined (logged out)", () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });
  });

  describe("admin-only capabilities", () => {
    it("never grants a member", () => {
      const member = user({ role: "member" });
      expect(canManageUsers(member)).toBe(false);
      expect(canManageModels(member)).toBe(false);
    });

    it("grants an admin", () => {
      const admin = user({ role: "admin" });
      expect(canManageUsers(admin)).toBe(true);
      expect(canManageModels(admin)).toBe(true);
    });
  });

  describe("needsPasswordChange", () => {
    it("follows the flag", () => {
      expect(needsPasswordChange(user({ must_change_password: true }))).toBe(true);
      expect(needsPasswordChange(user({ must_change_password: false }))).toBe(false);
    });

    it("is false when there is no user", () => {
      expect(needsPasswordChange(null)).toBe(false);
      expect(needsPasswordChange(undefined)).toBe(false);
    });
  });

  describe("needsUsageNotice", () => {
    it("requires a user AND an unacknowledged notice", () => {
      expect(needsUsageNotice(user({ usage_notice_acknowledged: false }))).toBe(true);
      expect(needsUsageNotice(user({ usage_notice_acknowledged: true }))).toBe(false);
    });

    it("is false for a logged-out visitor", () => {
      expect(needsUsageNotice(null)).toBe(false);
      expect(needsUsageNotice(undefined)).toBe(false);
    });
  });
});
