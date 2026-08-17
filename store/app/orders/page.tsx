"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bike, Clock3, Navigation } from "lucide-react";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { storeApi } from "@/lib/api/store";
import { formatPrice } from "@/lib/utils";

function statusLabel(status?: string) {
  if (!status) return "Processing";
  return status.replace(/_/g, " ");
}

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useStoreAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login?from=/orders");
  }, [loading, isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["store-orders"],
    enabled: isAuthenticated,
    queryFn: () => storeApi.orders({ page: 1, limit: 30 }),
    refetchInterval: 20_000,
  });

  const orders = data?.data ?? [];

  if (loading || !isAuthenticated) {
    return <div className="h-40 animate-pulse rounded-[2rem] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-float-in">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Your orders</h1>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[1.5rem] bg-white" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white px-6 py-14 text-center">
          <p className="text-[var(--muted)]">No orders yet.</p>
          <Link href="/shop" className="mt-4 inline-flex font-semibold text-[var(--forest)]">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const eta =
              order.delivery?.estimatedArrival || order.delivery?.promisedWindowEnd;
            return (
              <article
                key={order._id}
                className="rounded-[1.5rem] border border-black/5 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{order.saleNumber}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-bold text-[var(--forest)]">{formatPrice(order.totalAmount)}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-[var(--forest-dark)]">
                    {statusLabel(order.delivery?.status)}
                  </span>
                  {order.riderAssigned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      <Bike className="h-3.5 w-3.5" />
                      {order.riderName || order.riderCode || "Rider assigned"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                      Finding rider…
                    </span>
                  )}
                  {eta ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      <Clock3 className="h-3.5 w-3.5" />
                      ETA {new Date(eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--muted)]">{order.quantity} item(s)</p>
                  <Link
                    href={`/orders/${order._id}/track`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--forest)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Track delivery
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
