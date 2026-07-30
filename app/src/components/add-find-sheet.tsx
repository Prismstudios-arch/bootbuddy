import { useState } from "react";
import { TextInput, View } from "react-native";
import { useLogBuy } from "@/api/finds";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { Button } from "./button";
import { MoneyInput, penceFromText, textFromPence } from "./money-input";
import { Sheet } from "./sheet";
import { Type } from "./type";

/**
 * Log something by hand, without a scan.
 *
 * Scanning is metered; logging is not, and never should be — the portfolio
 * is only useful if it holds everything you bought, not just the things the
 * camera happened to recognise. Without this there was no way to record a
 * job lot, a box of bits, or anything bought before you installed the app,
 * which quietly made the profit figures wrong rather than merely
 * incomplete.
 */
export function AddFindSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [paid, setPaid] = useState(textFromPence(100));
  const [worth, setWorth] = useState("");
  const logBuy = useLogBuy();

  const paidPence = penceFromText(paid);
  const worthPence = penceFromText(worth);
  const canSave = name.trim().length > 0 && !logBuy.isPending;

  const save = () => {
    haptic.confirm();
    logBuy.mutate(
      {
        name: name.trim(),
        boughtPricePence: paidPence,
        ...(worthPence > 0 ? { estimatedValuePence: worthPence } : {}),
      },
      { onSuccess: onAdded, onError: () => haptic.fail() },
    );
  };

  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Type variant="title">Add a find</Type>
          <Type variant="caption" tone="secondary">
            For job lots, boxes of bits, or anything the camera can&rsquo;t make out.
          </Type>
        </View>

        <View style={{ gap: space.sm }}>
          <Type variant="label" tone="secondary">
            What is it?
          </Type>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Box of vinyl, Denby dinner set…"
            accessibilityLabel="Item name"
            placeholderTextColor={theme.color.textTertiary}
            returnKeyType="done"
            style={{
              backgroundColor: theme.color.surfaceRaised,
              borderRadius: radius.card,
              padding: space.md,
              color: theme.color.textPrimary,
              fontSize: 17,
            }}
          />
        </View>

        <MoneyInput label="Paid" text={paid} onChangeText={setPaid} showQuickAmounts />

        <MoneyInput
          label="Worth about (optional)"
          text={worth}
          onChangeText={setWorth}
        />

        <Button
          label={logBuy.isPending ? "Saving…" : "Add to my finds"}
          onPress={save}
          disabled={!canSave}
        />

        {logBuy.isError ? (
          <Type tone="loss" variant="caption">
            Couldn&rsquo;t save that. Try again?
          </Type>
        ) : null}
      </View>
    </Sheet>
  );
}
