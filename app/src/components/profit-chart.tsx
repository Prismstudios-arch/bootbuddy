import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { MonthPoint } from "@/api/finds";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";
import { Type } from "./type";

/**
 * Six-month profit bars. Hand-rolled SVG rather than a charting library:
 * the whole thing is 30 lines, it inherits the theme exactly, and it adds
 * nothing to the bundle. Losses render below the baseline in red so a bad
 * month is visible rather than hidden.
 */
const HEIGHT = 96;
const GAP = 6;

export function ProfitChart({ data }: { data: MonthPoint[] }) {
  const theme = useTheme();
  const values = data.map((d) => d.profitPence);
  const max = Math.max(1, ...values.map(Math.abs));
  const hasAnyProfit = values.some((v) => v !== 0);

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: GAP }}>
        {data.map((point) => {
          const ratio = Math.abs(point.profitPence) / max;
          const barHeight = Math.max(3, ratio * HEIGHT);
          const negative = point.profitPence < 0;
          return (
            <View key={point.month} style={{ flex: 1, justifyContent: "flex-end", height: HEIGHT }}>
              <Svg width="100%" height={barHeight}>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height={barHeight}
                  rx={4}
                  fill={
                    point.profitPence === 0
                      ? theme.color.surfaceRaised
                      : negative
                        ? theme.color.loss
                        : theme.color.profit
                  }
                />
              </Svg>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: GAP }}>
        {data.map((point) => (
          <View key={point.month} style={{ flex: 1, alignItems: "center" }}>
            <Type variant="caption" tone="tertiary">
              {monthInitial(point.month)}
            </Type>
          </View>
        ))}
      </View>

      {!hasAnyProfit ? (
        <Type variant="caption" tone="tertiary" style={{ textAlign: "center" }}>
          Six months of nothing yet — go on then.
        </Type>
      ) : null}
    </View>
  );
}

/** "2026-07" → "J" — enough of a label at this size, no clutter. */
function monthInitial(month: string): string {
  const index = Number(month.split("-")[1] ?? 1) - 1;
  return ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][index] ?? "";
}
