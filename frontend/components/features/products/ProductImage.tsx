"use client";

import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-40 w-full max-w-xs",
};

export function ProductImage({ src, alt, className, size = "sm" }: ProductImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground",
          SIZE_CLASS[size],
          className
        )}
      >
        <Package className={size === "sm" ? "h-4 w-4" : "h-6 w-6"} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 rounded-lg border border-border object-cover", SIZE_CLASS[size], className)}
    />
  );
}
