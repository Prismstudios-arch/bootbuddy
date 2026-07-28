import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";
import { Type } from "./type";

/**
 * The payoff. Selling something for a proper profit is the whole reason the
 * app exists, and it used to earn a haptic and a new row in a list.
 *
 * Deliberately restrained: gold confetti, one big number, gone in under two
 * seconds without a button to dismiss. Celebration you have to close isn't
 * a celebration, it's a dialog. It also only fires on a genuinely good flip
 * — if every sale gets fireworks, none of them mean anything.
 */
const GREAT_FLIP_PENCE = 1500; // £15 clear profit
const GREAT_MARGIN = 60; // or 60%+ of the sale price kept

export function isGreatFlip(profitPence: number, soldPricePence: number): boolean {
  if (profitPence <= 0) return false;
  const margin = soldPricePence > 0 ? (profitPence / soldPricePence) * 100 : 0;
  return profitPence >= GREAT_FLIP_PENCE || margin >= GREAT_MARGIN;
}

const CONFETTI_COUNT = 14;

export function Celebration({
  profitPence,
  onDone,
}: {
  profitPence: number;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    haptic.greatFind();
    const timer = setTimeout(onDone, 1900);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(240)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`That's a find. ${formatPence(profitPence)} profit.`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.color.scrim,
      }}
    >
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <Confetti key={i} index={i} width={width} height={height} />
      ))}

      <View style={{ alignItems: "center", gap: space.sm }}>
        <View
          style={{
            backgroundColor: theme.color.goldSurface,
            borderRadius: radius.pill,
            paddingVertical: space.sm,
            paddingHorizontal: space.lg,
          }}
        >
          <Type variant="label" tone="gold">
            That&rsquo;s a find
          </Type>
        </View>
        <Type variant="hero" tone="profit">
          {formatPence(profitPence)}
        </Type>
        <Type tone="secondary">in your pocket</Type>
      </View>
    </Animated.View>
  );
}

function Confetti({ index, width, height }: { index: number; width: number; height: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  // Deterministic spread — no random(), so the burst looks composed rather
  // than accidental, and renders identically every time.
  const startX = ((index * 137) % 100) / 100;
  const drift = (((index * 53) % 100) / 100 - 0.5) * width * 0.5;
  const size = 8 + ((index * 7) % 8);
  const colour = [theme.color.gold, theme.color.profit, theme.color.textPrimary][index % 3];

  useEffect(() => {
    progress.value = withDelay(
      index * 28,
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
        withTiming(1.05, { duration: 300 }),
      ),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.85 ? 1 : Math.max(0, (1.05 - progress.value) / 0.2),
    transform: [
      { translateY: -height * 0.32 + progress.value * height * 0.62 },
      { translateX: progress.value * drift },
      { rotate: `${progress.value * 320}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX * width,
          width: size,
          height: size * 1.6,
          borderRadius: 2,
          backgroundColor: colour,
        },
        style,
      ]}
    />
  );
}
