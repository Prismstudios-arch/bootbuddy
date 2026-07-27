import { useRouter } from "expo-router";
import { View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import { Type } from "@/components/type";
import { space } from "@/design/tokens";

/**
 * My Finds — the portfolio. Phase 4 brings the finds list (photo, paid,
 * current est. value, unrealised profit chip), In stock / Sold filters and
 * the mark-as-sold flow. Until then: the designed empty state.
 */
export default function FindsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={{ paddingVertical: space.md }}>
        <Type variant="display">My Finds</Type>
      </View>
      <EmptyState
        icon="pricetags-outline"
        title="Nothing logged yet"
        body="Buy something worth flipping and log what you paid — your whole haul lives here."
        cta={{ label: "Scan your first find", onPress: () => router.navigate("/") }}
      />
    </Screen>
  );
}
