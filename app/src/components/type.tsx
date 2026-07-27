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
 * The only way text is rendered in this app. Raw <Text> at a call site is a
 * code-review flag — variants keep the type scale honest.
 */
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
