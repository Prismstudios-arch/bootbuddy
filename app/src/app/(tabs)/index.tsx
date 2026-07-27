import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";

/**
 * Scan — the home tab. This placeholder carries the final layout: full-bleed
 * viewfinder area, torch toggle, one giant shutter, recent-scans strip.
 * Phase 3 swaps the mock viewfinder for expo-camera and wires the shutter to
 * compress → upload → Result Sheet.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen edgeToEdge>
      {/* Viewfinder area */}
      <View
        style={{
          flex: 1,
          margin: space.md,
          marginTop: insets.top + space.sm,
          borderRadius: radius.sheet,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: theme.color.border,
          backgroundColor: theme.color.surface,
          alignItems: "center",
          justifyContent: "center",
          gap: space.md,
        }}
      >
        <Ionicons name="scan-outline" size={56} color={theme.color.textTertiary} />
        <Type variant="title">Point it at treasure</Type>
        <Type tone="secondary" style={{ textAlign: "center", maxWidth: 260 }}>
          Frame the item, hit the shutter, and see what it&rsquo;s going for on
          eBay right now.
        </Type>
        <Pill label="Camera lands in Phase 3" />
      </View>

      {/* Controls row */}
      <View
        style={{
          paddingBottom: insets.bottom + space.md,
          paddingTop: space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-evenly",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle torch"
          onPress={() => haptic.tap()}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.color.surface,
          }}
        >
          <Ionicons name="flashlight-outline" size={22} color={theme.color.textSecondary} />
        </Pressable>

        {/* The shutter: 76pt, ringed, unmissable with cold thumbs */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan item"
          accessibilityHint="Takes a photo and looks up its resale value"
          onPress={() => haptic.confirm()}
          style={{
            width: 76,
            height: 76,
            borderRadius: radius.pill,
            borderWidth: 4,
            borderColor: theme.color.shutter,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: radius.pill,
              backgroundColor: theme.color.shutter,
            }}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recent scans"
          onPress={() => haptic.tap()}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.color.surface,
          }}
        >
          <Ionicons name="time-outline" size={22} color={theme.color.textSecondary} />
        </Pressable>
      </View>
    </Screen>
  );
}
