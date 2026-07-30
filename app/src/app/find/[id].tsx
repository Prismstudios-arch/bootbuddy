import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeleteFind, useFinds, useUpdateFind, type Find } from "@/api/finds";
import { Button } from "@/components/button";
import { Celebration, isGreatFlip } from "@/components/celebration";
import { EmptyState } from "@/components/empty-state";
import { FindThumbnail } from "@/components/find-thumbnail";
import { MoneyInput, penceFromText, textFromPence } from "@/components/money-input";
import { Pill } from "@/components/pill";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { ShareFlipButton } from "@/components/share-flip-button";
import { Skeleton } from "@/components/skeleton";
import { SoldSheet } from "@/components/sold-sheet";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { formatPence } from "@/lib/money";
import { deleteFindPhoto, findPhotoUri } from "@/lib/photos";

/**
 * A single find. The screen that was missing: previously a sold item was a
 * dead end — you couldn't see how the profit was arrived at, fix a typo in
 * the price, or get rid of something logged by mistake.
 *
 * The profit breakdown is the centrepiece. "£0.44" on its own looks like a
 * disappointment; showing the £1.56 of eBay fees that caused it is the
 * thing that actually teaches someone to price better next time.
 */
export default function FindDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Read from the list cache rather than adding an endpoint: it's already
  // fetched, and it means this screen opens instantly and works offline.
  const finds = useFinds("all");
  const find = finds.data?.find((item) => item.id === id);

  const [selling, setSelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [celebrating, setCelebrating] = useState<number | null>(null);

  if (finds.isPending) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top, gap: space.lg }}>
          <Skeleton width="100%" height={220} />
          <Skeleton width="60%" height={28} />
          <Skeleton width="100%" height={140} />
        </View>
      </Screen>
    );
  }

  if (!find) {
    return (
      <Screen>
        <BackBar onBack={() => router.back()} />
        <EmptyState
          icon="help-circle-outline"
          title="Can't find that one"
          body="It may have been deleted."
          cta={{ label: "Back to My Finds", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const sold = find.status === "sold";
  const photoUri = findPhotoUri(find.id);

  return (
    <Screen edgeToEdge>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      >
        {/* Photo as a hero when there is one — it's the most recognisable
            thing about a find, far more than its name. */}
        <View>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              accessibilityIgnoresInvertColors
              style={{ width: "100%", height: 280, backgroundColor: theme.color.surface }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                height: 180,
                backgroundColor: theme.color.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FindThumbnail findId={find.id} sold={sold} size={64} />
            </View>
          )}
          <View style={{ position: "absolute", top: insets.top + space.sm, left: space.sm }}>
            <RoundButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          </View>
        </View>

        <View style={{ padding: space.gutter, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Pill
              label={sold ? "Sold" : "In stock"}
              tone={sold ? "profit" : "neutral"}
            />
            <Type variant="display">{find.name}</Type>
            {timeline(find) ? (
              <Type variant="caption" tone="tertiary">
                {timeline(find)}
              </Type>
            ) : null}
          </View>

          <ProfitBreakdown find={find} />

          {find.notes ? (
            <View
              style={{
                backgroundColor: theme.color.surface,
                borderRadius: radius.card,
                padding: space.lg,
                gap: space.xs,
              }}
            >
              <Type variant="label" tone="secondary">
                Notes
              </Type>
              <Type tone="secondary">{find.notes}</Type>
            </View>
          ) : null}

          <View style={{ gap: space.sm }}>
            {!sold ? (
              <Button
                label="Mark as sold"
                onPress={() => {
                  haptic.tap();
                  setSelling(true);
                }}
              />
            ) : (
              <ShareFlipButton
                find={{
                  id: find.id,
                  name: find.name,
                  boughtPricePence: find.boughtPricePence,
                  soldPricePence: find.soldPricePence ?? 0,
                  profitPence: find.realisedProfitPence ?? 0,
                }}
              />
            )}

            <Button
              label="Edit details"
              variant="ghost"
              onPress={() => {
                haptic.tap();
                setEditing(true);
              }}
            />

            {sold ? <PutBackButton find={find} /> : null}

            <DeleteButton
              find={find}
              onDeleted={() => {
                deleteFindPhoto(find.id);
                router.back();
              }}
            />
          </View>
        </View>
      </ScrollView>

      {selling ? (
        <SoldSheet
          find={find}
          onClose={() => setSelling(false)}
          onSold={(updated) => {
            setSelling(false);
            const profit = updated.realisedProfitPence ?? 0;
            if (isGreatFlip(profit, updated.soldPricePence ?? 0)) setCelebrating(profit);
          }}
        />
      ) : null}

      {editing ? <EditSheet find={find} onClose={() => setEditing(false)} /> : null}

      {celebrating !== null ? (
        <Celebration profitPence={celebrating} onDone={() => setCelebrating(null)} />
      ) : null}
    </Screen>
  );
}

const day = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * "Bought 3 Jun · sold 12 Jul · 39 days to sell".
 *
 * How long the money sat in an item is the number that separates a good flip
 * from a lucky one — a £20 profit in a week and a £20 profit in eight months
 * are not the same trade — and it's the one thing a list of prices can never
 * tell you. Returns "" on a dud date rather than rendering "Invalid Date".
 */
function timeline(find: Find): string {
  const bought = new Date(find.boughtAt);
  if (Number.isNaN(bought.getTime())) return "";

  const sold = find.soldAt ? new Date(find.soldAt) : null;
  const end = sold && !Number.isNaN(sold.getTime()) ? sold : new Date();
  const days = Math.max(0, Math.round((end.getTime() - bought.getTime()) / 86_400_000));
  const spell = `${days} ${days === 1 ? "day" : "days"}`;

  const parts = [`Bought ${day(bought)}`];
  if (sold && !Number.isNaN(sold.getTime())) {
    parts.push(`sold ${day(sold)}`, `${spell} to sell`);
  } else {
    parts.push(days === 0 ? "in stock since today" : `${spell} in stock`);
  }
  return parts.join(" · ");
}

/**
 * "checked today" / "checked 3 weeks ago" — an unrealised figure from
 * months back is a guess wearing a number's clothes, so say how old it is.
 */
function valuedAgo(valuedAt: string | null): string {
  if (!valuedAt) return "";
  const days = Math.floor((Date.now() - new Date(valuedAt).getTime()) / 86_400_000);
  if (days <= 0) return ", checked today";
  if (days === 1) return ", checked yesterday";
  if (days < 14) return `, checked ${days} days ago`;
  if (days < 60) return `, checked ${Math.floor(days / 7)} weeks ago`;
  return `, checked ${Math.floor(days / 30)} months ago`;
}

/**
 * Where the money actually went. A single profit number hides the story;
 * this shows the fees and postage that ate into it.
 */
function ProfitBreakdown({ find }: { find: Find }) {
  const theme = useTheme();
  const sold = find.status === "sold";
  const profit = sold ? find.realisedProfitPence : find.unrealisedProfitPence;
  const positive = (profit ?? 0) >= 0;

  const rows: { label: string; value: number; negative?: boolean }[] = sold
    ? [
        { label: "Sold for", value: find.soldPricePence ?? 0 },
        { label: "You paid", value: -find.boughtPricePence, negative: true },
        { label: "Selling fees", value: -find.feesPence, negative: true },
        ...(find.postagePence > 0
          ? [{ label: "Postage", value: -find.postagePence, negative: true }]
          : []),
      ]
    : [
        { label: "You paid", value: find.boughtPricePence },
        ...(find.estimatedValuePence !== null
          ? [{ label: "Worth about", value: find.estimatedValuePence }]
          : []),
      ];

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      {rows.map((row) => (
        <View
          key={row.label}
          style={{ flexDirection: "row", justifyContent: "space-between" }}
        >
          <Type tone="secondary">{row.label}</Type>
          <Type tabular tone={row.negative ? "loss" : "primary"}>
            {row.negative ? "−" : ""}
            {formatPence(Math.abs(row.value))}
          </Type>
        </View>
      ))}

      <View
        style={{ height: 1, backgroundColor: theme.color.border, marginVertical: space.xs }}
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Type variant="headline">{sold ? "Profit" : "If it sells at that"}</Type>
        {profit === null ? (
          <Type tone="tertiary">—</Type>
        ) : (
          <Type variant="title" tabular tone={positive ? "profit" : "loss"}>
            {positive ? "+" : "−"}
            {formatPence(Math.abs(profit))}
          </Type>
        )}
      </View>

      {!sold ? (
        <Type variant="caption" tone="tertiary">
          {find.estimatedValuePence === null
            ? "No live price for this one — check it yourself from a scan."
            : `An estimate before fees and postage${valuedAgo(find.valuedAt)}. Pull to refresh on My Finds to re-check.`}
        </Type>
      ) : null}
    </View>
  );
}

function EditSheet({ find, onClose }: { find: Find; onClose: () => void }) {
  const [name, setName] = useState(find.name);
  const [paid, setPaid] = useState(textFromPence(find.boughtPricePence));
  const [notes, setNotes] = useState(find.notes ?? "");
  const theme = useTheme();
  const update = useUpdateFind(find.id);

  const save = () => {
    haptic.confirm();
    update.mutate(
      {
        name: name.trim() || find.name,
        boughtPricePence: penceFromText(paid),
        notes: notes.trim() ? notes.trim() : null,
      },
      { onSuccess: onClose, onError: () => haptic.fail() },
    );
  };

  return (
    <Sheet onClose={onClose}>
      <View style={{ gap: space.lg }}>
        <Type variant="title">Edit find</Type>

        <View style={{ gap: space.sm }}>
          <Type variant="label" tone="secondary">
            Name
          </Type>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="Item name"
            placeholderTextColor={theme.color.textTertiary}
            style={{
              backgroundColor: theme.color.surfaceRaised,
              borderRadius: radius.card,
              padding: space.md,
              color: theme.color.textPrimary,
              fontSize: 17,
            }}
          />
        </View>

        <MoneyInput label="Paid" text={paid} onChangeText={setPaid} />

        <View style={{ gap: space.sm }}>
          <Type variant="label" tone="secondary">
            Notes
          </Type>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Where you got it, condition, anything useful"
            accessibilityLabel="Notes"
            placeholderTextColor={theme.color.textTertiary}
            style={{
              backgroundColor: theme.color.surfaceRaised,
              borderRadius: radius.card,
              padding: space.md,
              minHeight: 88,
              textAlignVertical: "top",
              color: theme.color.textPrimary,
              fontSize: 16,
            }}
          />
        </View>

        <Button
          label={update.isPending ? "Saving…" : "Save changes"}
          onPress={save}
          disabled={update.isPending}
        />
      </View>
    </Sheet>
  );
}

function PutBackButton({ find }: { find: Find }) {
  const update = useUpdateFind(find.id);
  return (
    <Button
      label="Put back in stock"
      variant="ghost"
      disabled={update.isPending}
      onPress={() => {
        Alert.alert(
          "Put back in stock?",
          "This clears the sale — the price, fees and profit for this item.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Put back",
              onPress: () => {
                haptic.confirm();
                update.mutate({ status: "in_stock" });
              },
            },
          ],
        );
      }}
    />
  );
}

function DeleteButton({ find, onDeleted }: { find: Find; onDeleted: () => void }) {
  const theme = useTheme();
  const remove = useDeleteFind();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Delete ${find.name}`}
      onPress={() =>
        Alert.alert("Delete this find?", "It'll be gone from your portfolio and profit figures.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              haptic.warn();
              remove.mutate(find.id, { onSuccess: onDeleted });
            },
          },
        ])
      }
      style={{ alignItems: "center", paddingVertical: space.lg }}
    >
      <Type variant="headline" style={{ color: theme.color.loss }}>
        {remove.isPending ? "Deleting…" : "Delete find"}
      </Type>
    </Pressable>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.gutter }}>
      <RoundButton icon="chevron-back" label="Back" onPress={onBack} />
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        // Fixed dark chip: this sits over a photo, so it can't take its
        // colour from the theme or it disappears on a light image.
        backgroundColor: "rgba(18,17,16,0.6)",
      }}
    >
      <Ionicons name={icon} size={24} color="#F5F2ED" />
    </Pressable>
  );
}
