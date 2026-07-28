import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Full-res phone photos are 3–5MB; we never upload one. Resizing the long
 * edge to 1024px at ~70% JPEG lands around 100–200KB — enough detail for a
 * model to read "WM-EX194" off a label, small enough to upload on two bars
 * of signal in a field, and it keeps the per-scan vision cost down.
 */
export const MAX_EDGE = 1024;
export const JPEG_QUALITY = 0.7;

export async function compressForUpload(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: MAX_EDGE }).renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!result.base64) {
    throw new Error("image compression produced no base64 payload");
  }
  return result.base64;
}
