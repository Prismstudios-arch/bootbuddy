import { Ionicons } from "@expo/vector-icons";
import { useRouter, useScrollToTop } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useFinds, useRevalue, type Find, type FindStatus } from "@/api/finds";
import { AddFindSheet } from "@/components/add-find-sheet";
import { BackupPrompt } from "@/components/backup-prompt";
import { PortfolioHeader, SoldSummary } from "@/components/portfolio-header";
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
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>("in_stock");
  const tabBarHeight = useTabBarHeight();
  const finds = useFinds(filter);
  const revalue = useRevalue();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  // Tapping the active tab scrolls back to the top — an iOS convention old
  // enough that its absence reads as a bug once a haul gets long.
  const listRef = useRef<FlatList<Find>>(null);
  useScrollToTop(listRef);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? (finds.data ?? []).filter((f) => f.name.toLowerCase().includes(needle))
    : (finds.data ?? []);

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: space.md,
        }}
      >
        <Type variant="display">My Finds</Type>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a find by hand"
          onPress={() => {
            haptic.tap();
            setAdding(true);
          }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
          })}
        >
          <Ionicons name="add" size={26} color={theme.color.textPrimary} />
        </Pressable>
      </View>

      <OfflineBanner />
      <BackupPrompt findCount={finds.data?.length ?? 0} />
      {filter === "sold" ? (
        <SoldSummary finds={finds.data ?? []} />
      ) : (
        <PortfolioHeader finds={finds.data ?? []} />
      )}

      {(finds.data?.length ?? 0) > 5 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            backgroundColor: theme.color.surfaceRaised,
            borderRadius: radius.card,
            paddingHorizontal: space.md,
            marginBottom: space.sm,
          }}
        >
          <Ionicons name="search" size={16} color={theme.color.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your finds"
            accessibilityLabel="Search your finds"
            placeholderTextColor={theme.color.textTertiary}
            style={{
              flex: 1,
              paddingVertical: space.md,
              color: theme.color.textPrimary,
              fontSize: 16,
            }}
          />
        </View>
      ) : null}

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
      ) : visible.length === 0 ? (
        // Searching down to nothing must say so. A blank list under a filled
        // search box looks like the app lost your stuff.
        <EmptyState
          icon="search-outline"
          title="Nothing matches that"
          body={`No finds with “${query.trim()}” in the name.`}
          cta={{ label: "Clear search", onPress: () => setQuery("") }}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: space.sm, paddingBottom: tabBarHeight + space.xxl }}
          showsVerticalScrollIndicator={false}
          refreshing={finds.isFetching || revalue.isPending}
          onRefresh={() => {
            // Pull-to-refresh re-prices the portfolio, not just re-reads it.
            haptic.tap();
            revalue.mutate(undefined, { onSettled: () => void finds.refetch() });
          }}
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

      {adding ? (
        <AddFindSheet
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void finds.refetch();
          }}
        />
      ) : null}
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
      <FindThumbnail findId={find.id} sold={sold} size={60} />

      <View style={{ flex: 1, gap: 3 }}>
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
        {/* Movement since the last refresh — the bit that makes a portfolio
            feel alive rather than a static list of receipts. */}
        {!sold && find.valueChangePence ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons
              name={find.valueChangePence > 0 ? "arrow-up" : "arrow-down"}
              size={11}
              color={find.valueChangePence > 0 ? theme.color.profit : theme.color.loss}
            />
            <Type
              variant="caption"
              style={{
                color: find.valueChangePence > 0 ? theme.color.profit : theme.color.loss,
                fontWeight: "600",
              }}
            >
              {formatPence(Math.abs(find.valueChangePence))} since last check
            </Type>
          </View>
        ) : null}
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
