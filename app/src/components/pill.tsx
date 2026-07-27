import { View } from "react-native";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { Type } from "./type";

type Props = {
  label: string;
  tone?: "neutral" | "profit" | "loss" | "gold";
};

/** Small status chip: profit/loss amounts, "PRO", "3 scans left". */
export function Pill({ label, tone = "neutral" }: Props) {
  const theme = useTheme();
  const bg = {
    neutral: theme.color.surfaceRaised,
    profit: theme.color.profitSurface,
    loss: theme.color.lossSurface,
    gold: theme.color.goldSurface,
  }[tone];
  const fg = {
    neutral: theme.color.textSecondary,
    profit: theme.color.profit,
    loss: theme.color.loss,
    gold: theme.color.gold,
  }[tone];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingVertical: space.xs,
        paddingHorizontal: space.md,
      }}
    >
      <Type variant="caption" style={{ color: fg, fontWeight: "600" }}>
        {label}
      </Type>
    </View>
  );
}
