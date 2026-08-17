"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { storeApi } from "@/lib/api/store";
import { ProductCard } from "@/components/ProductCard";
import { ProductAdsCarousel } from "@/components/ProductAdsCarousel";
import { useStoreLocation } from "@/components/LocationContext";
import { useStoreAuth } from "@/components/StoreAuthContext";

export default function ShopPage() {
  const { location } = useStoreLocation();
  const { isAuthenticated } = useStoreAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const branchId = location?.branchId || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-products", branchId, search, category],
    queryFn: () =>
      storeApi.products({
        page: 1,
        limit: 60,
        branchId,
        search: search || undefined,
        category: category || undefined,
      }),
  });

  const { data: adsData, isLoading: adsLoading } = useQuery({
    queryKey: ["store-product-ads", branchId],
    queryFn: () =>
      storeApi.products({
        page: 1,
        limit: 24,
        branchId,
      }),
  });

  const products = data?.data.products ?? [];
  const adProducts = adsData?.data.products ?? [];
  const categories = data?.data.categories ?? [];
  const branch = data?.data.branch;
  const browseMode = data?.data.browseMode ?? !branchId;

  const title = useMemo(() => {
    if (category) return category;
    if (search) return `Results for “${search}”`;
    return browseMode ? "Explore NOOR" : "Near you";
  }, [category, search, browseMode]);

  return (
    <div className="space-y-5 animate-float-in">
      <section className="overflow-hidden rounded-[1.75rem] bg-[var(--cream)] px-5 py-6 sm:px-8 sm:py-7">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="brand-mark mb-3 h-10 px-3.5 text-base lowercase sm:h-11 sm:px-4 sm:text-lg">
            noor
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[#b34700] sm:text-3xl">
            Fast delivery of groceries and more
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--muted)]">
            {browseMode
              ? "Search products, set your location, and get them delivered from your nearest branch."
              : `Showing live stock from ${branch?.name || location?.branchName}.`}
          </p>

          <form
            className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row sm:items-center"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for products, brands and categories"
                className="h-12 w-full rounded-full border border-black/5 bg-white pl-11 pr-4 text-sm shadow-[0_8px_30px_-16px_rgba(0,0,0,0.35)] outline-none ring-[var(--forest)]/25 focus:ring-2"
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-[var(--forest)] px-7 text-sm font-extrabold text-white shadow-[0_12px_28px_-12px_rgba(var(--brand-shadow),0.8)] hover:bg-[var(--forest-dark)]"
            >
              Let&apos;s go
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/location"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--ink)] shadow-sm ring-1 ring-black/5 hover:ring-[var(--forest)]/30"
              >
                <MapPin className="h-4 w-4 text-[var(--forest)]" />
                {location?.inService ? "Change location" : "Set delivery location"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-extrabold text-white"
              >
                Log in to deliver
              </Link>
            )}
          </div>
        </div>
      </section>

      <ProductAdsCarousel products={adProducts} loading={adsLoading} />

      {isAuthenticated && !location?.inService ? (
        <Link
          href="/location"
          className="flex items-center gap-3 rounded-2xl border border-[var(--forest)]/25 bg-[var(--mint)] px-4 py-3 text-sm font-bold text-[var(--forest-dark)]"
        >
          <MapPin className="h-4 w-4 shrink-0" />
          Select your branch and delivery address to unlock accurate stock
        </Link>
      ) : null}

      {categories.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${
              !category ? "bg-[var(--forest)] text-white" : "border border-black/5 bg-white text-[var(--muted)]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${
                category === cat
                  ? "bg-[var(--forest)] text-white"
                  : "border border-black/5 bg-white text-[var(--muted)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">{title}</h2>
        <p className="text-sm text-[var(--muted)]">{products.length} products</p>
      </div>

      {isLoading ? (
        <div className="store-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-[1.5rem] bg-white/70" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[1.5rem] border border-dashed border-red-300 bg-white px-6 py-12 text-center text-sm text-red-600">
          {(error as Error).message}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white px-6 py-16 text-center text-[var(--muted)]">
          No products found.
        </div>
      ) : (
        <div className="store-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
