"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  History,
  Loader2,
  Megaphone,
  MessageSquareWarning,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { marketingApi, type AdLanguage, type ProductAd } from "@/lib/api/marketing";
import type { Product } from "@/types/inventory";

const AD_LANGUAGE_OPTIONS: { value: AdLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
];

const AD_SLOGAN_TEMPLATES: Record<AdLanguage, (product: string) => string> = {
  en: (product) =>
    `Freshness and quality — ${product}, now within your budget. Get it today from your nearest store or order online.`,
  ur: (product) =>
    `تازگی اور معیار — ${product}، اب آپ کے بجٹ میں۔ آج ہی اپنے قریبی اسٹور سے حاصل کریں یا آن لائن آرڈر کریں۔`,
  ar: (product) =>
    `انتعاش وجودة — ${product}، الآن في متناول ميزانيتك. احصل عليه اليوم من أقرب متجر أو اطلب عبر الإنترنت.`,
};

/** 8s ads with slogan + accurate lip sync */
const SHORT_AD_SECONDS = 8;

type AdStep = "history" | "form" | "processing" | "preview" | "revise" | "failed";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusLabel(ad: ProductAd) {
  switch (ad.status) {
    case "pending":
    case "generating":
      return "Generating short video with OpenArt…";
    case "ready":
      return "Ready for your approval";
    case "revision_requested":
      return "Revision requested";
    case "approved":
      return "Approved — purchase orders unlocked";
    case "broadcasting":
      return "Sending to customers…";
    case "broadcasted":
      return "Approved & sent to customers";
    case "failed":
      return "Generation failed";
    default:
      return "Processing…";
  }
}

function statusBadgeClass(status: ProductAd["status"]) {
  switch (status) {
    case "approved":
    case "broadcasted":
      return "bg-emerald-100 text-emerald-800";
    case "ready":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "generating":
    case "pending":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function safeFilename(name: string) {
  return name.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "product";
}

async function downloadAdVideo(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
    toast.success("Download started");
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    toast.message("Opened video in a new tab");
  }
}

interface ProductAdModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  companyId: string;
}

export function ProductAdModal({ open, onOpenChange, product, companyId }: ProductAdModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<AdStep>("history");
  const [language, setLanguage] = useState<AdLanguage>("en");
  const [activeAdId, setActiveAdId] = useState<string | null>(null);
  const [previewAd, setPreviewAd] = useState<ProductAd | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const reset = () => {
    setStep("history");
    setLanguage("en");
    setActiveAdId(null);
    setPreviewAd(null);
    setElapsed(0);
    setDownloading(false);
    setRevisionFeedback("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const historyQuery = useQuery({
    queryKey: ["product-ads", product?._id],
    queryFn: () => marketingApi.listAds({ productId: product!._id, limit: 20 }),
    enabled: open && !!product?._id,
  });

  const previousAds = historyQuery.data?.data ?? [];

  useEffect(() => {
    if (!open || step !== "processing") return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, step, activeAdId]);

  const { data: polledAd } = useQuery({
    queryKey: ["product-ad", activeAdId],
    queryFn: () => marketingApi.getAd(activeAdId!),
    enabled: open && !!activeAdId && step === "processing",
    refetchInterval: (query) => {
      const ad = query.state.data;
      if (!ad) return 2500;
      if (ad.status === "failed" || ad.videoUrl) return false;
      return 2500;
    },
  });

  useEffect(() => {
    if (!polledAd) return;
    if (polledAd.status === "failed") {
      setPreviewAd(polledAd);
      setStep("failed");
      void qc.invalidateQueries({ queryKey: ["product-ads", product?._id] });
      return;
    }
    if (polledAd.videoUrl) {
      setPreviewAd(polledAd);
      setStep("preview");
      void qc.invalidateQueries({ queryKey: ["product-ads", product?._id] });
    }
  }, [polledAd, product?._id, qc]);

  const createMut = useMutation({
    mutationFn: () =>
      marketingApi.createAd({
        productId: product!._id,
        companyId,
        language,
        durationSeconds: SHORT_AD_SECONDS,
        autoBroadcast: false,
      }),
    onSuccess: (ad) => {
      setActiveAdId(ad._id);
      void qc.invalidateQueries({ queryKey: ["product-ads", product?._id] });
      if (ad.videoUrl) {
        setPreviewAd(ad);
        setStep("preview");
        return;
      }
      setStep("processing");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => marketingApi.approveAd(previewAd!._id, { broadcast: true }),
    onSuccess: (ad) => {
      setPreviewAd(ad);
      void qc.invalidateQueries({ queryKey: ["product-ads", product?._id] });
      toast.success("Ad approved — you can now create purchase orders for this product");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviseMut = useMutation({
    mutationFn: () => marketingApi.reviseAd(previewAd!._id, revisionFeedback),
    onSuccess: (ad) => {
      setRevisionFeedback("");
      setActiveAdId(ad._id);
      void qc.invalidateQueries({ queryKey: ["product-ads", product?._id] });
      toast.message("Creating an improved version…");
      if (ad.videoUrl) {
        setPreviewAd(ad);
        setStep("preview");
        return;
      }
      setStep("processing");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const title = useMemo(() => {
    if (step === "processing") return "Creating your short ad…";
    if (step === "preview") return "Review & approve ad";
    if (step === "revise") return "What should we improve?";
    if (step === "failed") return "Ad generation failed";
    if (step === "form") return "Create Product Ad";
    return "Product ads";
  }, [step]);

  const ad = previewAd;
  const isApproved = ad?.status === "approved" || ad?.status === "broadcasted";

  const handleDownload = async () => {
    if (!ad?.videoUrl || !product) return;
    setDownloading(true);
    try {
      await downloadAdVideo(ad.videoUrl, `${safeFilename(product.name)}-ad.mp4`);
    } finally {
      setDownloading(false);
    }
  };

  const openPrevious = (item: ProductAd) => {
    setPreviewAd(item);
    setActiveAdId(item._id);
    if (item.status === "failed") setStep("failed");
    else if (item.videoUrl) setStep("preview");
    else if (item.status === "generating" || item.status === "pending") setStep("processing");
    else setStep("preview");
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      size={step === "preview" || step === "history" ? "lg" : "md"}
    >
      {!product ? null : step === "history" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <img
              src="/marketing/ad-character.png"
              alt="Brand spokesperson"
              className="h-16 w-16 rounded-md object-cover"
            />
              <div className="text-sm">
                <p className="font-medium">My brand character</p>
                <p className="text-muted-foreground">
                  Ads for <span className="font-medium text-foreground">{product.name}</span> always
                  keep this girl&apos;s face. Outfit, background, and slogan adapt to the product
                  ({SHORT_AD_SECONDS}s, lip sync). Approve before creating purchase orders.
                </p>
              </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" /> Previous ads
            </p>
            <Button
              onClick={() => setStep("form")}
              disabled={!product}
            >
              <Megaphone className="mr-2 h-4 w-4" />
              New ad
            </Button>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previousAds.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No ads yet for this product. Create the first short ad.
            </p>
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {previousAds.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => openPrevious(item)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/40"
                >
                  {item.thumbnailUrl || item.videoUrl ? (
                    <div className="h-14 w-20 overflow-hidden rounded bg-black">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video src={item.videoUrl} className="h-full w-full object-cover" muted />
                      )}
                    </div>
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      No video
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.durationSeconds}s · {item.language.toUpperCase()}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                      {item.revisionFeedback ? ` · Revised: ${item.revisionFeedback}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : step === "form" ? (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pick language and character. We use OpenArt{" "}
              <span className="font-medium text-foreground">Grok Imagine</span> (fast + audio +
              lip sync) for an {SHORT_AD_SECONDS}s ad of{" "}
              <span className="font-medium text-foreground">{product.name}</span> with this same
              woman speaking your slogan — she is introduced as your official brand character.
            </p>

          <div>
            <Label>Character</Label>
            <div className="mt-1 flex items-center gap-3 rounded-lg border p-3">
              <img
                src="/marketing/ad-character.png"
                alt="Brand spokesperson"
                className="h-20 w-20 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <Select
                  value="noor-brand-woman"
                  onChange={() => undefined}
                  options={[
                    {
                      value: "noor-brand-woman",
                      label: "My brand character — same face always",
                    },
                  ]}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Same face every time. Outfit & background change to match the product.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>Language</Label>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as AdLanguage)}
              options={AD_LANGUAGE_OPTIONS}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Product slogan she will speak (changes with product + language):
            </p>
            <p
              className="mt-1 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              dir={language === "en" ? "ltr" : "rtl"}
            >
              {AD_SLOGAN_TEMPLATES[language](product.name)}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("history")}>
              Back
            </Button>
            <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              <Megaphone className="mr-2 h-4 w-4" />
              {createMut.isPending ? "Starting…" : "Generate short ad"}
            </Button>
          </div>
        </div>
      ) : step === "processing" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
          <div className="space-y-1">
            <p className="font-medium">
              {polledAd ? statusLabel(polledAd) : "Generating short video with OpenArt…"}
            </p>
            <p className="text-sm text-muted-foreground">
              Fast model (Grok Imagine) · {SHORT_AD_SECONDS}s · lip sync · 480p · Elapsed:{" "}
              {formatElapsed(elapsed)}
            </p>
          </div>
        </div>
      ) : step === "revise" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tell OpenArt what to improve. We will regenerate a new short ad using your feedback and
            the same brand character.
          </p>
          <div>
            <Label>What should be better?</Label>
            <textarea
              className="mt-1 min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Show the product closer, make the character smile more, add Urdu on-screen text…"
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("preview")}>
              Cancel
            </Button>
            <Button
              disabled={revisionFeedback.trim().length < 3 || reviseMut.isPending}
              onClick={() => reviseMut.mutate()}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {reviseMut.isPending ? "Regenerating…" : "Regenerate ad"}
            </Button>
          </div>
        </div>
      ) : step === "failed" ? (
        <div className="space-y-4">
          <p className="text-sm text-destructive">
            {ad?.errorMessage ?? "OpenArt could not finish this ad. Please try again."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("history")}>
              History
            </Button>
            <Button onClick={() => setStep("form")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      ) : ad?.videoUrl ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border bg-black">
            <video
              key={ad.videoUrl}
              src={ad.videoUrl}
              controls
              playsInline
              className="mx-auto max-h-[min(55vh,420px)] w-full"
              poster={ad.thumbnailUrl}
            >
              Your browser does not support video playback.
            </video>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{statusLabel(ad)}</p>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(ad.status)}`}>
              {ad.status}
            </span>
          </div>
          {isApproved ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Approved. Purchase orders for this product are unlocked.
            </p>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Approve this ad to unlock purchase orders for{" "}
              <span className="font-medium">{product.name}</span>. Or request changes if you want a
              better version.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("history")}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button variant="secondary" disabled={downloading} onClick={() => void handleDownload()}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Downloading…" : "Download"}
            </Button>
            {!isApproved ? (
              <>
                <Button variant="secondary" onClick={() => setStep("revise")}>
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Request changes
                </Button>
                <Button disabled={approveMut.isPending} onClick={() => approveMut.mutate()}>
                  <Check className="mr-2 h-4 w-4" />
                  {approveMut.isPending ? "Approving…" : "Approve ad"}
                </Button>
              </>
            ) : (
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
