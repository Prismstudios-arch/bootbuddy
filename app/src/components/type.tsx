import { Text, type TextProps } from "react-native";
import { useTheme } from "@/design/theme";
import { type as typeScale, type TypeVariant } from "@/design/tokens";

type Tone = "primary" | "secondary" | "tertiary" | "profit" | "loss" | "gold";

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Force tabular figures — on by default for hero/display so counting
   *  numbers never jitter. */
  tabular?: boolean;
};

/**
 * Dynamic Type caps.
 *
 * Text scales with the reader's system setting — never disabled, because
 * that's someone's accessibility need, not a preference. But a 56pt hero
 * price at 3× would push the buttons off a result sheet, so the big display
 * sizes are capped tighter than body copy: they're already large, so they
 * need less help, while captions and body text get the full useful range.
 */
const MAX_SCALE: Record<TypeVariant, number> = {
  hero: 1.25,
  display: 1.3,
  title: 1.4,
  headline: 1.6,
  body: 1.8,
  caption: 1.8,
  label: 1.6,
};

export function Type({
  variant = "body",
  tone = "primary",
  tabular,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const toneColor: Record<Tone, string> = {
    primary: theme.color.textPrimary,
    secondary: theme.color.textSecondary,
    tertiary: theme.color.textTertiary,
    profit: theme.color.profit,
    loss: theme.color.loss,
    gold: theme.color.gold,
  };
  const wantsTabular = tabular ?? (variant === "hero" || variant === "display");

  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[
        typeScale[variant],
        { color: toneColor[tone] },
        wantsTabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}
