import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Pressable, ScrollView, View } from "react-native";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { useAppStore, type Appearance } from "@/state/app-store";

const APPEARANCE_CYCLE: Record<Appearance, Appearance> = {
  system: "dark",
  dark: "light",
  light: "system",
};

const APPEARANCE_LABEL: Record<Appearance, string> = {
  system: "Match system",
  dark: "Dark",
  light: "Light",
};

/**
 * Settings. The Appearance row is live (cycles system → dark → light) so the
 * theme system is exercised from day one. Subscription management, Restore
 * Purchases, account deletion and real policy links land in Phases 5–6 —
 * the rows exist now so the information architecture is settled.
 */
export default function SettingsScreen() {
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const feePercent = useAppStore((s) => s.defaultFeePercent);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingVertical: space.md }}>
          <Type variant="display">Settings</Type>
        </View>

        <SectionTitle title="Plan" />
        <Card>
          <Row
            icon="sparkles-outline"
            label="Buddy Pro"
            trailing={<Pill label="Free plan" />}
            onPress={() => haptic.tap()}
          />
        </Card>

        <SectionTitle title="Preferences" />
        <Card>
          <Row
            icon="contrast-outline"
            label="Appearance"
            value={APPEARANCE_LABEL[appearance]}
            onPress={() => {
              haptic.confirm();
              setAppearance(APPEARANCE_CYCLE[appearance]);
            }}
          />
          <Divider />
          <Row
            icon="cash-outline"
            label="Default selling fees"
            value={`${feePercent}%`}
            onPress={() => haptic.tap()}
          />
        </Card>

        <SectionTitle title="About" />
        <Card>
          <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => haptic.tap()} />
          <Divider />
          <Row icon="document-text-outline" label="Terms of Use" onPress={() => haptic.tap()} />
          <Divider />
          <Row icon="mail-outline" label="Support" onPress={() => haptic.tap()} />
        </Card>

        <Type
          variant="caption"
          tone="tertiary"
          style={{ textAlign: "center", marginVertical: space.xl }}
        >
          Boot Sale Buddy {Constants.expoConfig?.version ?? "dev"} · Prices via eBay
        </Type>
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Type
      variant="label"
      tone="secondary"
      style={{ marginTop: space.xl, marginBottom: space.sm, marginLeft: space.xs }}
    >
      {title}
    </Type>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{ height: 1, backgroundColor: theme.color.border, marginLeft: space.gutter + 28 }}
    />
  );
}

function Row({
  icon,
  label,
  value,
  trailing,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.lg,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? theme.color.surfacePressed : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={theme.color.textSecondary} />
      <Type variant="headline" style={{ flex: 1 }}>
        {label}
      </Type>
      {value ? <Type tone="secondary">{value}</Type> : null}
      {trailing}
      <Ionicons name="chevron-forward" size={16} color={theme.color.textTertiary} />
    </Pressable>
  );
}
