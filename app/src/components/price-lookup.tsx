import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";
import { openUrl } from "@/lib/links";
import { Type } from "./type";

/**
 * One-tap price lookup.
 *
 * No free API covers every category — eBay is the only universal one and
 * its approval process is a lottery. But identification is the genuinely
 * hard part, and that already works for anything: the app knows it's a
 * "Sony Walkman WM-EX194", not just "a cassette player".
 *
 * So when we can't price something ourselves, we hand the user straight to
 * where the price lives, with the exact search term already worked out.
 * Typing a half-remembered model number into eBay on a phone in a field is
 * the slow, miserable part; removing that is most of the value even without
 * a number on screen.
 *
 * These also show alongside real prices — someone about to spend their own
 * money should always be able to check our figure against the source.
 */
type Destination = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: (query: string) => string;
};

const DESTINATIONS: Destination[] = [
  {
    key: "ebay-sold",
    label: "eBay sold prices",
    icon: "pricetag-outline",
    // LH_Sold=1&LH_Complete=1 filters to completed sales — the number every
    // reseller actually wants, and the one no free API will give us.
    url: (q) =>
      `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`,
  },
  {
    key: "ebay-live",
    label: "eBay listings now",
    icon: "cart-outline",
    url: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  },
  {
    key: "vinted",
    label: "Vinted",
    icon: "shirt-outline",
    url: (q) => `https://www.vinted.co.uk/catalog?search_text=${encodeURIComponent(q)}`,
  },
  {
    key: "amazon",
    label: "Amazon UK",
    icon: "cube-outline",
    url: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`,
  },
  {
    key: "google",
    label: "Google Shopping",
    icon: "search-outline",
    url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
  },
];

export function PriceLookup({
  query,
  compact = false,
}: {
  query: string;
  /** Compact mode sits under a real price as a "check it" affordance. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const list = compact ? DESTINATIONS.slice(0, 2) : DESTINATIONS;

  return (
    <View style={{ gap: space.sm }}>
      {!compact ? (
        <Type variant="label" tone="secondary">
          Check the price yourself
        </Type>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {list.map((destination) => (
          <Pressable
            key={destination.key}
            accessibilityRole="link"
            accessibilityLabel={`Search ${destination.label} for ${query}`}
            onPress={() => {
              haptic.tap();
              void openUrl(destination.url(query));
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: "45%",
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surfaceRaised,
              borderRadius: radius.card,
              paddingVertical: space.md,
              paddingHorizontal: space.md,
            })}
          >
            <Ionicons name={destination.icon} size={18} color={theme.color.textSecondary} />
            <Type variant="caption" style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
              {destination.label}
            </Type>
            <Ionicons name="open-outline" size={14} color={theme.color.textTertiary} />
          </Pressable>
        ))}
      </View>

      {!compact ? (
        <Type variant="caption" tone="tertiary">
          We&rsquo;ve worked out the search term — these open it for you.
        </Type>
      ) : null}
    </View>
  );
}
