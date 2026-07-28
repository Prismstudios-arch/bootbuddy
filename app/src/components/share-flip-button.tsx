import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { haptic } from "@/lib/haptics";
import { findPhotoUri } from "@/lib/photos";
import { Button } from "./button";
import { ShareCard, type ShareCardData } from "./share-card";

/**
 * Share any flip, from anywhere.
 *
 * The share card is the app's organic growth engine, so it shouldn't live
 * behind one screen's "best flip" card — every sale a person is pleased
 * with is a potential post. This bundles the hidden capture surface with
 * the button so adding it somewhere new is one line.
 */
export function ShareFlipButton({
  find,
  label = "Share this win",
  variant = "primary",
}: {
  find: {
    id: string;
    name: string;
    boughtPricePence: number;
    soldPricePence: number;
    profitPence: number;
  };
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const data: ShareCardData = {
    name: find.name,
    boughtPricePence: find.boughtPricePence,
    soldPricePence: find.soldPricePence,
    profitPence: find.profitPence,
    photoUri: findPhotoUri(find.id),
  };

  const share = async () => {
    if (!cardRef.current) return;
    haptic.greatFind();
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your find",
        });
      }
    } catch {
      haptic.fail();
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Button
        label={sharing ? "Preparing…" : label}
        variant={variant}
        onPress={() => void share()}
        disabled={sharing}
      />
      {/* Off-screen so view-shot has a real, laid-out view to capture. */}
      <View style={{ position: "absolute", left: -9999, top: 0 }} pointerEvents="none">
        <ShareCard ref={cardRef} data={data} />
      </View>
    </>
  );
}
