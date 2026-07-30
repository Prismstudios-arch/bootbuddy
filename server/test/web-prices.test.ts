import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The grounded-web-price provider is the only place in this codebase where a
 * language model's output becomes a number a user might spend money on, so
 * the tests are almost entirely about what it REFUSES.
 *
 * The failure that matters isn't a crash. It's a confident, well-formatted,
 * completely invented price arriving on the result sheet looking exactly
 * like a real one. Every case below is a shape of that.
 */
const KEY = "test-gemini-key";

async function loadProvider(webPrices = "1") {
  vi.resetModules();
  process.env.GEMINI_API_KEY = KEY;
  process.env.GEMINI_WEB_PRICES = webPrices;
  const mod = await import("../src/services/web-prices.js");
  return mod.searchWebPrices;
}

/** A Gemini reply: given text, and grounding chunks unless told otherwise. */
function reply(text: string, { grounded = true } = {}) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: { parts: [{ text }] },
          ...(grounded
            ? {
                groundingMetadata: {
                  groundingChunks: [{ web: { uri: "https://ebay.co.uk/x", title: "eBay" } }],
                },
              }
            : {}),
        },
      ],
    }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_WEB_PRICES;
  delete process.env.GEMINI_API_KEY;
});

describe("web prices", () => {
  it("returns integer pence, asking basis, and a 40% max buy", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 18.00|32.00|58.00|11"));

    const result = await search("Kate Bush Hounds of Love");

    expect(result).toEqual({
      lowPence: 1800,
      medianPence: 3200,
      highPence: 5800,
      listingCount: 11,
      maxBuyPence: 1280,
      source: "web",
      basis: "asking",
    });
  });

  it("never reports a web price as 'sold'", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 5.00|10.00|20.00|9"));

    // A grounded search reads listings, not completed sales. If this ever
    // flips to "sold" the result sheet starts claiming something the data
    // cannot support.
    expect((await search("anything"))?.basis).toBe("asking");
  });

  it("discards an answer with no grounding, however well formatted", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 18.00|32.00|58.00|11", { grounded: false }));

    // This is the whole point: without citations the model answered from
    // memory, and memory invents prices.
    expect(await search("Kate Bush Hounds of Love")).toBeNull();
  });

  it("honours NONE rather than digging a number out of the prose", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("NONE"));
    expect(await search("unidentifiable lump")).toBeNull();
  });

  it("bins prose even when it contains plausible prices", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(
      reply("These usually go for about £30, though I've seen £45 on a good day."),
    );
    expect(await search("some item")).toBeNull();
  });

  it("rejects figures that aren't low <= median <= high", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 60.00|32.00|58.00|11"));
    expect(await search("muddled")).toBeNull();
  });

  it("rejects a sample too small to have a median worth trusting", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 10.00|12.00|14.00|2"));
    expect(await search("one-off")).toBeNull();
  });

  it("rejects prices outside a sane range", async () => {
    const search = await loadProvider();
    for (const line of ["PRICES 0.01|0.02|0.03|8", "PRICES 90000.00|95000.00|99000.00|8"]) {
      fetchMock.mockResolvedValue(reply(line));
      expect(await search("daft")).toBeNull();
    }
  });

  it("is skipped entirely unless switched on", async () => {
    const search = await loadProvider("");
    await search("Kate Bush Hounds of Love");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on an upstream failure instead of throwing", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    expect(await search("anything")).toBeNull();

    fetchMock.mockRejectedValue(new Error("socket hang up"));
    expect(await search("anything")).toBeNull();
  });
});
