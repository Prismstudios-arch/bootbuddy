import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/design/theme";
import { radius } from "@/design/tokens";

/**
 * Shimmer placeholder — content areas never show a spinner. A spinner says
 * "wait"; a skeleton says "here's what's coming", which makes the same
 * latency feel shorter.
 */
export function Skeleton({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const shimmer = useSharedValue(0.35);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(0.75, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius.card, backgroundColor: theme.color.surfaceRaised },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** The result sheet's loading state — mirrors the real layout's rhythm. */
export function ResultSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="45%" height={56} />
      <Skeleton width="100%" height={8} />
      <Skeleton width="35%" height={14} />
    </View>
  );
}
