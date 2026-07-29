import { Ionicons } from "@expo/vector-icons";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useTheme } from "@/design/theme";
import { motion, radius, space } from "@/design/tokens";
import { Type } from "./type";

/**
 * Offline banner.
 *
 * Car boot sales are fields, and fields have one bar of signal at best.
 * Without this, a screen full of cached finds is indistinguishable from
 * live data — so someone could look at a stale figure and buy on it. The
 * banner says "this is what we last knew", which is the honest framing.
 *
 * It reads react-query's own online state rather than adding a netinfo
 * dependency: the same signal that drives refetch-on-reconnect drives the
 * banner, so they can never disagree about whether we're connected.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const [online, setOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setOnline), []);

  if (online) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(motion.base)}
      exiting={FadeOutUp.duration(motion.fast)}
      accessibilityLiveRegion="polite"
      accessibilityLabel="You're offline. Showing your last saved data."
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: theme.color.goldSurface,
        borderRadius: radius.card,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        marginBottom: space.sm,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.color.gold} />
      <View style={{ flex: 1 }}>
        <Type variant="caption" tone="gold" style={{ fontWeight: "600" }}>
          No signal — showing your last saved figures
        </Type>
      </View>
    </Animated.View>
  );
}
