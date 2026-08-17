"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { StoreProduct } from "@/lib/api/store";
import { useStoreCart } from "@/components/features/store/StoreCartContext";

function formatPrice(value?: number) {
  if (value == null) return "—";
  return `${value.toFixed(3)} OMR`;
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useStoreCart();
  const image = product.images?.[0];
  const inStock = product.availableStock > 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/store/products/${product._id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">No image</div>
          )}
          {!inStock ? (
            <div className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-semibold text-white">
              Sold out
            </div>
          ) : (
            <div className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#0f9f6e] shadow-sm">
              {product.availableStock} left
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</h3>
          <p className="text-xs text-slate-500">
            {product.category || product.brand || "NOOR"} · {product.sku}
          </p>
          <p className="pt-1 text-sm font-bold text-slate-900">{formatPrice(product.sellingPrice)}</p>
        </div>
      </Link>
      <div className="px-3 pb-3">
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
            toast.success(`${product.name} added to cart`);
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0f9f6e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0d8a5f] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </article>
  );
}
