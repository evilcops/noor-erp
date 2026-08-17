"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, Clock3, MapPin, Radio } from "lucide-react";
import { storeApi } from "@/lib/api/store";
import { formatPrice } from "@/lib/utils";

const RiderTrackMap = dynamic(
  () => import("@/components/RiderTrackMap").then((m) => m.RiderTrackMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.04]" />
    ),
  }
);

function statusLabel(status?: string) {
  if (!status) return "Processing";
  return status.replace(/_/g, " ");
}

export default function TrackOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-track", id],
    queryFn: () => storeApi.trackOrder(id),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <div className="mx-auto h-80 max-w-2xl animate-pulse rounded-[2rem] bg-white" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-black/10 bg-white px-6 py-14 text-center">
        <p className="text-[var(--muted)]">
          {(error as Error)?.message || "Could not load tracking"}
        </p>
        <Link href="/orders" className="mt-4 inline-flex font-semibold text-[var(--forest)]">
          Back to orders
        </Link>
      </div>
    );
  }

  const { order, delivery, rider, eta } = data;
  const mapsUrl =
    rider?.location?.lat != null && rider?.location?.lng != null
      ? `https://www.google.com/maps?q=${rider.location.lat},${rider.location.lng}`
      : delivery.coordinates?.lat != null && delivery.coordinates?.lng != null
        ? `https://www.google.com/maps?q=${delivery.coordinates.lat},${delivery.coordinates.lng}`
        : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-float-in">
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)]">
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      <section className="overflow-hidden rounded-[2rem] bg-[var(--forest)] p-6 text-white shadow-[0_24px_60px_-30px_rgba(var(--brand-shadow),0.75)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--lime)]">Live tracking</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {order.saleNumber}
        </h1>
        <p className="mt-1 text-sm text-white/80">{statusLabel(delivery.status)}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
              <Clock3 className="h-3.5 w-3.5" />
              Estimated arrival
            </p>
            <p className="mt-1 text-xl font-bold">
              {eta.estimatedArrival
                ? new Date(eta.estimatedArrival).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Calculating…"}
            </p>
            {eta.minutesRemaining != null && eta.minutesRemaining > 0 ? (
              <p className="mt-1 text-sm text-white/75">~{eta.minutesRemaining} min remaining</p>
            ) : eta.estimatedArrival &&
              new Date(eta.estimatedArrival).getTime() <= Date.now() &&
              delivery.status !== "delivered" ? (
              <p className="mt-1 text-sm text-white/75">Arriving soon</p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
              <Bike className="h-3.5 w-3.5" />
              Rider
            </p>
            <p className="mt-1 text-xl font-bold">{rider?.name || rider?.riderCode || "Assigning…"}</p>
            <p className="mt-1 text-sm text-white/75">
              {rider?.riderCode ? `Code ${rider.riderCode}` : "Matching a nearby rider"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-black/5 bg-white p-5">
        <h2 className="font-semibold">Delivery details</h2>
        <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest)]" />
            <span>{delivery.deliveryAddress || delivery.area || "Delivery address on file"}</span>
          </p>
          <p>
            Window:{" "}
            {delivery.promisedWindowStart && delivery.promisedWindowEnd
              ? `${new Date(delivery.promisedWindowStart).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })} – ${new Date(delivery.promisedWindowEnd).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "—"}
          </p>
          <p>Warehouse: {statusLabel(delivery.warehouseStatus)}</p>
          <p>Total: {formatPrice(order.totalAmount)}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-black/5 bg-white p-5">
        <h2 className="font-semibold">Rider location</h2>
        {rider?.location || delivery.coordinates ? (
          <div className="mt-3 space-y-3">
            {rider?.location ? (
              <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Radio className="h-4 w-4 text-[var(--forest)]" />
                Last update{" "}
                {rider.location.updatedAt
                  ? new Date(rider.location.updatedAt).toLocaleTimeString()
                  : "just now"}
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Showing your delivery pin. Rider GPS appears when they are on the way.
              </p>
            )}

            <RiderTrackMap
              rider={
                rider?.location
                  ? {
                      lat: rider.location.lat,
                      lng: rider.location.lng,
                      label: rider.name || rider.riderCode || "Rider",
                    }
                  : null
              }
              destination={
                delivery.coordinates
                  ? {
                      lat: delivery.coordinates.lat,
                      lng: delivery.coordinates.lng,
                      label: "Your delivery",
                    }
                  : null
              }
            />

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-[var(--forest)] sm:w-auto"
              >
                Open in Google Maps
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Rider GPS will appear here once the rider is on the way.
          </p>
        )}
      </section>
    </div>
  );
}
