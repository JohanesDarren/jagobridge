import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type Algorithm } from "jsonwebtoken";
import { loadEnv } from "./env.js";
import { API_KEY_PREFIX, API_KEY_RANDOM_LENGTH, PASSWORD_MIN_LENGTH, type Role } from "./constants.js";

const env = loadEnv();

// ---------------------------------------------------------------------------
// Passwords (bcrypt, cost factor 12 — PRD §4.4)
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
}

/** Minimum 10 characters, one uppercase, one lowercase, one digit (F-01). */
export function validatePasswordComplexity(password: string): PasswordCheck {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least one digit.");
  return { valid: errors.length === 0, errors };
}

/** Generates a random temporary password satisfying the complexity rules. */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%*";
  const pick = (set: string, count: number) =>
    Array.from({ length: count }, () => set[crypto.randomInt(0, set.length)]).join("");
  const base = `${pick(upper, 2)}${pick(lower, 4)}${pick(digits, 3)}${pick(special, 1)}`;
  return base
    .split("")
    .sort(() => crypto.randomInt(0, 3) - 1)
    .join("");
}

// ---------------------------------------------------------------------------
// JWT access tokens
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: "access";
}

const JWT_ALGORITHM = env.JWT_ALGORITHM as Algorithm;

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, type: "access" }, env.JWT_SECRET_KEY, {
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    algorithm: JWT_ALGORITHM,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET_KEY, {
    algorithms: [JWT_ALGORITHM],
  });
  const payload = decoded as unknown as AccessTokenPayload;
  if (payload.type !== "access" || !payload.sub) {
    throw new Error("Invalid access token payload");
  }
  return payload;
}

export function accessTokenExpiresInSeconds(): number {
  return env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60;
}

// ---------------------------------------------------------------------------
// Opaque tokens (refresh tokens, invitations) — stored hashed (SHA-256)
// ---------------------------------------------------------------------------

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function refreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + env.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + env.INVITATION_EXPIRE_HOURS * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// API keys: "jb_" + 40 random characters. Only the SHA-256 hash plus an
// 8-character display prefix are stored (F-10).
// ---------------------------------------------------------------------------

export interface GeneratedApiKey {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = Array.from(
    { length: API_KEY_RANDOM_LENGTH },
    () => alphabet[crypto.randomInt(0, alphabet.length)],
  ).join("");
  const fullKey = `${API_KEY_PREFIX}${random}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, API_KEY_PREFIX.length + 8),
    keyHash: sha256Hex(fullKey),
  };
}

export function hashApiKey(fullKey: string): string {
  return sha256Hex(fullKey);
}
