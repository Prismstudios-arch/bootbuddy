import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/design/theme";
import { motion, radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { Type } from "./type";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: "primary" | "ghost";
};

/**
 * The app's one button. Presses scale to 0.97 over motion.fast with a
 * selection haptic — the same tactile grammar everywhere.
 */
export function Button({ label, variant = "primary", onPress, disabled, ...rest }: Props) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    opacity: 1 - pressed.value * 0.1,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: motion.fast });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: motion.fast });
      }}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      style={[
        animatedStyle,
        {
          borderRadius: radius.pill,
          paddingVertical: space.md + 2,
          paddingHorizontal: space.xl,
          alignItems: "center",
          backgroundColor: variant === "primary" ? theme.color.accent : "transparent",
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: theme.color.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
      {...rest}
    >
      <Type
        variant="headline"
        style={{
          color: variant === "primary" ? theme.color.onAccent : theme.color.textPrimary,
        }}
      >
        {label}
      </Type>
    </AnimatedPressable>
  );
}
