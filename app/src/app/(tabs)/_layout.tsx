import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTheme } from "@/design/theme";
import { motion } from "@/design/tokens";
import { haptic } from "@/lib/haptics";

/**
 * The four-tab shell: Scan (home — the app opens on the camera), My Finds,
 * Profit, Settings. Every tab press gives a selection haptic.
 */
export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        transitionSpec: { animation: "timing", config: { duration: motion.base } },
        tabBarActiveTintColor: theme.color.textPrimary,
        tabBarInactiveTintColor: theme.color.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.color.bg,
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
      screenListeners={{
        tabPress: () => {
          haptic.tap();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Scan",
          tabBarAccessibilityLabel: "Scan an item",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finds"
        options={{
          title: "My Finds",
          tabBarAccessibilityLabel: "Your logged finds",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetags-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profit"
        options={{
          title: "Profit",
          tabBarAccessibilityLabel: "Profit dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarAccessibilityLabel: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
