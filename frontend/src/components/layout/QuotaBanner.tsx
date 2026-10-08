import { AlertTriangle } from "lucide-react";
import { formatDateTime, formatTokens, percent } from "../../lib/format";
import type { WindowUsage } from "../../types/api";

function bannerFor(label: string, window: WindowUsage, timeZone?: string): string | null {
  if (window.state === "unlimited") return null;
  if (window.state === "exceeded") {
    return `${label} limit reached. Resets ${formatDateTime(window.reset_at, timeZone)}.`;
  }
  if (window.state === "warning") {
    const used = percent(window.used_tokens, window.limit_tokens);
    return `You have used ${used}% of your ${label.toLowerCase()} limit.`;
  }
  return null;
}

/** In-app quota warnings (PRD F-15). Amber at 80%, red at 100%. */
export function QuotaBanner({
  fiveHour,
  weekly,
  timeZone,
}: {
  fiveHour: WindowUsage;
  weekly: WindowUsage;
  timeZone?: string;
}) {
  const fiveHourMessage = bannerFor("5-hour", fiveHour, timeZone);
  const weeklyMessage = bannerFor("Weekly", weekly, timeZone);
  const message = weeklyMessage ?? fiveHourMessage;
  if (!message) return null;

  const isExceeded = fiveHour.state === "exceeded" || weekly.state === "exceeded";

  return (
    <div
      role="alert"
      className={
        isExceeded
          ? "flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-danger"
          : "flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning"
      }
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {message} Used {formatTokens(fiveHour.used_tokens)} of {formatTokens(fiveHour.limit_tokens)} in the last 5
        hours, {formatTokens(weekly.used_tokens)} of {formatTokens(weekly.limit_tokens)} this week.
      </span>
    </div>
  );
}
