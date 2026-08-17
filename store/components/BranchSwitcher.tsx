"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Store } from "lucide-react";
import { toast } from "sonner";
import { storeApi } from "@/lib/api/store";
import { useStoreLocation } from "@/components/LocationContext";
import { cn } from "@/lib/utils";

export function BranchSwitcher({ className }: { className?: string }) {
  const qc = useQueryClient();
  const { location, selectBranch } = useStoreLocation();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["store-branches"],
    queryFn: () => storeApi.branches(),
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = location?.branchName || "Select branch";

  async function onPick(branchId: string) {
    const branch = branches.find((b) => b._id === branchId);
    if (!branch) return;
    if (location?.branchId === branch._id) {
      setOpen(false);
      return;
    }

    setBusyId(branch._id);
    try {
      const next = await selectBranch(branch);
      await qc.invalidateQueries({ queryKey: ["store-products"] });
      await qc.invalidateQueries({ queryKey: ["store-product-ads"] });
      toast.success(
        next.inService
          ? `Switched to ${branch.name}`
          : `Browsing ${branch.name} — set delivery pin if you want this branch to deliver`
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch branch");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading || Boolean(busyId)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 max-w-[11rem] items-center gap-1.5 rounded-full border border-black/5 bg-[var(--cream)] px-3 text-left text-sm font-bold text-[var(--ink)] transition hover:border-[var(--forest)]/40 disabled:opacity-60 sm:max-w-[14rem]"
      >
        <Store className="h-4 w-4 shrink-0 text-[var(--forest)]" />
        <span className="truncate">{isLoading ? "Branches…" : label}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-[var(--muted)] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Branches"
          className="absolute left-0 top-[calc(100%+0.4rem)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_40px_-20px_rgba(0,0,0,0.35)]"
        >
          <div className="border-b border-black/5 px-3 py-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--forest)]">
              Branches
            </p>
            <p className="text-xs text-[var(--muted)]">Choose where you want to shop from</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {branches.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">No branches available</p>
            ) : (
              branches.map((branch) => {
                const active = location?.branchId === branch._id;
                const busy = busyId === branch._id;
                return (
                  <button
                    key={branch._id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={Boolean(busyId)}
                    onClick={() => void onPick(branch._id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--cream)]",
                      active && "bg-[var(--mint)]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[var(--ink)]">
                        {branch.name}
                        {busy ? "…" : ""}
                      </p>
                      {branch.address ? (
                        <p className="truncate text-xs text-[var(--muted)]">{branch.address}</p>
                      ) : branch.code ? (
                        <p className="truncate text-xs text-[var(--muted)]">{branch.code}</p>
                      ) : null}
                    </div>
                    {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest)]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
