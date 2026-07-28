import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Pressable, TextInput, View } from "react-native";
import { useRefineMutation, type Quota, type Scan } from "@/api/scans";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";
import { Button } from "./button";
import { CountUpPrice } from "./count-up";
import { Pill } from "./pill";
import { Sheet } from "./sheet";
import { ResultSkeleton } from "./skeleton";
import { Type } from "./type";

/**
 * The Result Sheet. Slides up over the frozen frame with the price counting
 * in. Everything the user needs to make a 5-second buy/skip decision:
 * what it is, how sure we are, what it's fetching, and the most they should
 * pay.
 */
type Props = {
  state: "loading" | "error" | "success";
  scan?: Scan;
  quota?: Quota;
  errorMessage?: string;
  onClose: () => void;
  onRetry: () => void;
  onBought: (scan: Scan) => void;
};

export function ResultSheet({
  state,
  scan,
  quota,
  errorMessage,
  onClose,
  onRetry,
  onBought,
}: Props) {
  return (
    <Sheet onClose={onClose}>
      {state === "loading" ? (
        <View style={{ gap: space.md, paddingVertical: space.sm }}>
          <Type variant="label" tone="secondary">
            Checking the market…
          </Type>
          <ResultSkeleton />
        </View>
      ) : state === "error" ? (
        <ErrorBody message={errorMessage} onRetry={onRetry} />
      ) : scan ? (
        <SuccessBody scan={scan} quota={quota} onBought={onBought} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

function ErrorBody({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.lg }}>
      <Ionicons name="cloud-offline-outline" size={40} color={theme.color.textTertiary} />
      <Type variant="title" style={{ textAlign: "center" }}>
        {message ?? "Couldn't reach the shops."}
      </Type>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

function SuccessBody({
  scan,
  quota,
  onBought,
  onClose,
}: {
  scan: Scan;
  quota?: Quota;
  onBought: (scan: Scan) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [refining, setRefining] = useState(false);
  const [draftQuery, setDraftQuery] = useState(scan.searchQuery);
  const refine = useRefineMutation(scan.id);
  const current = refine.data?.scan ?? scan;
  const prices = current.askingPrices;
  const lowConfidence = current.confidence < 0.55;

  if (!current.name) {
    return (
      <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.lg }}>
        <Ionicons name="help-circle-outline" size={40} color={theme.color.textTertiary} />
        <Type variant="title" style={{ textAlign: "center" }}>
          Couldn&rsquo;t make that out
        </Type>
        <Type tone="secondary" style={{ textAlign: "center", maxWidth: 280 }}>
          Get a bit closer, or find a label. Good light helps.
        </Type>
        <Button label="Try again" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Type variant="title">{current.name}</Type>
        <Type variant="caption" tone="secondary">
          {confidenceLabel(current.confidence)}
        </Type>
      </View>

      {prices ? (
        <>
          <View style={{ gap: space.xs }}>
            <CountUpPrice pence={prices.medianPence} />
            <Type variant="caption" tone="secondary">
              Asking prices on eBay UK right now · {prices.listingCount} listings
            </Type>
          </View>

          <RangeBar low={prices.lowPence} median={prices.medianPence} high={prices.highPence} />

          <View
            style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.card,
              padding: space.lg,
              gap: space.xs,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Type variant="label" tone="secondary">
                Your max buy price
              </Type>
              <Ionicons name="information-circle-outline" size={14} color={theme.color.textTertiary} />
            </View>
            <Type variant="display" tone="profit">
              {formatPence(prices.maxBuyPence)}
            </Type>
            <Type variant="caption" tone="tertiary">
              40% of the median — leaves room for eBay fees, postage and a worthwhile margin.
            </Type>
          </View>
        </>
      ) : (
        <View
          style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            padding: space.lg,
            gap: space.sm,
          }}
        >
          <Type variant="headline">Market data unavailable</Type>
          <Type variant="caption" tone="secondary">
            We know what it is, but couldn&rsquo;t fetch prices just now.
          </Type>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry price lookup"
            onPress={() => {
              haptic.tap();
              refine.mutate(current.searchQuery);
            }}
          >
            <Type variant="headline" tone="profit">
              Tap to retry
            </Type>
          </Pressable>
        </View>
      )}

      {lowConfidence || refining ? (
        <View style={{ gap: space.sm }}>
          {!refining ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refine the item name"
              onPress={() => {
                haptic.tap();
                setRefining(true);
              }}
            >
              <Type variant="headline" tone="secondary">
                Not quite right? Refine it →
              </Type>
            </Pressable>
          ) : (
            <>
              <Type variant="label" tone="secondary">
                What is it?
              </Type>
              <TextInput
                value={draftQuery}
                onChangeText={setDraftQuery}
                autoFocus
                returnKeyType="search"
                accessibilityLabel="Corrected item name"
                placeholderTextColor={theme.color.textTertiary}
                onSubmitEditing={() => {
                  haptic.confirm();
                  refine.mutate(draftQuery.trim());
                  setRefining(false);
                }}
                style={{
                  backgroundColor: theme.color.surfaceRaised,
                  borderRadius: radius.card,
                  padding: space.md,
                  color: theme.color.textPrimary,
                  fontSize: 16,
                }}
              />
            </>
          )}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          label="I bought it"
          onPress={() => {
            haptic.confirm();
            onBought(current);
          }}
        />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Skip" variant="ghost" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Vinted"
              variant="ghost"
              onPress={() => {
                haptic.tap();
                void Linking.openURL(
                  `https://www.vinted.co.uk/catalog?search_text=${encodeURIComponent(current.searchQuery)}`,
                );
              }}
            />
          </View>
        </View>
      </View>

      {quota ? (
        <View style={{ alignItems: "center" }}>
          <Pill
            label={
              quota.limit - quota.used > 0
                ? `${quota.limit - quota.used} scans left today`
                : "No scans left today"
            }
            tone={quota.limit - quota.used > 0 ? "neutral" : "gold"}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Honest confidence, in plain English rather than a percentage. */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "Certain";
  if (confidence >= 0.55) return "Pretty sure";
  if (confidence >= 0.3) return "Best guess — worth a check";
  return "Not confident — refine it below";
}

function RangeBar({ low, median, high }: { low: number; median: number; high: number }) {
  const theme = useTheme();
  const span = Math.max(1, high - low);
  const markerPercent = Math.min(100, Math.max(0, ((median - low) / span) * 100));

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: theme.color.surfaceRaised,
          overflow: "visible",
          justifyContent: "center",
        }}
      >
        <View
          accessibilityElementsHidden
          style={{
            position: "absolute",
            left: `${markerPercent}%`,
            width: 4,
            height: 16,
            borderRadius: radius.pill,
            backgroundColor: theme.color.profit,
            marginLeft: -2,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Type variant="caption" tone="tertiary">
          {formatPence(low)}
        </Type>
        <Type variant="caption" tone="tertiary">
          {formatPence(high)}
        </Type>
      </View>
    </View>
  );
}
