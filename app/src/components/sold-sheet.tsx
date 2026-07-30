import { useState } from "react";
import { View } from "react-native";
import { useUpdateFind, type Find } from "@/api/finds";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";
import { useAppStore } from "@/state/app-store";
import { Button } from "./button";
import { MoneyInput, penceFromText, textFromPence } from "./money-input";
import { Sheet } from "./sheet";
import { Type } from "./type";

/**
 * Mark as sold. Fees are pre-filled from the user's default (13% eBay) and
 * recalculated as they type the sale price — but stay editable, because
 * Vinted, Depop and a bloke at the pub all charge differently.
 */
export function SoldSheet({
  find,
  onClose,
  onSold,
}: {
  find: Find;
  onClose: () => void;
  onSold: (updated: Find) => void;
}) {
  const theme = useTheme();
  const feePercent = useAppStore((s) => s.defaultFeePercent);
  const [priceText, setPriceText] = useState("");
  const [feesEdited, setFeesEdited] = useState(false);
  const [feesText, setFeesText] = useState("0.00");
  const [postageText, setPostageText] = useState("0.00");
  const update = useUpdateFind(find.id);

  const soldPence = penceFromText(priceText);
  const autoFees = Math.round((soldPence * feePercent) / 100);
  const feesPence = feesEdited ? penceFromText(feesText) : autoFees;
  const postagePence = penceFromText(postageText);
  const profit = soldPence - find.boughtPricePence - feesPence - postagePence;
  const isWin = profit > 0;

  const submit = () => {
    if (isWin) haptic.greatFind();
    else haptic.confirm();
    update.mutate(
      { status: "sold", soldPricePence: soldPence, feesPence, postagePence },
      { onSuccess: (data) => onSold(data.find), onError: () => haptic.fail() },
    );
  };

  return (
    // Only ever opened from the find detail screen, which is a pushed route
    // with no tab bar to clear.
    <Sheet onClose={onClose} overTabBar={false}>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Type variant="title">{find.name}</Type>
          <Type variant="caption" tone="secondary">
            You paid {formatPence(find.boughtPricePence)}
          </Type>
        </View>

        <MoneyInput
          label="Sold for"
          text={priceText}
          onChangeText={setPriceText}
          autoFocus
        />

        <MoneyInput
          label={feesEdited ? "Selling fees" : `Selling fees (${feePercent}% estimate)`}
          text={feesEdited ? feesText : textFromPence(autoFees)}
          onChangeText={(next) => {
            setFeesEdited(true);
            setFeesText(next);
          }}
        />

        <MoneyInput label="Postage you paid" text={postageText} onChangeText={setPostageText} />

        <View
          style={{
            backgroundColor: isWin ? theme.color.profitSurface : theme.color.surface,
            borderRadius: radius.card,
            padding: space.lg,
            gap: space.xs,
          }}
        >
          <Type variant="label" tone="secondary">
            Your profit
          </Type>
          <Type variant="display" tone={soldPence === 0 ? "secondary" : isWin ? "profit" : "loss"}>
            {formatPence(profit)}
          </Type>
        </View>

        <Button
          label={update.isPending ? "Saving…" : "Mark as sold"}
          onPress={submit}
          disabled={update.isPending || soldPence <= 0}
        />
        {update.isError ? (
          <Type tone="loss" variant="caption">
            Couldn&rsquo;t save that. Try again?
          </Type>
        ) : null}
      </View>
    </Sheet>
  );
}
