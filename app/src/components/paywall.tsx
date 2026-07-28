import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { scanKeys } from "@/api/scans";
import { findKeys } from "@/api/finds";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { getPurchases, type Offering, type PackageId } from "@/purchases";
import { Button } from "./button";
import { Pill } from "./pill";
import { Sheet } from "./sheet";
import { Type } from "./type";

const FEATURES = [
  { icon: "infinite", text: "Unlimited scans — no counting" },
  { icon: "download-outline", text: "CSV export for your tax return" },
  { icon: "options-outline", text: "Custom fee presets per platform" },
  { icon: "notifications-outline", text: "Price-drop watchlist (coming soon)" },
  { icon: "color-palette-outline", text: "App icon pack" },
] as const;

/**
 * The paywall. Deliberately not a dark pattern: the close button is visible
 * and works immediately, there's no fake countdown, no pre-ticked upsell,
 * and the auto-renew terms sit next to the buy button rather than buried —
 * all of which App Review checks, and all of which are just decent
 * behaviour anyway.
 */
export function Paywall({
  reason,
  onClose,
}: {
  reason?: "quota" | "browse";
  onClose: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const purchases = getPurchases();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<PackageId>("annual");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void purchases.getOfferings().then(setOfferings);
  }, [purchases]);

  const chosen = offerings.find((o) => o.id === selected);

  const refreshEntitlement = () => {
    void queryClient.invalidateQueries({ queryKey: scanKeys.me });
    void queryClient.invalidateQueries({ queryKey: findKeys.stats });
  };

  const buy = async () => {
    setBusy(true);
    setMessage(null);
    const outcome = await purchases.purchase(selected);
    setBusy(false);
    if (outcome.status === "purchased") {
      haptic.greatFind();
      refreshEntitlement();
      onClose();
    } else if (outcome.status === "cancelled") {
      // User backed out; say nothing, that's their business.
    } else if (outcome.status === "error") {
      haptic.fail();
      setMessage(outcome.message);
    }
  };

  const restore = async () => {
    setBusy(true);
    setMessage(null);
    const outcome = await purchases.restore();
    setBusy(false);
    if (outcome.status === "restored") {
      haptic.confirm();
      refreshEntitlement();
      onClose();
    } else if (outcome.status === "nothing_to_restore") {
      setMessage("Nothing to restore on this Apple ID.");
    } else if (outcome.status === "error") {
      setMessage(outcome.message);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <Pill label="Buddy Pro" tone="gold" />
            <Type variant="title" style={{ marginTop: space.sm }}>
              {reason === "quota" ? "That's today's three used" : "Scan without counting"}
            </Type>
            <Type tone="secondary">
              {reason === "quota"
                ? "Your free scans reset at midnight. Or stop counting altogether."
                : "One good flip pays for the year."}
            </Type>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={{ padding: space.xs }}
          >
            <Ionicons name="close" size={24} color={theme.color.textSecondary} />
          </Pressable>
        </View>

        <View style={{ gap: space.sm }}>
          {FEATURES.map((feature) => (
            <View
              key={feature.text}
              style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
            >
              <Ionicons name={feature.icon} size={18} color={theme.color.profit} />
              <Type style={{ flex: 1 }}>{feature.text}</Type>
            </View>
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          {offerings.map((offering) => (
            <PlanRow
              key={offering.id}
              offering={offering}
              selected={selected === offering.id}
              onPress={() => {
                haptic.tap();
                setSelected(offering.id);
              }}
            />
          ))}
        </View>

        <Button
          label={
            busy
              ? "One moment…"
              : chosen?.trialDays
                ? `Start ${chosen.trialDays}-day free trial`
                : "Get Buddy Pro"
          }
          onPress={() => void buy()}
          disabled={busy || offerings.length === 0}
        />

        {message ? (
          <Type variant="caption" tone="loss" style={{ textAlign: "center" }}>
            {message}
          </Type>
        ) : null}

        {/* App Review requires the terms next to the buy button. */}
        <Type variant="caption" tone="tertiary" style={{ textAlign: "center", lineHeight: 17 }}>
          {chosen?.id === "lifetime"
            ? "One-off payment. No subscription, nothing to cancel."
            : `${chosen?.priceLabel ?? ""} ${chosen?.periodLabel ?? ""}, auto-renewing until cancelled.${
                chosen?.trialDays
                  ? ` Free for ${chosen.trialDays} days, then billed unless you cancel at least 24 hours before it ends.`
                  : ""
              } Cancel any time in your Apple ID settings.`}
        </Type>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            onPress={() => void restore()}
            disabled={busy}
          >
            <Type variant="caption" tone="secondary">
              Restore purchases
            </Type>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Terms of use"
            onPress={() => void Linking.openURL("https://boot-sale-buddy-api.fly.dev/terms")}
          >
            <Type variant="caption" tone="secondary">
              Terms
            </Type>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
            onPress={() => void Linking.openURL("https://boot-sale-buddy-api.fly.dev/privacy")}
          >
            <Type variant="caption" tone="secondary">
              Privacy
            </Type>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function PlanRow({
  offering,
  selected,
  onPress,
}: {
  offering: Offering;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${offering.title}, ${offering.priceLabel} ${offering.periodLabel}`}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        borderRadius: radius.card,
        borderWidth: 1.5,
        borderColor: selected ? theme.color.profit : theme.color.border,
        backgroundColor: selected ? theme.color.profitSurface : theme.color.surface,
        padding: space.lg,
      }}
    >
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={20}
        color={selected ? theme.color.profit : theme.color.textTertiary}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Type variant="headline">{offering.title}</Type>
          {offering.trialDays ? <Pill label={`${offering.trialDays}-day trial`} tone="gold" /> : null}
        </View>
        {offering.subtitle ? (
          <Type variant="caption" tone="secondary">
            {offering.subtitle}
          </Type>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Type variant="headline" tabular>
          {offering.priceLabel}
        </Type>
        <Type variant="caption" tone="tertiary">
          {offering.periodLabel}
        </Type>
      </View>
    </Pressable>
  );
}
