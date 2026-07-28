import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";

const absoluteFill = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * Bottom sheet shell: scrim, slide-up, grab handle, safe-area padding.
 * Hand-built rather than pulled from a library so it matches the design
 * system exactly and adds nothing to the bundle.
 */
export function Sheet({
  onClose,
  children,
  maxHeightPercent = 88,
}: {
  onClose: () => void;
  children: ReactNode;
  maxHeightPercent?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ ...absoluteFill, justifyContent: "flex-end" }}>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{ ...absoluteFill, backgroundColor: theme.color.scrim }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ flex: 1 }}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(180)}
        style={{
          backgroundColor: theme.color.bg,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.lg,
          maxHeight: `${maxHeightPercent}%`,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: theme.color.border,
            marginBottom: space.md,
          }}
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
