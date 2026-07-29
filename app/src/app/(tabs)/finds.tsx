import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useFinds, type Find, type FindStatus } from "@/api/finds";
import { EmptyState } from "@/components/empty-state";
import { OfflineBanner } from "@/components/offline-banner";
import { FindThumbnail } from "@/components/find-thumbnail";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { useTabBarHeight } from "@/lib/tab-bar";
import { formatPence } from "@/lib/money";

type Filter = FindStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "in_stock", label: "In stock" },
  { key: "sold", label: "Sold" },
  { key: "all", label: "All" },
];

/**
 * My Finds — the portfolio. Each row shows what you paid and what it's
 * worth now, with the profit chip doing the emotional work. Tapping an
 * in-stock item opens the sold flow.
 */
export default function FindsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("in_stock");
  const tabBarHeight = useTabBarHeight();
  const finds = useFinds(filter);

  return (
    <Screen>
      <View style={{ paddingVertical: space.md }}>
        <Type variant="display">My Finds</Type>
      </View>

      <OfflineBanner />

      <View style={{ flexDirection: "row", gap: space.sm, paddingBottom: space.md }}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item.key}
            label={item.label}
            active={filter === item.key}
            onPress={() => {
              haptic.tap();
              setFilter(item.key);
            }}
          />
        ))}
      </View>

      {finds.isPending ? (
        <View style={{ gap: space.sm }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={76} />
          ))}
        </View>
      ) : finds.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your finds"
          body="Check your signal and give it another go."
          cta={{ label: "Retry", onPress: () => void finds.refetch() }}
        />
      ) : (finds.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title={filter === "sold" ? "No sales yet" : "Nothing logged yet"}
          body={
            filter === "sold"
              ? "When you sell something, log it here and watch the profit stack up."
              : "Scan something, tap 'I bought it', and your haul lives here."
          }
          cta={{ label: "Scan your first find", onPress: () => router.navigate("/") }}
        />
      ) : (
        <FlatList
          data={finds.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: space.sm, paddingBottom: tabBarHeight + space.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={finds.isFetching}
          onRefresh={() => void finds.refetch()}
          renderItem={({ item }) => (
            <FindRow
              find={item}
              onPress={() => {
                haptic.tap();
                router.push({ pathname: "/find/[id]", params: { id: item.id } });
              }}
            />
          )}
        />
      )}


    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label}`}
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
        backgroundColor: active ? theme.color.accent : theme.color.surface,
      }}
    >
      <Type
        variant="caption"
        style={{
          fontWeight: "600",
          color: active ? theme.color.onAccent : theme.color.textSecondary,
        }}
      >
        {label}
      </Type>
    </Pressable>
  );
}

function FindRow({ find, onPress }: { find: Find; onPress: () => void }) {
  const theme = useTheme();
  const sold = find.status === "sold";
  const profit = sold ? find.realisedProfitPence : find.unrealisedProfitPence;
  const hasProfit = profit !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${find.name}, paid ${formatPence(find.boughtPricePence)}${
        hasProfit ? `, ${sold ? "profit" : "estimated profit"} ${formatPence(profit)}` : ""
      }`}
      accessibilityHint="Opens this find"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
      })}
    >
      <FindThumbnail findId={find.id} sold={sold} />

      <View style={{ flex: 1, gap: 2 }}>
        <Type variant="headline" numberOfLines={1}>
          {find.name}
        </Type>
        <Type variant="caption" tone="secondary">
          Paid {formatPence(find.boughtPricePence)}
          {sold && find.soldPricePence !== null
            ? ` · sold ${formatPence(find.soldPricePence)}`
            : find.estimatedValuePence !== null
              ? ` · worth ~${formatPence(find.estimatedValuePence)}`
              : ""}
        </Type>
      </View>

      {hasProfit ? (
        <Pill
          label={`${profit >= 0 ? "+" : ""}${formatPence(profit)}`}
          tone={profit >= 0 ? "profit" : "loss"}
        />
      ) : null}
    </Pressable>
  );
}
