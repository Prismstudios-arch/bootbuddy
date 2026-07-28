import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { Type } from "./type";

/**
 * Price entry for a field, in gloves, in a hurry. Big tap targets, decimal
 * keypad, and one-tap chips for the amounts that actually come up at a boot
 * sale — most buys are under a fiver and typing "0.50" is three taps too
 * many.
 *
 * Value is held as a string so a half-typed "1." doesn't get mangled;
 * `onChangePence` emits integer pence, which is what the API takes.
 */
export const QUICK_AMOUNTS_PENCE = [50, 100, 200, 500, 1000] as const;

export function penceFromText(text: string): number {
  const clean = text.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function textFromPence(value: number): string {
  return (value / 100).toFixed(2);
}

export function MoneyInput({
  label,
  text,
  onChangeText,
  autoFocus,
  showQuickAmounts = false,
}: {
  label: string;
  text: string;
  onChangeText: (next: string) => void;
  autoFocus?: boolean;
  showQuickAmounts?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: space.sm }}>
      <Type variant="label" tone="secondary">
        {label}
      </Type>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.color.surfaceRaised,
          borderRadius: radius.card,
          paddingHorizontal: space.lg,
        }}
      >
        <Type variant="title" tone="secondary">
          £
        </Type>
        <TextInput
          value={text}
          onChangeText={(next) => onChangeText(next.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor={theme.color.textTertiary}
          accessibilityLabel={label}
          style={{
            flex: 1,
            paddingVertical: space.md,
            paddingLeft: space.sm,
            fontSize: 28,
            fontVariant: ["tabular-nums"],
            color: theme.color.textPrimary,
          }}
        />
      </View>

      {showQuickAmounts ? (
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          {QUICK_AMOUNTS_PENCE.map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Set price to £${(amount / 100).toFixed(2)}`}
              onPress={() => {
                haptic.tap();
                onChangeText(textFromPence(amount));
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
                borderRadius: radius.pill,
                paddingVertical: space.sm,
                paddingHorizontal: space.lg,
              })}
            >
              <Type variant="headline">
                {amount < 100 ? `${amount}p` : `£${amount / 100}`}
              </Type>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
