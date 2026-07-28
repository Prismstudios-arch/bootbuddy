import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useStats } from "@/api/finds";
import { Button } from "@/components/button";
import { CountUpPrice } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { ProfitChart } from "@/components/profit-chart";
import { Screen } from "@/components/screen";
import { ShareCard, type ShareCardData } from "@/components/share-card";
import { Skeleton } from "@/components/skeleton";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";

/**
 * Profit — the dopamine screen. Realised profit is the hero; everything
 * else supports it. The share card turns a good flip into free marketing.
 */
export default function ProfitScreen() {
  const theme = useTheme();
  const stats = useStats();
  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const best = stats.data?.bestFlip ?? null;
  const shareData: ShareCardData | null = best
    ? {
        name: best.name,
        boughtPricePence: best.boughtPricePence,
        soldPricePence: best.soldPricePence,
        profitPence: best.profitPence,
      }
    : null;

  const share = async () => {
    if (!shareCardRef.current) return;
    haptic.greatFind();
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your find" });
      }
    } catch {
      haptic.fail();
    } finally {
      setSharing(false);
    }
  };

  if (stats.isPending) {
    return (
      <Screen>
        <View style={{ paddingVertical: space.md }}>
          <Type variant="display">Profit</Type>
        </View>
        <View style={{ gap: space.lg, marginTop: space.xl }}>
          <Skeleton width="50%" height={56} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={88} />
        </View>
      </Screen>
    );
  }

  if (stats.isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your numbers"
          body="Check your signal and give it another go."
          cta={{ label: "Retry", onPress: () => void stats.refetch() }}
        />
      </Screen>
    );
  }

  const data = stats.data;
  if (!data) return null;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={stats.isFetching}
            onRefresh={() => void stats.refetch()}
            tintColor={theme.color.textSecondary}
          />
        }
      >
        <View style={{ paddingVertical: space.md }}>
          <Type variant="display">Profit</Type>
        </View>

        <View style={{ marginTop: space.lg, gap: space.xs }}>
          <Type variant="label" tone="secondary">
            Realised profit
          </Type>
          <CountUpPrice
            pence={data.realisedProfitPence}
            tone={data.realisedProfitPence > 0 ? "profit" : "primary"}
          />
          <Type tone="secondary">
            {data.soldCount === 0
              ? "Log a sale and watch this number wake up."
              : `${data.soldCount} ${data.soldCount === 1 ? "flip" : "flips"} · ${
                  data.averageMarginPercent ?? 0
                }% average margin`}
          </Type>
        </View>

        <View style={{ flexDirection: "row", gap: space.md, marginTop: space.xl }}>
          <StatCard label="This month" value={formatPence(data.thisMonthPence)} />
          <StatCard label="Last month" value={formatPence(data.lastMonthPence)} />
        </View>

        <View style={{ flexDirection: "row", gap: space.md, marginTop: space.md }}>
          <StatCard
            label="In stock"
            value={`${data.inStockCount}`}
            sub={
              data.unrealisedProfitPence !== 0
                ? `${formatPence(data.unrealisedProfitPence)} unrealised`
                : undefined
            }
          />
          <StatCard label="Spent" value={formatPence(data.totalSpentPence)} />
        </View>

        <View
          style={{
            marginTop: space.xl,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            padding: space.lg,
            gap: space.md,
          }}
        >
          <Type variant="label" tone="secondary">
            Last 6 months
          </Type>
          <ProfitChart data={data.monthly} />
        </View>

        {best ? (
          <View
            style={{
              marginTop: space.xl,
              backgroundColor: theme.color.surface,
              borderRadius: radius.card,
              padding: space.lg,
              gap: space.sm,
            }}
          >
            <Type variant="label" tone="secondary">
              Best flip ever
            </Type>
            <Type variant="title">{best.name}</Type>
            <Type tone="secondary" variant="caption">
              {formatPence(best.boughtPricePence)} → {formatPence(best.soldPricePence)}
            </Type>
            <Type variant="display" tone="gold">
              {formatPence(best.profitPence)}
            </Type>
            <View style={{ marginTop: space.sm }}>
              <Button
                label={sharing ? "Preparing…" : "Share this win"}
                onPress={() => void share()}
                disabled={sharing}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Rendered off-screen purely so view-shot has something to capture. */}
      {shareData ? (
        <View style={{ position: "absolute", left: -9999, top: 0 }} pointerEvents="none">
          <ShareCard ref={shareCardRef} data={shareData} />
        </View>
      ) : null}
    </Screen>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: space.xs,
      }}
    >
      <Type variant="label" tone="secondary">
        {label}
      </Type>
      <Type variant="title" tabular>
        {value}
      </Type>
      {sub ? (
        <Type variant="caption" tone="tertiary">
          {sub}
        </Type>
      ) : null}
    </View>
  );
}
