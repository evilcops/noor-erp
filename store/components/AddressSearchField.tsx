"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { storeApi } from "@/lib/api/store";

type Suggestion = { label: string; lat: number; lng: number };

export function AddressSearchField({
  value,
  onChange,
  onPick,
  near,
  placeholder = "Search street, area, or landmark",
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (hit: Suggestion) => void;
  near?: { lat?: number; lng?: number } | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Suggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(false);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await storeApi.searchAddresses(q, nearRef.current);
        setHits(results);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 420);

    return () => window.clearTimeout(timer);
  }, [value]);

  function pick(hit: Suggestion) {
    skipRef.current = true;
    onChange(hit.label);
    onPick(hit);
    setHits([]);
    setOpen(false);
  }

  async function searchNow() {
    const q = value.trim();
    if (q.length < 3) return;
    setLoading(true);
    try {
        const results = await storeApi.searchAddresses(q, nearRef.current);
      setHits(results);
      setOpen(true);
      if (results[0]) pick(results[0]);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--forest)]" />
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (hits[0]) pick(hits[0]);
            else void searchNow();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-2xl border border-[var(--forest)]/35 bg-[var(--cream)] pl-10 pr-11 text-sm text-[var(--ink)] outline-none ring-[var(--forest)]/25 focus:ring-2"
      />
      <button
        type="button"
        onClick={() => void searchNow()}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[var(--forest)] hover:bg-[var(--mint)]"
        aria-label="Search address"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </button>

      {open && (hits.length > 0 || (!loading && value.trim().length >= 3)) ? (
        <ul className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-2xl border border-black/8 bg-white py-1 shadow-lg">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--muted)]">No matching places. Try a nearby landmark.</li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.lat},${hit.lng}`}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--mint)]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest)]" />
                  <span className="line-clamp-2">{hit.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
