import { describe, expect, it } from "vitest";
import { upstreamErrorMessage } from "../../src/services/model-test.service.js";

/**
 * The upstream error shapes here are copied from real 9router responses, which
 * matter because 9router nests a JSON error inside `message` and truncates it.
 */
describe("model-test.service — upstreamErrorMessage", () => {
  it("unwraps the nested, truncated 402 body into the real reason", () => {
    const body =
      '{"error":{"message":"[openai-compatible-chat-123a54b1-7897-46ce-9737-3d2ba8a7eef9/claude-sonnet-4-6] [402]: {\\"error\\":{\\"message\\":\\"Insufficient balance. Please top up your account.\\",\\"type\\":\\"insufficient_ (reset after 59s)"}}';

    const message = upstreamErrorMessage(402, body);
    expect(message).toBe(
      "Unusable — HTTP 402: Insufficient balance. Please top up your account.",
    );
  });

  it("reads a plain upstream message", () => {
    const body = '{"error":{"message":"model is not available"}}';
    expect(upstreamErrorMessage(503, body)).toBe("Unusable — HTTP 503: model is not available");
  });

  it("strips the provider/status prefix when there is no nested JSON", () => {
    const body = '{"error":{"message":"[openai-compatible-chat-abc/gpt-x] [429]: slow down"}}';
    expect(upstreamErrorMessage(429, body)).toBe("Unusable — HTTP 429: slow down");
  });

  it("falls back to a status-based message when the body is not JSON", () => {
    expect(upstreamErrorMessage(402, "gateway timeout")).toBe(
      "Unusable — HTTP 402: gateway timeout",
    );
    expect(upstreamErrorMessage(402, "")).toBe(
      "Unusable — HTTP 402: upstream account has no balance",
    );
  });

  it("never leaks an unbounded body into the message", () => {
    const body = JSON.stringify({ error: { message: "x".repeat(5000) } });
    expect(upstreamErrorMessage(500, body).length).toBeLessThanOrEqual(230);
  });
});
