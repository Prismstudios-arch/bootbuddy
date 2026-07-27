import { View } from "react-native";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";

/**
 * Profit — the dopamine screen. Phase 4 wires this to /v1/stats: realised
 * profit hero, this month vs last, best flip, margin, sparkline, and the
 * share-card generator. The layout below is the real one, running on zeros.
 */
export default function ProfitScreen() {
  return (
    <Screen>
      <View style={{ paddingVertical: space.md }}>
        <Type variant="display">Profit</Type>
      </View>

      <View style={{ marginTop: space.xl, gap: space.xs }}>
        <Type variant="label" tone="secondary">
          Realised profit
        </Type>
        <Type variant="hero" tone="profit">
          £0.00
        </Type>
        <Type tone="secondary">Log a sale and watch this number wake up.</Type>
      </View>

      <View style={{ flexDirection: "row", gap: space.md, marginTop: space.xxl }}>
        <StatCard label="This month" value="£0.00" />
        <StatCard label="Best flip" value="—" />
      </View>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <Type variant="label" tone="secondary">
        {label}
      </Type>
      <Type variant="title" tabular>
        {value}
      </Type>
    </View>
  );
}
