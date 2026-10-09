export function formatTokens(value: number): string {
  if (value === -1) return "Unlimited";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(iso: string | null, timeZone?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function percent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * The console presents quota in rupiah as well as tokens. Prices are listed at
 * IDR 0.02 per weighted token (matches the seeded package catalogue).
 */
export const IDR_PER_TOKEN = 0.02;

export function tokensToIdr(tokens: number): number {
  return Math.round(tokens * IDR_PER_TOKEN);
}

export function formatIdr(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(value))}`;
}

export function formatRateLimit(rpm: number): string {
  return rpm <= 0 ? "Unlimited" : `${rpm} req/min`;
}

export function formatPrice(idr: number): string {
  return idr <= 0 ? "Gratis" : formatIdr(idr);
}

export function retryAfterLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  return `${Math.ceil(minutes / 60)} hours`;
}
