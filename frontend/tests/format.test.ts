import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatIdr,
  formatNumber,
  formatPrice,
  formatRateLimit,
  formatRelative,
  formatTokens,
  percent,
  retryAfterLabel,
  tokensToIdr,
} from "../src/lib/format";

describe("formatTokens", () => {
  it("labels -1 as Unlimited (the sentinel for no limit)", () => {
    expect(formatTokens(-1)).toBe("Unlimited");
  });

  it("scales to K and M", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1_000)).toBe("1.0K");
    expect(formatTokens(250_000)).toBe("250.0K");
    expect(formatTokens(1_000_000)).toBe("1.00M");
    expect(formatTokens(2_500_000)).toBe("2.50M");
  });

  it("switches unit at the exact boundary", () => {
    // 999,999 stays in K; 1,000,000 becomes M.
    expect(formatTokens(999_999)).toBe("1000.0K");
    expect(formatTokens(1_000_000)).toBe("1.00M");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatDateTime / formatDate", () => {
  it("renders an em dash for missing values", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("formats a timestamp without throwing", () => {
    const out = formatDateTime("2026-10-12T04:00:00.000Z", "UTC");
    expect(out).toContain("2026");
    expect(out).not.toBe("—");
  });

  it("honours an explicit timezone", () => {
    const utc = formatDateTime("2026-10-12T04:00:00.000Z", "UTC");
    const jakarta = formatDateTime("2026-10-12T04:00:00.000Z", "Asia/Jakarta");
    // Jakarta is UTC+7, so the wall-clock time must differ.
    expect(jakarta).not.toBe(utc);
  });
});

describe("formatRelative", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("returns Never for null", () => {
    expect(formatRelative(null)).toBe("Never");
  });

  it("describes recent times", () => {
    expect(formatRelative(ago(10_000))).toBe("Just now");
    expect(formatRelative(ago(5 * 60_000))).toBe("5m ago");
    expect(formatRelative(ago(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelative(ago(2 * 86_400_000))).toBe("2d ago");
  });
});

describe("percent", () => {
  it("treats a non-positive limit as 0% (no divide-by-zero)", () => {
    expect(percent(100, 0)).toBe(0);
    expect(percent(100, -5)).toBe(0);
  });

  it("rounds and clamps at 100", () => {
    expect(percent(50, 100)).toBe(50);
    expect(percent(1, 3)).toBe(33);
    expect(percent(200, 100)).toBe(100);
  });
});

describe("IDR helpers", () => {
  it("converts tokens at 0.02 per weighted token", () => {
    expect(tokensToIdr(1000)).toBe(20);
    expect(tokensToIdr(500)).toBe(10);
  });

  it("formats rupiah", () => {
    expect(formatIdr(6766)).toContain("6.766");
  });

  it("shows Gratis for zero price", () => {
    expect(formatPrice(0)).toBe("Gratis");
    expect(formatPrice(-1)).toBe("Gratis");
    expect(formatPrice(5000)).toContain("5.000");
  });
});

describe("formatRateLimit", () => {
  it("labels non-positive as Unlimited", () => {
    expect(formatRateLimit(0)).toBe("Unlimited");
    expect(formatRateLimit(-1)).toBe("Unlimited");
    expect(formatRateLimit(60)).toBe("60 req/min");
  });
});

describe("retryAfterLabel", () => {
  it("picks seconds, minutes, then hours", () => {
    expect(retryAfterLabel(30)).toBe("30 seconds");
    expect(retryAfterLabel(60)).toBe("1 minutes");
    expect(retryAfterLabel(90)).toBe("2 minutes");
    expect(retryAfterLabel(3600)).toBe("1 hours");
    expect(retryAfterLabel(7200)).toBe("2 hours");
  });
});
