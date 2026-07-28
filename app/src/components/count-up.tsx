import { useEffect, useRef, useState } from "react";
import { Type } from "./type";
import { motion } from "@/design/tokens";
import { formatPenceCompact } from "@/lib/money";

/**
 * The hero price counts up on reveal — the single moment of theatre in the
 * app, and the reason prices are tabular-nums (digits must not reflow while
 * they spin).
 *
 * Driven by requestAnimationFrame rather than Reanimated because the value
 * needs `Intl` formatting every frame, which isn't available inside a
 * worklet. At 700ms this is a handful of JS frames and stays smooth.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(target: number, duration = motion.reveal): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      setValue(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

export function CountUpPrice({
  pence,
  tone = "primary",
}: {
  pence: number;
  tone?: "primary" | "profit" | "gold";
}) {
  const value = useCountUp(pence);
  return (
    <Type variant="hero" tone={tone} accessibilityLabel={formatPenceCompact(pence)}>
      {formatPenceCompact(value)}
    </Type>
  );
}
