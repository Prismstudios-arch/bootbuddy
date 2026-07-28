import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type FindStatus = "in_stock" | "sold";

export type Find = {
  id: string;
  name: string;
  scanId: string | null;
  localPhotoKey: string | null;
  status: FindStatus;
  boughtPricePence: number;
  boughtAt: string;
  estimatedValuePence: number | null;
  soldPricePence: number | null;
  feesPence: number;
  postagePence: number;
  soldAt: string | null;
  notes: string | null;
  realisedProfitPence: number | null;
  unrealisedProfitPence: number | null;
  createdAt: string;
};

export type MonthPoint = { month: string; profitPence: number; sales: number };

export type Stats = {
  realisedProfitPence: number;
  unrealisedProfitPence: number;
  thisMonthPence: number;
  lastMonthPence: number;
  totalSpentPence: number;
  totalRevenuePence: number;
  averageMarginPercent: number | null;
  inStockCount: number;
  soldCount: number;
  bestFlip: {
    id: string;
    name: string;
    profitPence: number;
    boughtPricePence: number;
    soldPricePence: number;
    soldAt: string | null;
  } | null;
  monthly: MonthPoint[];
};

export const findKeys = {
  all: ["finds"] as const,
  list: (status: FindStatus | "all") => ["finds", status] as const,
  stats: ["stats"] as const,
};

export function useFinds(status: FindStatus | "all" = "all") {
  return useQuery({
    queryKey: findKeys.list(status),
    queryFn: () =>
      apiFetch<{ finds: Find[] }>(`/v1/finds${status === "all" ? "" : `?status=${status}`}`),
    select: (data) => data.finds,
  });
}

export function useStats() {
  return useQuery({
    queryKey: findKeys.stats,
    queryFn: () => apiFetch<{ stats: Stats }>("/v1/stats"),
    select: (data) => data.stats,
  });
}

/** Everything that mutates a find invalidates both lists and the dashboard. */
function useFindInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: findKeys.all });
    void queryClient.invalidateQueries({ queryKey: findKeys.stats });
  };
}

export type CreateFindInput = {
  name: string;
  boughtPricePence: number;
  scanId?: string;
  estimatedValuePence?: number;
  notes?: string;
};

export function useLogBuy() {
  const invalidate = useFindInvalidation();
  return useMutation({
    mutationFn: (input: CreateFindInput) =>
      apiFetch<{ find: Find }>("/v1/finds", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export type UpdateFindInput = {
  status?: FindStatus;
  soldPricePence?: number | null;
  feesPence?: number;
  postagePence?: number;
  name?: string;
  boughtPricePence?: number;
  notes?: string | null;
};

export function useUpdateFind(id: string) {
  const invalidate = useFindInvalidation();
  return useMutation({
    mutationFn: (input: UpdateFindInput) =>
      apiFetch<{ find: Find }>(`/v1/finds/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteFind() {
  const invalidate = useFindInvalidation();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/v1/finds/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
