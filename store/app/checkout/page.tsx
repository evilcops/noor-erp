"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreCart } from "@/components/StoreCartContext";
import { useStoreLocation } from "@/components/LocationContext";
import { storeApi } from "@/lib/api/store";
import { ApiClientError } from "@/lib/api/client";
import { formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, customer, loading } = useStoreAuth();
  const { items, subtotal, clear } = useStoreCart();
  const { location } = useStoreLocation();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    address: customer?.address || location?.address || "",
    area: customer?.area ?? "",
    notes: "",
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login?from=/checkout");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const hasPin = location?.lat != null && location?.lng != null;
      if (!location?.inService || !hasPin) {
        router.replace("/location");
      }
    }
  }, [loading, isAuthenticated, location, router]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || customer?.name || "",
      address: f.address || customer?.address || location?.address || "",
      area: f.area || customer?.area || "",
    }));
  }, [customer, location]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!location?.inService || location.lat == null || location.lng == null) {
      toast.error("Please pin a delivery location in our service area");
      router.push("/location");
      return;
    }
    setBusy(true);
    try {
      const order = await storeApi.checkout({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        name: form.name,
        address: form.address,
        area: form.area,
        notes: form.notes || undefined,
      });
      clear();
      toast.success(`Order ${order.saleNumber} placed`);
      router.push("/orders");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Checkout failed";
      toast.error(message);
      if (/don'?t deliver|pin your delivery|out_of_service|area/i.test(message)) {
        router.push("/location");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !isAuthenticated) {
    return <div className="h-40 animate-pulse rounded-[2rem] bg-white" />;
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1.2fr_0.8fr] animate-float-in">
      <form onSubmit={onSubmit} className="rounded-[2rem] border border-black/5 bg-white p-5 sm:p-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Checkout</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Delivering from {location?.branchName || "your branch"}
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-semibold">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Address
            <textarea
              required
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-[var(--sand)] px-4 py-3 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Area
            <input
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || items.length === 0}
          className="mt-5 h-12 w-full rounded-full bg-[var(--forest)] font-extrabold text-white hover:bg-[var(--forest-dark)] disabled:opacity-60"
        >
          {busy ? "Placing order…" : `Place order · ${formatPrice(subtotal)}`}
        </button>
      </form>

      <aside className="h-fit rounded-[2rem] border border-black/5 bg-white p-5">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span className="truncate text-[var(--muted)]">
                {item.quantity}× {item.name}
              </span>
              <span className="font-semibold">{formatPrice(item.quantity * item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-black/5 pt-3 font-bold">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <Link href="/cart" className="mt-4 inline-block text-sm font-semibold text-[var(--forest)]">
          Edit cart
        </Link>
      </aside>
    </div>
  );
}
