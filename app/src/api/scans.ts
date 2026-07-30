import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type AskingPrices = {
  lowPence: number;
  medianPence: number;
  highPence: number;
  listingCount: number;
  maxBuyPence: number;
  /** Which source priced it. */
  source: "ebay" | "discogs" | "web";
  /** Completed sales, or what sellers are currently asking. */
  basis: "sold" | "asking";
};

export type Scan = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string;
  searchQuery: string;
  confidence: number;
  askingPrices: AskingPrices | null;
  createdAt: string;
};

export type Quota = {
  used: number;
  limit: number;
  period: "day" | "month";
  resetsAt: string;
};

export type ScanResponse = { scan: Scan; quota: Quota; deduped?: boolean };

export const scanKeys = {
  recent: ["scans", "recent"] as const,
  me: ["me"] as const,
};

/** Recent scans strip along the bottom of the camera. */
export function useRecentScans() {
  return useQuery({
    queryKey: scanKeys.recent,
    queryFn: () => apiFetch<{ scans: Scan[] }>("/v1/scan"),
    select: (data) => data.scans,
  });
}

export function useSession() {
  return useQuery({
    queryKey: scanKeys.me,
    queryFn: () => apiFetch<{
      user: { id: string; entitlement: string; signedIn: boolean };
      quota: Quota;
    }>("/v1/me"),
  });
}

export function useScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<ScanResponse>("/v1/scan", {
        method: "POST",
        body: JSON.stringify({ imageBase64 }),
      }),
    // A scan costs money; never auto-retry one. The user re-shoots instead.
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.recent });
      void queryClient.invalidateQueries({ queryKey: scanKeys.me });
    },
  });
}

/** User corrected the item name — re-price only, no new vision call. */
export function useRefineMutation(scanId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) =>
      apiFetch<ScanResponse>(`/v1/scan/${scanId}/refine`, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.recent });
    },
  });
}
