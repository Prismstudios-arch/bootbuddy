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

/**
 * A Gemini reply. `searched` controls webSearchQueries, which is the only
 * grounding signal actually available for this prompt — deliberately NO
 * groundingChunks here, because the real API never returns them for a bare
 * two-line answer and a fixture that pretends otherwise is how the first
 * version of this shipped a guard that rejected everything.
 */
function reply(text: string, { searched = true } = {}) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: { parts: [{ text }] },
          groundingMetadata: {
            webSearchQueries: searched ? ["razer deathadder v2 sold price uk"] : [],
          },
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
    fetchMock.mockResolvedValue(reply("PRICES 18.00|32.00|58.00|11|LISTED\nSOURCES eBay UK"));

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

  it("only says 'sold' when the model explicitly claims completed sales", async () => {
    const search = await loadProvider();

    fetchMock.mockResolvedValue(reply("PRICES 5.00|10.00|20.00|9|SOLD\nSOURCES eBay UK"));
    expect((await search("anything"))?.basis).toBe("sold");

    fetchMock.mockResolvedValue(reply("PRICES 5.00|10.00|20.00|9|LISTED\nSOURCES eBay UK"));
    expect((await search("anything"))?.basis).toBe("asking");
  });

  it("falls back to 'asking' rather than a missing basis becoming 'sold'", async () => {
    const search = await loadProvider();
    // No basis token at all: the line doesn't match, so nothing is reported.
    // The failure that matters is the opposite one — asking data quietly
    // presented as what things actually fetch.
    fetchMock.mockResolvedValue(reply("PRICES 5.00|10.00|20.00|9"));
    expect(await search("anything")).toBeNull();
  });

  it("discards an answer that ran no searches, however well formatted", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(
      reply("PRICES 18.00|32.00|58.00|11|LISTED\nSOURCES eBay UK", { searched: false }),
    );

    // This is the whole point: without a search the model answered from
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
    fetchMock.mockResolvedValue(reply("PRICES 60.00|32.00|58.00|11|LISTED"));
    expect(await search("muddled")).toBeNull();
  });

  it("rejects a sample too small to have a median worth trusting", async () => {
    const search = await loadProvider();
    fetchMock.mockResolvedValue(reply("PRICES 10.00|12.00|14.00|2|LISTED"));
    expect(await search("one-off")).toBeNull();
  });

  it("rejects prices outside a sane range", async () => {
    const search = await loadProvider();
    for (const line of ["PRICES 0.01|0.02|0.03|8|LISTED", "PRICES 90000.00|95000.00|99000.00|8|LISTED"]) {
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
