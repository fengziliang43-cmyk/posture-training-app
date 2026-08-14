import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "../../src/server/routes/auth";

describe("fixed-window auth rate limiter", () => {
  it("enforces the per-key limit until the window expires", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 100, 10, () => now);

    expect(limiter.consume("client-a")).toBe(true);
    expect(limiter.consume("client-a")).toBe(true);
    expect(limiter.consume("client-a")).toBe(false);

    now += 101;
    expect(limiter.consume("client-a")).toBe(true);
  });

  it("fails closed at capacity and accepts new keys after expired entries are purged", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(1, 100, 2, () => now);

    expect(limiter.consume("client-a")).toBe(true);
    expect(limiter.consume("client-b")).toBe(true);
    expect(limiter.consume("client-c")).toBe(false);

    now += 101;
    expect(limiter.consume("client-c")).toBe(true);
  });
});
