import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All money columns are integer pence. Floats never touch money anywhere in
 * this codebase — the column names end in `_pence` so a stray `_gbp` float
 * column would stick out in review.
 */

export const entitlementEnum = pgEnum("entitlement", ["free", "pro", "lifetime"]);
export const findStatusEnum = pgEnum("find_status", ["in_stock", "sold"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sign in with Apple subject. Null for anonymous device accounts.
    appleSub: text("apple_sub"),
    entitlement: entitlementEnum("entitlement").notNull().default("free"),
    entitlementExpiresAt: timestamp("entitlement_expires_at", { withTimezone: true }),
    // RevenueCat app user id, set once the app first talks to RC.
    revenuecatId: text("revenuecat_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Soft-delete marker; a nightly job hard-deletes rows older than 30 days.
    // DELETE /v1/account wipes scans/finds immediately and sets this.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_apple_sub_idx").on(t.appleSub)],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 of the uploaded (already client-compressed) image. Lets us
    // detect duplicate scans of the same photo and skip the vision call.
    imageHash: text("image_hash").notNull(),
    itemName: text("item_name"),
    brand: text("brand"),
    category: text("category"),
    searchQuery: text("search_query").notNull(),
    confidence: real("confidence").notNull().default(0),
    // Asking-price stats from active eBay GB listings. Null when eBay was
    // unavailable — the app then shows "Market data unavailable, tap to retry".
    priceLowPence: integer("price_low_pence"),
    priceMedianPence: integer("price_median_pence"),
    priceHighPence: integer("price_high_pence"),
    listingCount: integer("listing_count").notNull().default(0),
    // Which source priced it, and whether those are completed-sale prices
    // or live asking prices. Persisted so the honest label on the result
    // sheet survives a reload — it must never silently become "sold".
    priceSource: text("price_source"),
    priceBasis: text("price_basis"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scans_user_created_idx").on(t.userId, t.createdAt)],
);

export const finds = pgTable(
  "finds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    // Thumbnails stay on-device (privacy + cost); this is the local asset key
    // the app uses to re-associate its photo after a restore, never a URL.
    localPhotoKey: text("local_photo_key"),
    status: findStatusEnum("status").notNull().default("in_stock"),
    boughtPricePence: integer("bought_price_pence").notNull(),
    boughtAt: timestamp("bought_at", { withTimezone: true }).notNull().defaultNow(),
    // Estimated resale value at time of logging (median asking price) so the
    // portfolio can show unrealised profit without re-querying eBay.
    estimatedValuePence: integer("estimated_value_pence"),
    // When that estimate was last refreshed. An unrealised profit figure
    // from six months ago is a guess wearing a number's clothes, so the UI
    // says how stale it is rather than presenting it as current.
    valuedAt: timestamp("valued_at", { withTimezone: true }),
    // The value before the last refresh. Without remembering where a figure
    // came from there is no movement to show, and a portfolio of static
    // numbers tells you nothing about which way things are going.
    previousValuePence: integer("previous_value_pence"),
    soldPricePence: integer("sold_price_pence"),
    feesPence: integer("fees_pence").notNull().default(0),
    postagePence: integer("postage_pence").notNull().default(0),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("finds_user_status_idx").on(t.userId, t.status)],
);

/**
 * Daily scan quota. One row per user per UK-local day, upserted atomically:
 *   insert ... on conflict (user_id, day) do update set scan_count = scan_count + 1
 * The check happens server-side before the Claude call — the client's idea of
 * its own quota is display-only.
 */
export const usage = pgTable(
  "usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    scanCount: integer("scan_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/**
 * Refresh tokens are stored hashed so a DB leak can't mint sessions.
 * Rotated on every use; `replacedBy` lets us detect replay of a rotated
 * token and revoke the whole family.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    replacedBy: uuid("replaced_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("refresh_tokens_hash_idx").on(t.tokenHash),
    index("refresh_tokens_user_idx").on(t.userId),
  ],
);
