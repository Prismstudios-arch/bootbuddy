import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Linking as RNLinking, Pressable, ScrollView, View } from "react-native";
import { findKeys } from "@/api/finds";
import { scanKeys, useSession } from "@/api/scans";
import { Paywall } from "@/components/paywall";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { API_URL, apiFetch, clearSession } from "@/lib/api";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { getPurchases, MockPurchases } from "@/purchases";
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

const FEE_PRESETS = [10, 13, 15, 20];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const session = useSession();
  const purchases = getPurchases();
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const feePercent = useAppStore((s) => s.defaultFeePercent);
  const setFeePercent = useAppStore((s) => s.setDefaultFeePercent);
  const [paywall, setPaywall] = useState(false);
  const [devTaps, setDevTaps] = useState(0);

  const entitlement = session.data?.user.entitlement ?? "free";
  const isPro = entitlement !== "free";
  const quota = session.data?.quota;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: scanKeys.me });
    void queryClient.invalidateQueries({ queryKey: findKeys.stats });
  };

  const restore = async () => {
    haptic.tap();
    const outcome = await purchases.restore();
    refresh();
    Alert.alert(
      outcome.status === "restored" ? "Restored" : "Nothing to restore",
      outcome.status === "restored"
        ? "Your Pro subscription is back."
        : outcome.status === "error"
          ? outcome.message
          : "No previous purchases found on this Apple ID.",
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete account and data?",
      "This wipes your scans, finds and profit history from our servers. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/v1/account", { method: "DELETE" });
              await clearSession();
              queryClient.clear();
              haptic.confirm();
              Alert.alert("Deleted", "Your account and data are gone. Happy hunting.");
            } catch {
              haptic.fail();
              Alert.alert("Couldn't delete", "Something went wrong. Try again?");
            }
          },
        },
      ],
    );
  };

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
            label={isPro ? "Buddy Pro" : "Free plan"}
            value={
              isPro
                ? undefined
                : quota
                  ? `${Math.max(0, quota.limit - quota.used)} scans left today`
                  : undefined
            }
            trailing={isPro ? <Pill label="Active" tone="profit" /> : undefined}
            onPress={() => {
              haptic.tap();
              if (isPro) {
                void RNLinking.openURL("https://apps.apple.com/account/subscriptions");
              } else {
                setPaywall(true);
              }
            }}
          />
          <Divider />
          {/* App Review requires Restore Purchases to be reachable. */}
          <Row icon="refresh-outline" label="Restore purchases" onPress={() => void restore()} />
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
            onPress={() => {
              haptic.tap();
              const next = FEE_PRESETS[(FEE_PRESETS.indexOf(feePercent) + 1) % FEE_PRESETS.length];
              setFeePercent(next ?? 13);
            }}
          />
        </Card>

        <SectionTitle title="About" />
        <Card>
          <Row
            icon="lock-closed-outline"
            label="Privacy Policy"
            onPress={() => void RNLinking.openURL(`${API_URL}/privacy`)}
          />
          <Divider />
          <Row
            icon="document-text-outline"
            label="Terms of Use"
            onPress={() => void RNLinking.openURL(`${API_URL}/terms`)}
          />
          <Divider />
          <Row
            icon="mail-outline"
            label="Support"
            onPress={() =>
              void Linking.openURL("mailto:support@bootsalebuddy.app?subject=Boot%20Sale%20Buddy")
            }
          />
        </Card>

        <SectionTitle title="Account" />
        <Card>
          <Row icon="trash-outline" label="Delete account & data" destructive onPress={deleteAccount} />
        </Card>

        {/* Tap the version seven times for the dev menu (Expo Go only). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="App version"
          onPress={() => setDevTaps((n) => n + 1)}
        >
          <Type
            variant="caption"
            tone="tertiary"
            style={{ textAlign: "center", marginVertical: space.xl }}
          >
            Boot Sale Buddy {Constants.expoConfig?.version ?? "dev"} · Prices via eBay
          </Type>
        </Pressable>

        {devTaps >= 7 && purchases.isMock ? (
          <View style={{ marginBottom: space.xxl }}>
            <SectionTitle title="Dev menu (Expo Go)" />
            <Card>
              <Row
                icon="flask-outline"
                label="Simulate Pro"
                onPress={async () => {
                  await purchases.purchase("annual");
                  refresh();
                  haptic.confirm();
                }}
              />
              <Divider />
              <Row
                icon="refresh-circle-outline"
                label="Back to free"
                onPress={async () => {
                  if (purchases instanceof MockPurchases) await purchases.reset();
                  refresh();
                  haptic.confirm();
                }}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {paywall ? <Paywall reason="browse" onClose={() => setPaywall(false)} /> : null}
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
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = destructive ? theme.color.loss : theme.color.textSecondary;
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
      <Ionicons name={icon} size={20} color={tint} />
      <Type variant="headline" style={{ flex: 1, ...(destructive ? { color: theme.color.loss } : {}) }}>
        {label}
      </Type>
      {value ? <Type tone="secondary">{value}</Type> : null}
      {trailing}
      {!destructive ? (
        <Ionicons name="chevron-forward" size={16} color={theme.color.textTertiary} />
      ) : null}
    </Pressable>
  );
}
