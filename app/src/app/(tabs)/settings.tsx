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
import { API_URL, apiFetch, ApiError, clearSession } from "@/lib/api";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { getPurchases } from "@/purchases";
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

  /**
   * Promo codes unlock Pro without a purchase — how App Review, press and
   * competition winners get in, and how Pro gets tested on a real device
   * against the live API.
   */
  const redeemCode = () => {
    Alert.prompt?.(
      "Redeem a code",
      "Enter your Boot Sale Buddy code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: async (code?: string) => {
            if (!code?.trim()) return;
            try {
              await apiFetch("/v1/redeem", {
                method: "POST",
                body: JSON.stringify({ code: code.trim() }),
              });
              refresh();
              haptic.greatFind();
              Alert.alert("You're in", "Buddy Pro unlocked. Scan away.");
            } catch (error) {
              haptic.fail();
              Alert.alert(
                "Couldn't redeem that",
                error instanceof ApiError ? error.message : "Try again?",
              );
            }
          },
        },
      ],
      "plain-text",
    );
  };

  /**
   * Dev menu action. Reports failures instead of throwing into the void —
   * the previous version let the ApiError escape as an unhandled rejection
   * and looked like nothing had happened at all.
   */
  const devEntitlement = async (entitlement: "pro" | "free") => {
    try {
      await apiFetch("/v1/dev/entitlement", {
        method: "POST",
        body: JSON.stringify({ entitlement }),
      });
      refresh();
      haptic.confirm();
      Alert.alert("Done", entitlement === "pro" ? "You're Pro now." : "Back to the free plan.");
    } catch (error) {
      haptic.fail();
      Alert.alert(
        "Dev route unavailable",
        error instanceof ApiError && error.status === 404
          ? `The dev entitlement route isn't mounted on ${API_URL} (it never is in production). Point EXPO_PUBLIC_API_URL at a local server, or use "Redeem a code".`
          : "Couldn't reach the dev route.",
      );
    }
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
            label={isPro ? (entitlement === "lifetime" ? "Buddy Pro · Lifetime" : "Buddy Pro") : "Free plan"}
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
          {!isPro ? (
            <>
              <Divider />
              <Row icon="ticket-outline" label="Redeem a code" onPress={redeemCode} />
            </>
          ) : null}
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

        {/* __DEV__ is compiled to false in release builds, so this whole
            block is stripped by the bundler — the dev menu physically
            cannot ship, rather than relying on anyone remembering to
            delete it. It also needs a local server: the entitlement route
            it drives is not mounted in production (by design). */}
        {__DEV__ && devTaps >= 7 && purchases.isMock ? (
          <View style={{ marginBottom: space.xxl }}>
            <SectionTitle title="Dev menu (debug builds only)" />
            <Card>
              <Row
                icon="flask-outline"
                label="Simulate Pro"
                onPress={() => void devEntitlement("pro")}
              />
              <Divider />
              <Row
                icon="refresh-circle-outline"
                label="Back to free"
                onPress={() => void devEntitlement("free")}
              />
            </Card>
            <Type
              variant="caption"
              tone="tertiary"
              style={{ marginTop: space.sm, marginHorizontal: space.xs }}
            >
              Needs a local API ({API_URL}). Against production, use Redeem a code instead.
            </Type>
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
