"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOATERS = [
  { emoji: "🍊", cls: "left-[6%] top-[10%] text-4xl sm:text-5xl", delay: "0s", tilt: "-10deg" },
  { emoji: "🥑", cls: "right-[8%] top-[16%] text-3xl sm:text-4xl", delay: "0.9s", tilt: "12deg" },
  { emoji: "🥐", cls: "left-[10%] bottom-[18%] text-3xl sm:text-4xl", delay: "1.7s", tilt: "8deg" },
  { emoji: "🍓", cls: "right-[12%] bottom-[12%] text-4xl sm:text-5xl", delay: "2.3s", tilt: "-8deg" },
  { emoji: "🥛", cls: "left-[42%] top-[6%] hidden text-3xl lg:block", delay: "1.1s", tilt: "4deg" },
  { emoji: "🥦", cls: "right-[38%] bottom-[8%] hidden text-3xl lg:block", delay: "2s", tilt: "-6deg" },
];

export function AuthScene({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh w-full items-center overflow-x-hidden px-5 py-8 sm:px-10 lg:px-16">
      {/* Full-bleed glows — not clipped to a card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[var(--forest)]/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#ffb01f]/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-white/50 blur-3xl"
      />

      {/* Soft produce silhouettes */}
      {FLOATERS.map((f) => (
        <span
          key={f.emoji + f.cls}
          aria-hidden="true"
          className={cn("animate-floaty pointer-events-none absolute z-0 select-none drop-shadow-lg", f.cls)}
          style={{ animationDelay: f.delay, "--tilt": f.tilt } as React.CSSProperties}
        >
          {f.emoji}
        </span>
      ))}

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_minmax(340px,440px)] lg:gap-12">
        {/* Brand story — desktop / tablet */}
        <div className="hidden px-2 text-center lg:block lg:px-4 lg:text-left">
          <Link href="/shop" className="inline-flex items-center gap-2">
            <span className="brand-mark h-11 w-11 text-lg">N</span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-black">
              noor<span className="text-sunrise">store</span>
            </span>
          </Link>

          <h2 className="mt-8 font-[family-name:var(--font-display)] text-5xl font-black leading-[1.05] tracking-tight">
            Fresh groceries.
            <br />
            <span className="text-sunrise">Delivered with love.</span>
          </h2>
          <p className="mt-4 max-w-md text-base text-[var(--muted)]">
            Live stock from your nearest NOOR branch, same-day delivery, and a cart that actually knows what is on the shelf.
          </p>

          <div className="mt-8 grid max-w-md gap-3">
            {[
              ["⚡", "Same-day delivery"],
              ["📦", "Live branch stock"],
              ["🏪", "Pick your nearest store"],
            ].map(([icon, label]) => (
              <div key={label} className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-left">
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-bold">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="relative mx-auto w-full max-w-md animate-fade-up lg:mx-0">
          <div className="glass-strong rounded-[1.75rem] p-6 sm:p-8">
            <Link href="/shop" className="mb-5 flex items-center justify-center gap-2 lg:hidden">
              <span className="brand-mark h-9 w-9 text-sm">N</span>
              <span className="font-[family-name:var(--font-display)] text-lg font-black">
                noor<span className="text-sunrise">store</span>
              </span>
            </Link>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mint)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[var(--forest)]">
              <Sparkles className="h-3 w-3" />
              {eyebrow}
            </span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black">{title}</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "mt-1.5 h-12 w-full rounded-2xl bg-white/80 px-4 text-sm outline-none ring-1 ring-black/8 transition placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--forest)]/40";

export const authButtonClass =
  "h-12 w-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[var(--forest)] font-extrabold text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.7)] transition hover:shadow-[0_10px_28px_-8px_rgba(255,90,0,0.9)] disabled:opacity-60";
