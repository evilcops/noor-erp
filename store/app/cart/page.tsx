"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bike, Clock3, Minus, Navigation, Plus, Trash2 } from "lucide-react";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreCart } from "@/components/StoreCartContext";
import { storeApi } from "@/lib/api/store";
import { formatPrice } from "@/lib/utils";

function statusLabel(status?: string) {
  if (!status) return "Processing";
  return status.replace(/_/g, " ");
}

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useStoreCart();
  const { isAuthenticated, loading: authLoading } = useStoreAuth();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["store-orders"],
    enabled: isAuthenticated,
    queryFn: () => storeApi.orders({ page: 1, limit: 20 }),
    refetchInterval: 20_000,
  });

  const orders = ordersData?.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-float-in">
      <section className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Your cart</h1>

        {items.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-black/10 bg-white px-6 py-12 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Cart is empty</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Add products from your branch shop.</p>
            <Link
              href="/shop"
              className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--forest)] px-5 font-extrabold text-white"
            >
              Browse shop
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-3 rounded-[1.5rem] border border-black/5 bg-white p-3 shadow-sm"
                >
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-[var(--cream)]">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-sm text-[var(--muted)]">{formatPrice(item.unitPrice)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sand)]"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sand)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto grid h-8 w-8 place-items-center rounded-full text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-20 rounded-[1.5rem] border border-black/5 bg-white p-4 shadow-lg sm:bottom-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[var(--muted)]">Subtotal</span>
                <span className="text-lg font-bold">{formatPrice(subtotal)}</span>
              </div>
              <Link
                href="/checkout"
                className="flex h-12 items-center justify-center rounded-full bg-[var(--forest)] font-extrabold text-white"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              Order history
            </h2>
            <p className="text-sm text-[var(--muted)]">Your past store orders</p>
          </div>
          {isAuthenticated ? (
            <Link href="/orders" className="text-sm font-semibold text-[var(--forest)]">
              View all
            </Link>
          ) : null}
        </div>

        {authLoading ? (
          <div className="h-24 animate-pulse rounded-[1.5rem] bg-white" />
        ) : !isAuthenticated ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white px-5 py-8 text-center">
            <p className="text-sm text-[var(--muted)]">Log in to see your order history.</p>
            <Link
              href="/login?from=/cart"
              className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[var(--forest)] px-4 text-sm font-semibold text-white"
            >
              Log in
            </Link>
          </div>
        ) : ordersLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-[1.5rem] bg-white" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white px-5 py-8 text-center text-sm text-[var(--muted)]">
            No orders yet. Checkout from your cart to place the first one.
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
                    <p className="font-bold text-[var(--forest)]">
                      {formatPrice(order.totalAmount)}
                    </p>
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
                    ) : null}
                    {eta ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        ETA{" "}
                        {new Date(eta).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
                      Track
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
