"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { storeApi } from "@/lib/api/store";
import { ProductCard } from "@/components/ProductCard";
import { useStoreCart } from "@/components/StoreCartContext";
import { useStoreLocation } from "@/components/LocationContext";
import { formatPrice } from "@/lib/utils";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { location } = useStoreLocation();
  const { addItem } = useStoreCart();
  const branchId = location?.inService ? location.branchId : undefined;

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
    return <div className="h-80 animate-pulse rounded-[2rem] bg-white" />;
  }

  const inStock = product.availableStock > 0;
  const image = product.images?.[0];
  const suggested = (relatedData?.data.products ?? []).filter((p) => p._id !== product._id).slice(0, 8);

  return (
    <div className="space-y-8 animate-float-in">
      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
          <div className="aspect-square bg-[var(--cream)]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[var(--muted)]">No image</div>
            )}
          </div>
        </div>

        <div>
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)]">
            <ArrowLeft className="h-4 w-4" />
            Back to shop
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[var(--forest)]">
            {product.category || product.brand || "NOOR"}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-2xl font-bold">{formatPrice(product.sellingPrice)}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {inStock
              ? `${product.availableStock} available at your branch`
              : "Sold out at your branch"}
          </p>
          {product.brand || product.sku ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[product.brand, product.sku].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!inStock}
            onClick={() => {
              addItem({
                productId: product._id,
                name: product.name,
                sku: product.sku,
                image,
                unitPrice: product.sellingPrice ?? 0,
                availableStock: product.availableStock,
              });
              toast.success("Added to cart");
            }}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--forest)] font-extrabold text-white hover:bg-[var(--forest-dark)] disabled:opacity-40 sm:w-auto sm:px-8"
          >
            <Plus className="h-4 w-4" />
            Add to cart
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-[1600px] rounded-[2rem] border border-black/5 bg-white p-5 sm:p-7">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Product description</h2>
        {product.description?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">
            {product.description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No description available for this product yet.</p>
        )}
        {product.specifications?.trim() ? (
          <div className="mt-5 border-t border-black/5 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--forest)]">
              Specifications
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">
              {product.specifications}
            </p>
          </div>
        ) : null}
      </section>

      {product.category ? (
        <section className="mx-auto max-w-[1600px] space-y-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              More from {product.category}
            </h2>
            <p className="text-sm text-[var(--muted)]">Suggested products in the same category</p>
          </div>

          {relatedLoading ? (
            <div className="store-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-[1.5rem] bg-white/70" />
              ))}
            </div>
          ) : suggested.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white px-6 py-10 text-center text-sm text-[var(--muted)]">
              No other products in this category yet.
            </div>
          ) : (
            <div className="store-grid">
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
