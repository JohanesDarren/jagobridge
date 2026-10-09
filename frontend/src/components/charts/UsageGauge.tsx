import { formatDateTime, formatTokens, percent } from "../../lib/format";
import type { WindowUsage } from "../../types/api";

const STATE_COLORS: Record<string, string> = {
  ok: "#16A34A",
  warning: "#D97706",
  exceeded: "#DC2626",
  unlimited: "#0d26de",
};

export function UsageGauge({
  label,
  window,
  timeZone,
}: {
  label: string;
  window: WindowUsage;
  timeZone?: string;
}) {
  const isUnlimited = window.state === "unlimited";
  const usedPercent = isUnlimited ? 0 : percent(window.used_tokens, window.limit_tokens);
  const color = STATE_COLORS[window.state] ?? "#0d26de";

  return (
    <div className="jb-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="text-xs font-medium" style={{ color }}>
          {window.state === "unlimited" ? "Unlimited" : `${usedPercent}%`}
        </span>
      </div>

      <div
        role="meter"
        aria-label={`${label} usage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isUnlimited ? undefined : usedPercent}
        data-state={window.state}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${isUnlimited ? 100 : usedPercent}%`, backgroundColor: color, opacity: isUnlimited ? 0.25 : 1 }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">Used</dt>
        <dd className="text-right font-medium">{formatTokens(window.used_tokens)}</dd>
        <dt className="text-muted">Limit</dt>
        <dd className="text-right font-medium">{formatTokens(window.limit_tokens)}</dd>
        <dt className="text-muted">Remaining</dt>
        <dd className="text-right font-medium">{formatTokens(window.remaining_tokens)}</dd>
        <dt className="text-muted">Resets</dt>
        <dd className="text-right font-medium">
          {window.reset_at ? formatDateTime(window.reset_at, timeZone) : "—"}
        </dd>
      </dl>
    </div>
  );
}
