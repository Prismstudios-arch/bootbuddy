import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import type { Find } from "@/api/finds";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { formatPence } from "@/lib/money";
import { Type } from "./type";

/**
 * What the haul is worth right now, and which way it's moving.
 *
 * A list of items you paid for is inventory; a total with movement on it is
 * a portfolio, and that's the difference between opening the app once a
 * week and opening it every morning. The number people actually want is
 * "what's my stuff worth", which was previously buried on another tab.
 *
 * Movement is only shown once there's something real to compare against —
 * an arrow next to "0.0%" is worse than no arrow at all.
 */
export function PortfolioHeader({ finds }: { finds: Find[] }) {
  const theme = useTheme();
  const inStock = finds.filter((f) => f.status === "in_stock");
  if (inStock.length === 0) return null;

  const spent = inStock.reduce((sum, f) => sum + f.boughtPricePence, 0);
  const worth = inStock.reduce(
    (sum, f) => sum + (f.estimatedValuePence ?? f.boughtPricePence),
    0,
  );
  const upside = worth - spent;

  // Movement since the last refresh, across everything that has a previous
  // figure to compare to.
  const moved = inStock.filter((f) => f.valueChangePence !== null);
  const change = moved.reduce((sum, f) => sum + (f.valueChangePence ?? 0), 0);
  const changeBase = moved.reduce(
    (sum, f) => sum + (f.previousValuePence ?? 0),
    0,
  );
  const changePercent = changeBase > 0 ? (change / changeBase) * 100 : 0;
  const hasMoved = moved.length > 0 && change !== 0;

  const up = change > 0;
  const movementColour = up ? theme.color.profit : theme.color.loss;

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: space.xs,
        marginBottom: space.md,
      }}
    >
      <Type variant="label" tone="secondary">
        Haul value
      </Type>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md }}>
        <Type variant="display" tabular>
          {formatPence(worth)}
        </Type>
        {hasMoved ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              backgroundColor: up ? theme.color.profitSurface : theme.color.lossSurface,
              borderRadius: radius.pill,
              paddingVertical: 3,
              paddingHorizontal: space.sm,
              marginBottom: space.xs,
            }}
          >
            <Ionicons
              name={up ? "arrow-up" : "arrow-down"}
              size={13}
              color={movementColour}
            />
            <Type variant="caption" style={{ color: movementColour, fontWeight: "700" }}>
              {formatPence(Math.abs(change))} ({Math.abs(changePercent).toFixed(1)}%)
            </Type>
          </View>
        ) : null}
      </View>

      <Type variant="caption" tone="secondary">
        {inStock.length} {inStock.length === 1 ? "item" : "items"} · {formatPence(spent)} spent ·{" "}
        <Type
          variant="caption"
          style={{ color: upside >= 0 ? theme.color.profit : theme.color.loss, fontWeight: "600" }}
        >
          {upside >= 0 ? "+" : "−"}
          {formatPence(Math.abs(upside))} if it all sells
        </Type>
      </Type>
    </View>
  );
}

/**
 * The same treatment for the Sold filter, so tapping it doesn't drop you
 * onto a bare list. Each find's profit is already worked out server-side —
 * this only adds them up, so it can never disagree with the Profit tab.
 */
export function SoldSummary({ finds }: { finds: Find[] }) {
  const theme = useTheme();
  const sold = finds.filter((f) => f.status === "sold");
  if (sold.length === 0) return null;

  const profit = sold.reduce((sum, f) => sum + (f.realisedProfitPence ?? 0), 0);
  const takings = sold.reduce((sum, f) => sum + (f.soldPricePence ?? 0), 0);
  const up = profit >= 0;

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: space.xs,
        marginBottom: space.md,
      }}
    >
      <Type variant="label" tone="secondary">
        Profit banked
      </Type>
      <Type variant="display" tabular style={{ color: up ? theme.color.profit : theme.color.loss }}>
        {up ? "" : "−"}
        {formatPence(Math.abs(profit))}
      </Type>
      <Type variant="caption" tone="secondary">
        {sold.length} {sold.length === 1 ? "flip" : "flips"} · {formatPence(takings)} taken
      </Type>
    </View>
  );
}
