"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import type { StoreProduct } from "@/lib/api/store";
import { useStoreCart } from "@/components/StoreCartContext";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: StoreProduct }) {
  const { items, addItem, updateQty } = useStoreCart();
  const image    = product.images?.[0];
  const inStock  = product.availableStock > 0;
  const cartItem = items.find((i) => i.productId === product._id);
  const qty      = cartItem?.quantity ?? 0;
  const atMax    = qty >= product.availableStock;

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
    if (atMax) { toast.error("No more stock"); return; }
    qty === 0 ? handleAdd() : updateQty(product._id, qty + 1);
  }

  return (
    <article className="glass group flex flex-col rounded-3xl p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_-18px_rgba(255,90,0,0.35)]">

      {/* ── Image (padded, rounded, app-store style) ── */}
      <Link
        href={`/products/${product._id}`}
        className="relative block aspect-square overflow-hidden rounded-2xl bg-white/70"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full place-items-center text-4xl">🛒</div>
        )}

        {/* Stock chip */}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold backdrop-blur-sm ${
            inStock
              ? "bg-white/85 text-[var(--forest)]"
              : "bg-[var(--ink)]/85 text-white"
          }`}
        >
          {inStock ? `${product.availableStock} left` : "Sold out"}
        </span>
      </Link>

      {/* ── Info ── */}
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        {product.category && (
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--forest)]/80">
            {product.category}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-2 flex-1 text-[13px] font-bold leading-snug text-[var(--ink)]">
          {product.name}
        </h3>

        {/* Price + control row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-sunrise text-[15px] font-black">
            {formatPrice(product.sellingPrice)}
          </span>

          {!inStock ? null : qty === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              aria-label="Add to cart"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d] to-[var(--forest)] text-white shadow-[0_5px_14px_-4px_rgba(255,90,0,0.6)] transition hover:scale-110 hover:shadow-[0_7px_20px_-4px_rgba(255,90,0,0.8)] active:scale-90"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : (
            <div className="animate-pop-spring flex items-center gap-1 rounded-full bg-white/80 p-1 ring-1 ring-[var(--forest)]/15">
              <button
                type="button"
                aria-label="Decrease"
                onClick={() => updateQty(product._id, qty - 1)}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--forest)] transition hover:bg-[var(--mint)] active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[1.25rem] text-center text-sm font-extrabold tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label="Increase"
                disabled={atMax}
                onClick={handleIncrease}
                className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d] to-[var(--forest)] text-white transition active:scale-90 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
