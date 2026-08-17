"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import type { StoreProduct } from "@/lib/api/store";
import { cn, formatPrice } from "@/lib/utils";

function pickAds(products: StoreProduct[], limit = 6) {
  const withImages = products.filter((p) => p.images?.[0] && p.availableStock > 0);
  const pool = withImages.length >= 3 ? withImages : products.filter((p) => p.availableStock > 0);
  const source = pool.length > 0 ? pool : products;
  return source.slice(0, limit);
}

export function ProductAdsCarousel({
  products,
  loading,
}: {
  products: StoreProduct[];
  loading?: boolean;
}) {
  const ads = pickAds(products);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const adKey = ads.map((a) => a._id).join("|");

  useEffect(() => {
    setIndex(0);
  }, [adKey]);

  useEffect(() => {
    if (ads.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % ads.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [ads.length, paused]);

  const product = ads.length ? ads[index % ads.length] : null;
  const image = product?.images?.[0];

  if (loading) {
    return <div className="h-[168px] animate-pulse rounded-[1.5rem] bg-[var(--mint)] sm:h-[180px]" />;
  }

  if (!product) return null;

  const go = (next: number) => {
    setIndex(((next % ads.length) + ads.length) % ads.length);
  };

  const safeIndex = index % ads.length;

  return (
    <section
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Product promo carousel"
    >
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[var(--mint)] shadow-[0_14px_36px_-24px_rgba(var(--brand-shadow),0.45)] ring-1 ring-[var(--forest)]/10">
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-[var(--forest)]/10 blur-2xl" />

        <div className="relative grid items-center gap-4 p-4 sm:grid-cols-[1fr_150px] sm:gap-5 sm:p-5 lg:grid-cols-[1fr_180px] lg:px-8">
          <div className="min-w-0 text-center sm:pl-6 sm:text-left">
            <h2
              key={`${product._id}-title`}
              className="animate-float-in font-[family-name:var(--font-display)] text-xl font-extrabold leading-tight tracking-tight text-[var(--ink)] sm:text-2xl"
            >
              Unlock exclusive deals on{" "}
              <span className="text-[var(--forest)]">{product.name}</span>
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm text-[var(--muted)]">
              Tap below to open this product — {formatPrice(product.sellingPrice)}
              {product.category ? ` · ${product.category}` : ""}.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Link
                href={`/products/${product._id}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-extrabold text-white hover:bg-black"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop this deal
              </Link>
              <span className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-[var(--forest)] ring-1 ring-black/5">
                {formatPrice(product.sellingPrice)}
              </span>
            </div>
          </div>

          <div className="relative mx-auto h-[120px] w-[120px] sm:mx-0 sm:h-[140px] sm:w-[140px] lg:h-[160px] lg:w-[160px]">
            <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-[1.35rem] bg-[var(--forest)]/20" />
            <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-[var(--forest)]/25 blur-md" />
            <Link
              href={`/products/${product._id}`}
              className="relative block h-full overflow-hidden rounded-[1.25rem] bg-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition hover:-translate-y-0.5"
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={product._id}
                  src={image}
                  alt={product.name}
                  className="h-full w-full object-cover animate-float-in"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[var(--cream)] text-xs font-bold text-[var(--muted)]">
                  NOOR
                </div>
              )}
            </Link>
          </div>
        </div>

        {ads.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous promo"
              onClick={() => go(safeIndex - 1)}
              className="absolute left-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--ink)] shadow-md ring-1 ring-black/5 hover:bg-[var(--cream)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next promo"
              onClick={() => go(safeIndex + 1)}
              className="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--ink)] shadow-md ring-1 ring-black/5 hover:bg-[var(--cream)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
              {ads.map((ad, i) => (
                <button
                  key={ad._id}
                  type="button"
                  aria-label={`Go to promo ${i + 1}`}
                  aria-current={i === safeIndex}
                  onClick={() => go(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === safeIndex
                      ? "w-5 bg-[var(--forest)]"
                      : "w-1.5 bg-[var(--forest)]/30 hover:bg-[var(--forest)]/50"
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
