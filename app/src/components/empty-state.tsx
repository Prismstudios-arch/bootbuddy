import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { Button } from "./button";
import { Type } from "./type";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta?: { label: string; onPress: () => void };
};

/**
 * Designed empty state: icon medallion, cheeky copy, one clear CTA.
 * Every list screen must render one of these instead of a blank view —
 * a screen without its empty state is not done.
 */
export function EmptyState({ icon, title, body, cta }: Props) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.color.surface,
          marginBottom: space.sm,
        }}
      >
        <Ionicons name={icon} size={40} color={theme.color.textTertiary} />
      </View>
      <Type variant="title" style={{ textAlign: "center" }}>
        {title}
      </Type>
      <Type
        tone="secondary"
        style={{ textAlign: "center", maxWidth: 280, marginBottom: space.md }}
      >
        {body}
      </Type>
      {cta ? <Button label={cta.label} onPress={cta.onPress} /> : null}
    </View>
  );
}
