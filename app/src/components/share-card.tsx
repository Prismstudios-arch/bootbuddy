import { Image } from "expo-image";
import { forwardRef } from "react";
import { View } from "react-native";
import { radius, space, type as typeScale } from "@/design/tokens";
import { formatPence } from "@/lib/money";
import { Type } from "./type";

/**
 * The growth engine: a branded image of a genuinely good flip, made to be
 * screenshotted into a WhatsApp group or a reselling subreddit.
 *
 * Deliberately theme-independent — it renders in brand dark whatever the
 * app's appearance setting, because the shared image should look the same
 * coming out of everyone's phone. Sized 1080×1350 (4:5), the aspect ratio
 * Instagram and most feeds treat kindly.
 */
export type ShareCardData = {
  name: string;
  boughtPricePence: number;
  soldPricePence: number;
  profitPence: number;
  /** On-device photo of the find, if there is one. */
  photoUri?: string | null;
};

const BG = "#121110";
const SURFACE = "#1C1A18";
const TEXT = "#F5F2ED";
const MUTED = "#9C968E";
const PROFIT = "#3DDC84";
const GOLD = "#E8B14E";

export const ShareCard = forwardRef<View, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: 1080 / 3,
        height: 1350 / 3,
        backgroundColor: BG,
        padding: space.xl,
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: space.md }}>
        <Type variant="label" style={{ color: GOLD }}>
          That&rsquo;s a find
        </Type>
        {data.photoUri ? (
          <Image
            source={{ uri: data.photoUri }}
            style={{ width: "100%", height: 150, borderRadius: radius.card }}
            contentFit="cover"
          />
        ) : null}
        <Type variant="title" style={{ color: TEXT }} numberOfLines={2}>
          {data.name}
        </Type>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
          <Type style={{ color: MUTED, fontSize: 18 }}>
            Found for {formatPence(data.boughtPricePence)}
          </Type>
          <Type style={{ color: MUTED, fontSize: 18 }}>→</Type>
          <Type style={{ color: TEXT, fontSize: 18, fontWeight: "600" }}>
            Sold for {formatPence(data.soldPricePence)}
          </Type>
        </View>

        <View
          style={{
            backgroundColor: SURFACE,
            borderRadius: radius.card,
            padding: space.lg,
            gap: space.xs,
          }}
        >
          <Type variant="label" style={{ color: MUTED }}>
            Profit
          </Type>
          <Type
            style={{
              ...typeScale.hero,
              color: PROFIT,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatPence(data.profitPence)}
          </Type>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.pill,
            backgroundColor: GOLD,
          }}
        />
        <Type style={{ color: MUTED, fontSize: 15 }}>Boot Sale Buddy</Type>
      </View>
    </View>
  );
});
