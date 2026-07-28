import { useState } from "react";
import { View } from "react-native";
import { useLogBuy } from "@/api/finds";
import type { Scan } from "@/api/scans";
import { space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";
import { Button } from "./button";
import { MoneyInput, penceFromText, textFromPence } from "./money-input";
import { Sheet } from "./sheet";
import { Type } from "./type";

/**
 * "I bought it" → logged, in two taps: pick a quick amount, hit Log it.
 * The name and estimated value ride in from the scan, so the only thing
 * the user has to supply is what they actually paid.
 */
export function BuyLogSheet({
  scan,
  onClose,
  onLogged,
}: {
  scan: Scan;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [text, setText] = useState(textFromPence(100));
  const logBuy = useLogBuy();
  const paidPence = penceFromText(text);
  const median = scan.askingPrices?.medianPence ?? null;
  const potential = median !== null ? median - paidPence : null;

  const submit = () => {
    haptic.confirm();
    logBuy.mutate(
      {
        name: scan.name ?? scan.searchQuery,
        boughtPricePence: paidPence,
        scanId: scan.id,
        ...(median !== null ? { estimatedValuePence: median } : {}),
      },
      { onSuccess: onLogged, onError: () => haptic.fail() },
    );
  };

  return (
    <Sheet onClose={onClose} maxHeightPercent={70}>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Type variant="title">{scan.name ?? scan.searchQuery}</Type>
          <Type variant="caption" tone="secondary">
            What did you pay?
          </Type>
        </View>

        <MoneyInput label="Paid" text={text} onChangeText={setText} showQuickAmounts autoFocus />

        {potential !== null ? (
          <Type tone={potential > 0 ? "profit" : "loss"}>
            {potential > 0
              ? `That's about ${formatPence(potential)} of headroom at the median.`
              : `That's above the median — a punt at best.`}
          </Type>
        ) : null}

        <Button
          label={logBuy.isPending ? "Logging…" : "Log it"}
          onPress={submit}
          disabled={logBuy.isPending || paidPence < 0}
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
