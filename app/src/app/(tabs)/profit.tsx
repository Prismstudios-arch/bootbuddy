import { RefreshControl, ScrollView, View } from "react-native";
import { useStats } from "@/api/finds";
import { CountUpPrice } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { OfflineBanner } from "@/components/offline-banner";
import { FindThumbnail } from "@/components/find-thumbnail";
import { ProfitChart } from "@/components/profit-chart";
import { Screen } from "@/components/screen";
import { ShareFlipButton } from "@/components/share-flip-button";
import { Skeleton } from "@/components/skeleton";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { formatPence } from "@/lib/money";
import { useTabBarHeight } from "@/lib/tab-bar";

/**
 * Profit — the dopamine screen. Realised profit is the hero; everything
 * else supports it. The share card turns a good flip into free marketing.
 */
export default function ProfitScreen() {
  const theme = useTheme();
  const stats = useStats();
  // Without this the last card sits under the tab bar and its button is
  // literally cut in half.
  const tabBarHeight = useTabBarHeight();

  const best = stats.data?.bestFlip ?? null;
  if (stats.isPending) {
    return (
      <Screen>
        <View style={{ paddingVertical: space.md }}>
          <Type variant="display">Profit</Type>
        </View>

        <OfflineBanner />
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
        contentContainerStyle={{ paddingBottom: tabBarHeight + space.xxl }}
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

        <OfflineBanner />

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
            label="Haul value"
            value={formatPence(data.stockValuePence)}
            sub={
              data.stockChangePence !== 0
                ? `${data.stockChangePence > 0 ? "▲" : "▼"} ${formatPence(Math.abs(data.stockChangePence))} since last check`
                : `${data.inStockCount} ${data.inStockCount === 1 ? "item" : "items"} in stock`
            }
            subTone={
              data.stockChangePence > 0 ? "profit" : data.stockChangePence < 0 ? "loss" : undefined
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <FindThumbnail findId={best.id} sold size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Type variant="title" numberOfLines={2}>
                  {best.name}
                </Type>
                <Type tone="secondary" variant="caption">
                  {formatPence(best.boughtPricePence)} → {formatPence(best.soldPricePence)}
                </Type>
              </View>
            </View>
            <Type variant="display" tone="gold">
              {formatPence(best.profitPence)}
            </Type>
            <View style={{ marginTop: space.sm }}>
              <ShareFlipButton
                find={{
                  id: best.id,
                  name: best.name,
                  boughtPricePence: best.boughtPricePence,
                  soldPricePence: best.soldPricePence,
                  profitPence: best.profitPence,
                }}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

    </Screen>
  );
}

function StatCard({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "profit" | "loss";
}) {
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
        <Type
          variant="caption"
          tone={subTone ?? "tertiary"}
          style={subTone ? { fontWeight: "600" } : undefined}
        >
          {sub}
        </Type>
      ) : null}
    </View>
  );
}
