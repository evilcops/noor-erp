"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Minus, Package, Plus, Tag, Warehouse } from "lucide-react";
import { storeApi } from "@/lib/api/store";
import { ProductCard } from "@/components/ProductCard";
import { useStoreCart } from "@/components/StoreCartContext";
import { useStoreLocation } from "@/components/LocationContext";
import { cn, formatPrice } from "@/lib/utils";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { location } = useStoreLocation();
  const { items, addItem, updateQty } = useStoreCart();
  const branchId = location?.inService ? location.branchId : undefined;
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["store-product", id, branchId],
    queryFn: () => storeApi.product(id, branchId),
  });

  const { data: relatedData, isLoading: relatedLoading } = useQuery({
    queryKey: ["store-related", product?.category, branchId, id],
    enabled: Boolean(product?.category),
    queryFn: () =>
      storeApi.products({
        page: 1,
        limit: 12,
        category: product!.category,
        branchId,
      }),
  });

  if (isLoading || !product) {
    return (
      <div className="animate-fade-up grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="skeleton h-[320px] rounded-3xl sm:h-[480px]" />
        <div className="space-y-3">
          <div className="skeleton h-6 w-32 rounded-full" />
          <div className="skeleton h-12 w-3/4 rounded-2xl" />
          <div className="skeleton h-24 rounded-3xl" />
          <div className="skeleton h-14 rounded-full" />
        </div>
      </div>
    );
  }

  const item = product;
  const inStock = item.availableStock > 0;
  const images = (product.images ?? []).filter(Boolean);
  const image = images[activeImage] || images[0];
  const cartItem = items.find((i) => i.productId === product._id);
  const cartQty = cartItem?.quantity ?? 0;
  const suggested = (relatedData?.data.products ?? []).filter((p) => p._id !== product._id).slice(0, 10);
  const facts = [
    product.category && { label: "Category", value: product.category, icon: Tag },
    product.brand && { label: "Brand", value: product.brand, icon: Package },
    product.sku && { label: "SKU", value: product.sku, icon: Warehouse },
    product.unitOfMeasure && { label: "Unit", value: product.unitOfMeasure, icon: Check },
  ].filter(Boolean) as { label: string; value: string; icon: typeof Tag }[];

  function handleAdd() {
    if (!inStock) return;
    addItem({
      productId: item._id,
      name: item.name,
      sku: item.sku,
      image,
      unitPrice: item.sellingPrice ?? 0,
      availableStock: item.availableStock,
      quantity: qty,
    });
    toast.success(qty > 1 ? `Added ${qty} to cart` : "Added to cart");
  }

  return (
    <div className="animate-fade-up space-y-6 pb-6 sm:space-y-8">
      <Link
        href="/shop"
        className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold text-[var(--forest)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Shop
      </Link>

      {/* ── Gallery + buy panel ── */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-7">
        {/* Gallery */}
        <div className="glass overflow-hidden rounded-3xl p-2.5 sm:p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-white/70 sm:aspect-square">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image}
                src={image}
                alt={product.name}
                className="animate-fade-in h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-6xl">🛒</div>
            )}
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-extrabold backdrop-blur-sm ${
                inStock ? "bg-white/90 text-[var(--forest)]" : "bg-[var(--ink)]/85 text-white"
              }`}
            >
              {inStock ? `${product.availableStock} in stock` : "Sold out"}
            </span>
          </div>

          {images.length > 1 && (
            <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 transition sm:h-[72px] sm:w-[72px]",
                    i === activeImage ? "ring-[var(--forest)]" : "ring-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy panel */}
        <div className="glass-strong rounded-3xl p-5 sm:p-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--forest)]">
            {product.category || product.brand || "NOOR"}
            {product.subCategory ? ` · ${product.subCategory}` : ""}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black leading-tight sm:text-4xl">
            {product.name}
          </h1>
          <p className="text-sunrise mt-3 text-3xl font-black sm:text-4xl">
            {formatPrice(product.sellingPrice)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {inStock
              ? `Ready at ${location?.branchName || "your nearest branch"}`
              : "Currently sold out at this branch"}
          </p>

          {facts.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.label} className="rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-white/80">
                    <p className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      <Icon className="h-3 w-3 text-[var(--forest)]" />
                      {fact.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold">{fact.value}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Qty + add */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {inStock ? (
              <div className="flex h-12 items-center justify-between rounded-full bg-white/80 px-2 ring-1 ring-[var(--forest)]/15 sm:w-40">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--forest)] transition hover:bg-[var(--mint)]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-lg font-extrabold tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(product.availableStock, q + 1))}
                  className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d] to-[var(--forest)] text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!inStock}
              onClick={handleAdd}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff8a3d] to-[var(--forest)] font-extrabold text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.7)] transition hover:shadow-[0_10px_28px_-8px_rgba(255,90,0,0.9)] active:scale-[0.98] disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {inStock ? "Add to cart" : "Sold out"}
            </button>
          </div>

          {cartQty > 0 && (
            <p className="mt-3 text-center text-sm font-semibold text-[var(--forest)] sm:text-left">
              {cartQty} already in your cart
              <button
                type="button"
                onClick={() => updateQty(product._id, cartQty + 1)}
                className="ml-2 underline underline-offset-2"
              >
                add one more
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── Description + specs ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">About this product</h2>
          {product.description?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]/75">
              {product.description}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {product.name} is available from NOOR Store
              {product.category ? ` in ${product.category}` : ""}. Set your location to see live branch stock and same-day delivery.
            </p>
          )}
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">Details</h2>
          <dl className="mt-3 divide-y divide-black/[0.05]">
            {[
              ["Name", product.name],
              ["Category", product.category],
              ["Brand", product.brand],
              ["SKU", product.sku],
              ["Unit", product.unitOfMeasure],
              ["Stock", inStock ? `${product.availableStock} available` : "Sold out"],
            ]
              .filter(([, v]) => Boolean(v))
              .map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</dt>
                  <dd className="text-right text-sm font-semibold">{value}</dd>
                </div>
              ))}
          </dl>
          {product.specifications?.trim() ? (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-white/70 p-3 text-sm leading-7 text-[var(--ink)]/75">
              {product.specifications}
            </p>
          ) : null}
        </section>
      </div>

      {/* ── Related ── */}
      {product.category ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
                More from {product.category}
              </h2>
              <p className="text-sm text-[var(--muted)]">You might also like these</p>
            </div>
            <Link
              href={`/shop`}
              className="glass hidden rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--forest)] sm:inline-flex"
            >
              View all
            </Link>
          </div>

          {relatedLoading ? (
            <div className="store-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-[260px] rounded-3xl" />
              ))}
            </div>
          ) : suggested.length === 0 ? (
            <div className="glass rounded-3xl px-6 py-10 text-center text-sm text-[var(--muted)]">
              No other products in this category yet.
            </div>
          ) : (
            <div className="store-grid stagger">
              {suggested.map((item) => (
                <ProductCard key={item._id} product={item} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
