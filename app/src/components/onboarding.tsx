import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/design/theme";
import { motion, radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { useAppStore } from "@/state/app-store";
import { Button } from "./button";
import { Type } from "./type";

/**
 * First launch, three screens, then out of the way forever.
 *
 * The job is to earn the camera permission, not to explain the app — so it
 * leads with the one sentence that makes someone want it, shows the loop in
 * three beats, and only then asks. Skippable on every screen: a person who
 * already knows what they downloaded shouldn't have to sit through it.
 */
type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: "gold" | "profit" | "primary";
};

const SLIDES: Slide[] = [
  {
    icon: "search",
    title: "Know what it's worth\nbefore you buy",
    body: "Point your camera at anything on the table. We'll tell you what it's fetching on eBay right now — before you hand over the 50p.",
    accent: "gold",
  },
  {
    icon: "pricetags",
    title: "Log the buy.\nLog the sale.",
    body: "Two taps to record what you paid. When it sells, pop the price in and we'll work out the profit after fees and postage.",
    accent: "primary",
  },
  {
    icon: "trending-up",
    title: "Watch the profit\nstack up",
    body: "Your whole haul in one place, like a trading portfolio. Then share the wins — because a 50p-to-£42 flip deserves an audience.",
    accent: "profit",
  },
];

export function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  if (!slide) return null;

  const accentColour =
    slide.accent === "gold"
      ? theme.color.gold
      : slide.accent === "profit"
        ? theme.color.profit
        : theme.color.textPrimary;

  const advance = () => {
    haptic.tap();
    if (isLast) {
      completeOnboarding();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bg,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.gutter,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          hitSlop={16}
          onPress={() => {
            haptic.tap();
            completeOnboarding();
          }}
        >
          <Type variant="caption" tone="secondary">
            Skip
          </Type>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: "center", gap: space.xl }}>
        {/* Keyed on index so each slide animates in as its own thing. */}
        <Animated.View
          key={`art-${index}`}
          entering={FadeIn.duration(motion.slow)}
          exiting={FadeOut.duration(motion.fast)}
          style={{
            width: Math.min(width * 0.42, 180),
            height: Math.min(width * 0.42, 180),
            borderRadius: radius.pill,
            alignSelf: "center",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.color.surface,
          }}
        >
          <Ionicons name={slide.icon} size={64} color={accentColour} />
        </Animated.View>

        <Animated.View key={`copy-${index}`} entering={FadeInDown.duration(motion.slow)}>
          <Type variant="display" style={{ textAlign: "center" }}>
            {slide.title}
          </Type>
          <Type
            tone="secondary"
            style={{ textAlign: "center", marginTop: space.md, lineHeight: 24 }}
          >
            {slide.body}
          </Type>
        </Animated.View>
      </View>

      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: space.sm }}>
          {SLIDES.map((item, i) => (
            <View
              key={item.title}
              accessibilityElementsHidden
              style={{
                width: i === index ? 20 : 8,
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: i === index ? theme.color.textPrimary : theme.color.surfaceRaised,
              }}
            />
          ))}
        </View>

        <Button label={isLast ? "Let's have a look then" : "Next"} onPress={advance} />
      </View>
    </View>
  );
}
