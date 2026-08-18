"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Sparkles } from "lucide-react";
import { storeApi } from "@/lib/api/store";
import { ProductCard } from "@/components/ProductCard";
import { ProductAdsCarousel } from "@/components/ProductAdsCarousel";
import { useStoreLocation } from "@/components/LocationContext";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { cn } from "@/lib/utils";

const CAT_ICONS: Record<string, string> = {
  "Bakery": "🥖", "Beverages": "🥤", "Dairy & Eggs": "🥛",
  "Fresh Produce": "🥦", "Household": "🧹", "Personal Care": "🧴",
  "Snacks & Pantry": "🍿", "Frozen": "🧊", "Meat": "🥩",
  "Seafood": "🐟", "Baby": "🍼", "Cleaning": "🧽",
  "Health": "💊", "Pet": "🐾",
};
const icon = (cat: string) => CAT_ICONS[cat] ?? "🛒";

/* Floating hero decorations: emoji, position, animation delay, tilt */
const FLOATERS = [
  { emoji: "🍊", cls: "left-[6%] top-[12%] text-3xl sm:text-4xl", delay: "0s",    tilt: "-8deg" },
  { emoji: "🥑", cls: "right-[8%] top-[18%] text-2xl sm:text-3xl", delay: "0.8s", tilt: "10deg" },
  { emoji: "🥐", cls: "left-[12%] bottom-[14%] text-2xl sm:text-3xl", delay: "1.6s", tilt: "6deg" },
  { emoji: "🍓", cls: "right-[14%] bottom-[10%] text-3xl sm:text-4xl", delay: "2.4s", tilt: "-6deg" },
  { emoji: "🥛", cls: "left-[38%] top-[6%] hidden text-2xl sm:block", delay: "1.2s", tilt: "4deg" },
];

export default function ShopPage() {
  const { location }        = useStoreLocation();
  const { isAuthenticated } = useStoreAuth();
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("");
  const branchId = location?.branchId || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-products", branchId, search, category],
    queryFn: () => storeApi.products({ page: 1, limit: 60, branchId, search: search || undefined, category: category || undefined }),
  });

  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ["store-product-ads", branchId],
    queryFn: () => storeApi.products({ page: 1, limit: 24, branchId }),
  });

  const products   = data?.data.products   ?? [];
  const adProducts = adsData?.data.products ?? [];
  const categories = data?.data.categories  ?? [];
  const branch     = data?.data.branch;
  const browseMode = data?.data.browseMode  ?? !branchId;

  const title = useMemo(() => {
    if (category) return category;
    if (search)   return `"${search}"`;
    return browseMode ? "All products" : "Fresh near you";
  }, [category, search, browseMode]);

  return (
    <div className="animate-fade-up space-y-6">

      {/* ══ Hero — open air, floating produce ══ */}
      <section className="relative px-2 py-8 text-center sm:py-12">
        {/* Floating emojis */}
        {FLOATERS.map((f) => (
          <span
            key={f.emoji}
            aria-hidden="true"
            className={cn("animate-floaty pointer-events-none absolute select-none drop-shadow-lg", f.cls)}
            style={{ animationDelay: f.delay, "--tilt": f.tilt } as React.CSSProperties}
          >
            {f.emoji}
          </span>
        ))}

        <div className="relative z-10 mx-auto max-w-2xl">
          {/* Eyebrow */}
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-[var(--forest)]">
            <Sparkles className="h-3.5 w-3.5" />
            {browseMode ? "Groceries, reimagined" : `Live from ${branch?.name || location?.branchName}`}
          </span>

          {/* Gradient headline */}
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Everything fresh.
            <br />
            <span className="text-sunrise">Delivered with love.</span>
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)] sm:text-base">
            {browseMode
              ? "Set your location and shop live stock from your nearest NOOR branch."
              : `${products.length || "Dozens of"} products ready for same-day delivery.`}
          </p>

          {/* Glass search */}
          <div className="glass-strong mx-auto mt-6 flex max-w-lg items-center gap-2 rounded-full p-1.5">
            <Search className="ml-3 h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fresh products…"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              className="h-10 shrink-0 rounded-full bg-gradient-to-r from-[#ff8a3d] to-[var(--forest)] px-5 text-sm font-extrabold text-white shadow-[0_6px_18px_-6px_rgba(255,90,0,0.65)] transition hover:shadow-[0_8px_26px_-6px_rgba(255,90,0,0.85)] active:scale-95"
            >
              Search
            </button>
          </div>

          {/* Location line */}
          {isAuthenticated ? (
            <Link
              href="/location"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--forest)] transition hover:opacity-75"
            >
              <MapPin className="h-4 w-4" />
              {location?.inService ? location.address || "Change delivery location" : "Set your delivery location"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--forest)] transition hover:opacity-75"
            >
              Log in to unlock delivery →
            </Link>
          )}
        </div>
      </section>

      {/* ══ Carousel ══ */}
      <ProductAdsCarousel products={adProducts} loading={adsLoading} />

      {/* ══ Categories — glass chips ══ */}
      {categories.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {[{ v: "", l: "All", e: "✨" }, ...categories.map((c) => ({ v: c, l: c, e: icon(c) }))].map((cat) => (
            <button
              key={cat.v}
              type="button"
              onClick={() => setCategory(cat.v)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all",
                category === cat.v
                  ? "animate-pop-spring bg-gradient-to-r from-[#ff8a3d] to-[var(--forest)] text-white shadow-[0_6px_18px_-6px_rgba(255,90,0,0.6)]"
                  : "glass text-[var(--ink)] hover:shadow-md"
              )}
            >
              <span>{cat.e}</span>
              {cat.l}
            </button>
          ))}
        </div>
      )}

      {/* ══ Section heading ══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">{title}</h2>
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-[var(--forest)]">
            {products.length}
          </span>
        </div>
        {(category || search) && (
          <button
            type="button"
            onClick={() => { setCategory(""); setSearch(""); }}
            className="glass rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* ══ Grid ══ */}
      {isLoading ? (
        <div className="store-grid">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-[270px] rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-red-500">
          {(error as Error).message}
        </p>
      ) : products.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">No products found</p>
        </div>
      ) : (
        <div className="store-grid stagger">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
