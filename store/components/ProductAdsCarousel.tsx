"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { StoreProduct } from "@/lib/api/store";
import { cn, formatPrice } from "@/lib/utils";

function pickAds(products: StoreProduct[], limit = 5) {
  const pool = products.filter((p) => p.images?.[0] && p.availableStock > 0);
  return (pool.length >= 2 ? pool : products.filter((p) => p.availableStock > 0)).slice(0, limit);
}

const PROMOS = ["Deal of the day", "Fresh pick", "Customer favourite", "Just arrived", "Featured today"];
const INTERVAL = 5000;

export function ProductAdsCarousel({
  products,
  loading,
}: {
  products: StoreProduct[];
  loading?: boolean;
}) {
  const ads = pickAds(products);
  const [idx, setIdx]       = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adKey    = ads.map((a) => a._id).join("|");

  useEffect(() => { setIdx(0); }, [adKey]);

  useEffect(() => {
    if (ads.length <= 1 || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % ads.length), INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length, paused, adKey]);

  if (loading) return <div className="skeleton h-[210px] rounded-3xl sm:h-[240px]" />;
  if (!ads.length) return null;

  const safe    = idx % ads.length;
  const product = ads[safe];
  const image   = product.images?.[0];
  const promo   = PROMOS[safe % PROMOS.length];
  const go = (n: number) => setIdx(((n % ads.length) + ads.length) % ads.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured products"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#fff3e8] via-[#ffe9d6] to-[#ffdcc0] shadow-[0_16px_44px_-20px_rgba(255,90,0,0.35)] ring-1 ring-white/80">

        <div
          key={product._id}
          className="animate-fade-in relative grid min-h-[210px] grid-cols-[1.15fr_0.85fr] sm:min-h-[240px] sm:grid-cols-2"
        >
          {/* ── Left: text ── */}
          <div className="relative z-10 flex flex-col justify-center gap-2.5 py-6 pl-5 pr-2 sm:gap-3 sm:py-8 sm:pl-8">
            <span className="w-fit rounded-full bg-white/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--forest)] shadow-sm sm:text-[11px]">
              {promo}
            </span>

            <div>
              <h2 className="line-clamp-2 font-[family-name:var(--font-display)] text-xl font-black leading-tight text-[var(--ink)] sm:text-3xl">
                {product.name}
              </h2>
              {product.category && (
                <p className="mt-1 text-xs font-semibold text-[var(--muted)] sm:text-sm">
                  {product.category}
                </p>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="text-sunrise text-xl font-black sm:text-2xl">
                {formatPrice(product.sellingPrice)}
              </span>
              <Link
                href={`/products/${product._id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff8a3d] to-[var(--forest)] px-4 py-2 text-xs font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(255,90,0,0.65)] transition hover:gap-2.5 hover:shadow-[0_8px_22px_-6px_rgba(255,90,0,0.85)] sm:text-sm"
              >
                Shop now
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* ── Right: full-bleed image ── */}
          <Link href={`/products/${product._id}`} className="relative block">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[var(--mint)] text-6xl">🛒</div>
            )}
            {/* blend the image into the banner from the left */}
            <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#ffe9d6] to-transparent" />
            {/* soft bottom shade for indicator legibility */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" />
          </Link>
        </div>

        {/* ── Arrows (desktop) ── */}
        {ads.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => go(safe - 1)}
              className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[var(--ink)] shadow-md backdrop-blur transition hover:bg-white sm:grid"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => go(safe + 1)}
              className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[var(--ink)] shadow-md backdrop-blur transition hover:bg-white sm:grid"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* ── Indicators (over image, bottom-right) ── */}
        {ads.length > 1 && (
          <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
            {ads.map((ad, i) => (
              <button
                key={ad._id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === safe ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
