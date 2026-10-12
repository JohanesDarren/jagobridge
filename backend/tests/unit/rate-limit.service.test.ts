import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireConcurrency,
  checkRpm,
  getInflightCount,
  resetRateLimitState,
} from "../../src/services/rate-limit.service.js";

/**
 * Covers the in-process rate limiter that replaced Redis (PRD F-08).
 * Per-instance state, so every case resets it first.
 */
describe("rate-limit.service (in-process)", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  describe("checkRpm", () => {
    it("treats a limit of 0 as unlimited", async () => {
      const result = await checkRpm("u", 0);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it("allows requests up to the limit and rejects the next one", async () => {
      const limit = 3;
      const results = [];
      for (let i = 0; i < 5; i += 1) results.push(await checkRpm("u", limit));

      expect(results[0]!.allowed).toBe(true);
      expect(results[1]!.allowed).toBe(true);
      expect(results[2]!.allowed).toBe(true);
      expect(results[3]!.allowed).toBe(false);
      expect(results[4]!.allowed).toBe(false);
    });

    it("reports remaining correctly", async () => {
      const first = await checkRpm("u", 3);
      const second = await checkRpm("u", 3);
      expect(first.remaining).toBe(2);
      expect(second.remaining).toBe(1);
    });

    it("does not let rejected calls extend the window", async () => {
      const limit = 2;
      await checkRpm("u", limit);
      await checkRpm("u", limit);

      for (let i = 0; i < 10; i += 1) {
        const rejected = await checkRpm("u", limit);
        expect(rejected.allowed).toBe(false);
      }
    });

    it("keeps windows independent per user", async () => {
      const a = await checkRpm("a", 1);
      const b = await checkRpm("b", 1);
      const aAgain = await checkRpm("a", 1);

      expect(a.allowed).toBe(true);
      expect(b.allowed).toBe(true);
      expect(aAgain.allowed).toBe(false);
    });

    it("returns a future reset timestamp", async () => {
      const result = await checkRpm("u", 5);
      expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe("acquireConcurrency", () => {
    it("treats a limit of 0 as unlimited", async () => {
      const handles = [];
      for (let i = 0; i < 25; i += 1) handles.push(await acquireConcurrency("u", 0));
      expect(handles.every((handle) => handle.acquired)).toBe(true);
    });

    it("caps in-flight requests at the limit", async () => {
      const first = await acquireConcurrency("u", 2);
      const second = await acquireConcurrency("u", 2);
      const third = await acquireConcurrency("u", 2);

      expect(first.acquired).toBe(true);
      expect(second.acquired).toBe(true);
      expect(third.acquired).toBe(false);
      expect(await getInflightCount("u")).toBe(2);
    });

    it("frees a slot on release", async () => {
      const first = await acquireConcurrency("u", 1);
      const blocked = await acquireConcurrency("u", 1);
      expect(blocked.acquired).toBe(false);

      await first.release();
      expect(await getInflightCount("u")).toBe(0);

      const afterRelease = await acquireConcurrency("u", 1);
      expect(afterRelease.acquired).toBe(true);
      await afterRelease.release();
    });

    it("does not go negative on double release", async () => {
      const handle = await acquireConcurrency("u", 5);
      await handle.release();
      await handle.release();
      expect(await getInflightCount("u")).toBe(0);
    });

    it("keeps counters independent per user", async () => {
      const a = await acquireConcurrency("a", 1);
      const b = await acquireConcurrency("b", 1);
      expect(a.acquired).toBe(true);
      expect(b.acquired).toBe(true);
    });
  });
});
