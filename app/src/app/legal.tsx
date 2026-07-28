import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Type } from "@/components/type";
import { useTheme } from "@/design/theme";
import { radius, space } from "@/design/tokens";
import { apiFetch, API_URL } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { openUrl } from "@/lib/links";

/**
 * Privacy policy and terms, rendered natively inside the app rather than
 * bouncing the user out to Safari.
 *
 * The content comes from GET /v1/legal — the same structured source the
 * public web pages are generated from, so the version a reviewer reads at
 * the App Store Connect URL and the version a user reads in Settings can
 * never disagree. react-query caches it, so it still opens after the first
 * view with no signal, and there's a link out to the web copy for anyone
 * who wants to save or print it.
 */
type LegalSection = {
  heading?: string;
  callout?: string;
  paragraphs?: string[];
  bullets?: { lead?: string; text: string }[];
  tone?: "warning";
};

type LegalDoc = {
  id: "privacy" | "terms";
  title: string;
  updated: string;
  sections: LegalSection[];
};

export default function LegalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const wanted: "privacy" | "terms" = doc === "terms" ? "terms" : "privacy";

  const legal = useQuery({
    queryKey: ["legal"],
    queryFn: () => apiFetch<{ privacy: LegalDoc; terms: LegalDoc }>("/v1/legal"),
    // Policies change rarely; keep it readable offline once seen.
    staleTime: 24 * 60 * 60 * 1000,
  });

  const active = legal.data?.[wanted];

  return (
    <Screen edgeToEdge>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.gutter,
          paddingBottom: space.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            haptic.tap();
            router.back();
          }}
          style={{ padding: space.xs, marginLeft: -space.xs }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.color.textPrimary} />
        </Pressable>
        <Type variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {active?.title ?? (wanted === "terms" ? "Terms of Use" : "Privacy Policy")}
        </Type>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {legal.isPending ? (
          <View style={{ gap: space.md }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="100%" height={72} />
            <Skeleton width="55%" height={20} />
            <Skeleton width="100%" height={120} />
          </View>
        ) : legal.isError || !active ? (
          <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.xxl }}>
            <Ionicons name="cloud-offline-outline" size={36} color={theme.color.textTertiary} />
            <Type tone="secondary" style={{ textAlign: "center" }}>
              Couldn&rsquo;t load this just now. You can read it on the web instead.
            </Type>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open in browser"
              onPress={() => void openUrl(`${API_URL}/${wanted}`)}
            >
              <Type variant="headline" tone="profit">
                Open in browser
              </Type>
            </Pressable>
          </View>
        ) : (
          <>
            <Type variant="caption" tone="tertiary">
              Last updated {active.updated}
            </Type>

            {active.sections.map((section, i) => (
              <Section key={section.heading ?? `s${i}`} section={section} />
            ))}

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="View this page on the web"
              onPress={() => void openUrl(`${API_URL}/${wanted}`)}
              style={{ paddingTop: space.md }}
            >
              <Type variant="caption" tone="secondary">
                View on the web ↗
              </Type>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ section }: { section: LegalSection }) {
  const theme = useTheme();

  return (
    <View style={{ gap: space.sm }}>
      {section.heading ? (
        <Type
          variant="headline"
          style={{ color: section.tone === "warning" ? theme.color.loss : theme.color.gold }}
        >
          {section.heading}
        </Type>
      ) : null}

      {section.callout ? (
        <View
          style={{
            backgroundColor: theme.color.surface,
            borderLeftWidth: 3,
            borderLeftColor: section.tone === "warning" ? theme.color.loss : theme.color.gold,
            borderRadius: radius.card,
            padding: space.lg,
          }}
        >
          <Type tone="secondary" style={{ lineHeight: 23 }}>
            {section.callout}
          </Type>
        </View>
      ) : null}

      {section.bullets?.map((bullet) => (
        <View key={bullet.text} style={{ flexDirection: "row", gap: space.sm }}>
          <Type tone="tertiary">•</Type>
          <Type tone="secondary" style={{ flex: 1, lineHeight: 23 }}>
            {bullet.lead ? (
              <Type style={{ color: theme.color.textPrimary, fontWeight: "600" }}>
                {bullet.lead}{" "}
              </Type>
            ) : null}
            {bullet.text}
          </Type>
        </View>
      ))}

      {section.paragraphs?.map((paragraph) => (
        <Type key={paragraph} tone="secondary" style={{ lineHeight: 23 }}>
          {paragraph}
        </Type>
      ))}
    </View>
  );
}
