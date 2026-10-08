import { describe, expect, it } from "vitest";
import {
  computeResetAt,
  computeWindowState,
  estimateTokens,
  weighTokens,
} from "../../src/services/usage.service.js";

const HOUR_MS = 60 * 60 * 1000;
const FIVE_HOUR_MS = 5 * HOUR_MS;

describe("usage calculations", () => {
  it("applies the token multiplier", () => {
    expect(weighTokens({ prompt: 1000, completion: 500, multiplier: 2.0 })).toBe(3000);
  });

  it("rounds the weighted token total", () => {
    expect(weighTokens({ prompt: 3, completion: 4, multiplier: 1.5 })).toBe(11);
  });

  it("estimates tokens as ceil(characters / 4)", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(9)).toBe(3);
    expect(estimateTokens(10)).toBe(3);
    expect(estimateTokens(11)).toBe(3);
    expect(estimateTokens(13)).toBe(4);
  });

  it("classifies window state at the documented thresholds", () => {
    expect(computeWindowState(100, 0)).toBe("unlimited");
    expect(computeWindowState(399_999, 500_000)).toBe("ok");
    expect(computeWindowState(400_000, 500_000)).toBe("warning");
    expect(computeWindowState(500_000, 500_000)).toBe("exceeded");
  });

  it("returns the time when the oldest event leaves the window", () => {
    const now = new Date("2026-10-08T09:00:00Z");
    const events = [
      { at: new Date(now.getTime() - 4.5 * HOUR_MS), tokens: 300_000 },
      { at: new Date(now.getTime() - 1 * HOUR_MS), tokens: 250_000 },
    ];
    const reset = computeResetAt(events, 500_000, 5 * 60 * 60, now);
    expect(reset).toEqual(new Date(now.getTime() - 4.5 * HOUR_MS + FIVE_HOUR_MS));
  });

  it("returns null when usage is below the limit", () => {
    const now = new Date("2026-10-08T09:00:00Z");
    const events = [{ at: new Date(now.getTime() - HOUR_MS), tokens: 100_000 }];
    expect(computeResetAt(events, 500_000, 5 * 60 * 60, now)).toBeNull();
  });

  it("returns null for unlimited windows", () => {
    expect(computeResetAt([], 0, 5 * 60 * 60)).toBeNull();
  });
});
