"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import type { StoreProduct } from "@/lib/api/store";
import { useStoreCart } from "@/components/StoreCartContext";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: StoreProduct }) {
  const { items, addItem, updateQty } = useStoreCart();
  const image = product.images?.[0];
  const inStock = product.availableStock > 0;
  const cartItem = items.find((i) => i.productId === product._id);
  const qty = cartItem?.quantity ?? 0;
  const atMax = qty >= product.availableStock;

  function handleAdd() {
    addItem({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      image,
      unitPrice: product.sellingPrice ?? 0,
      availableStock: product.availableStock,
    });
    toast.success("Added to cart");
  }

  function handleIncrease() {
    if (atMax) {
      toast.error("No more stock available");
      return;
    }
    if (qty === 0) {
      handleAdd();
      return;
    }
    updateQty(product._id, qty + 1);
  }

  function handleDecrease() {
    updateQty(product._id, qty - 1);
  }

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(var(--brand-shadow),0.45)]">
      <Link href={`/products/${product._id}`} className="block">
        <div className="relative aspect-[5/4] overflow-hidden bg-[var(--cream)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-[var(--mint)] to-white text-sm font-bold text-[var(--muted)]">
              NOOR
            </div>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-[var(--forest)] shadow-sm">
            {inStock ? `${product.availableStock} left` : "Sold out"}
          </div>
        </div>
        <div className="space-y-1 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--forest)]">
            {product.category || product.brand || "Fresh"}
          </p>
          <h3 className="line-clamp-2 min-h-[2.5rem] font-[family-name:var(--font-display)] text-base font-bold leading-snug">
            {product.name}
          </h3>
          <p className="text-sm font-extrabold text-[var(--ink)]">{formatPrice(product.sellingPrice)}</p>
        </div>
      </Link>
      <div className="px-3.5 pb-3.5">
        {!inStock ? (
          <button
            type="button"
            disabled
            className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--forest)] text-sm font-extrabold text-white opacity-40"
          >
            Sold out
          </button>
        ) : qty === 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--forest)] text-sm font-extrabold text-white transition hover:bg-[var(--forest-dark)]"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        ) : (
          <div className="flex h-11 items-center justify-between rounded-full bg-[var(--forest)] px-1.5 text-white">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={handleDecrease}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-8 text-center text-sm font-extrabold tabular-nums">{qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={atMax}
              onClick={handleIncrease}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition hover:bg-white/25 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
