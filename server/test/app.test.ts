import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { formatGBP, medianPence, pence, suggestedMaxBuy } from "../src/lib/money.js";

describe("healthz", () => {
  it("responds ok without any secrets configured", async () => {
    const app = createApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("boot-sale-buddy");
  });

  it("404s with friendly copy, not a stack trace", async () => {
    const app = createApp();
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("serves privacy and terms pages", async () => {
    const app = createApp();
    for (const path of ["/privacy", "/terms"]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });
});

describe("money", () => {
  it("rejects non-integer pence", () => {
    expect(() => pence(12.5)).toThrow(TypeError);
  });

  it("formats en-GB currency", () => {
    expect(formatGBP(pence(4250))).toBe("£42.50");
    expect(formatGBP(pence(50))).toBe("£0.50");
  });

  it("computes medians on odd and even counts", () => {
    expect(medianPence([pence(100), pence(300), pence(200)])).toBe(200);
    expect(medianPence([pence(100), pence(200), pence(300), pence(400)])).toBe(250);
    expect(medianPence([])).toBeNull();
  });

  it("suggests max buy at 40% of median, floored", () => {
    expect(suggestedMaxBuy(pence(1099))).toBe(439);
  });
});
