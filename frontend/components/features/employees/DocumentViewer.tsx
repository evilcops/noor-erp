"use client";

import { useEffect, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/api/token";
import { formatDate } from "@/lib/date";
import type { EmployeeDocument } from "@/types/employee";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const PDF_EXT = "pdf";

function getExt(url: string): string {
  return url.split(".").pop()?.toLowerCase().split("?")[0] ?? "";
}

function getDocLabel(type: string): string {
  const map: Record<string, string> = {
    passport: "Passport",
    driving_license: "Driving License",
    bataka: "Bataka (Residency Permit / ID)",
    mulkiya: "Mulkiya (Vehicle Registration)",
    car_insurance: "Car Insurance",
    visa: "Visa",
    labour_card: "Labour Card",
    id_card: "ID Card",
    contract: "Contract",
    certificate: "Certificate",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

interface DocumentViewerProps {
  doc: EmployeeDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentViewer({ doc, open, onOpenChange }: DocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileUrl = doc?.fileUrl ?? null;
  const ext = fileUrl ? getExt(fileUrl) : "";
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === PDF_EXT;
  const isViewable = isImage || isPdf;

  useEffect(() => {
    if (!open || !fileUrl) return;

    let revoke = "";
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    const token = getAccessToken();
    fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
      setBlobUrl(null);
    };
  }, [open, fileUrl]);

  function handleDownload() {
    if (!blobUrl || !doc) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    const ext2 = getExt(doc.fileUrl ?? "");
    a.download = `${doc.type}${ext2 ? `.${ext2}` : ""}`;
    a.click();
  }

  if (!doc) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={getDocLabel(doc.type)}
      description={doc.expiryDate ? `Expires ${formatDate(doc.expiryDate)}` : undefined}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {doc.issuanceDate ? (
              <p>Issued: {formatDate(doc.issuanceDate)}</p>
            ) : null}
            {doc.expiryDate ? (
              <p>Expires: {formatDate(doc.expiryDate)}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Close
            </Button>
            {blobUrl ? (
              <Button onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="flex min-h-[400px] items-center justify-center rounded-lg bg-muted/30">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm">Loading document…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-center text-destructive">
            <FileText className="h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">Failed to load file</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : !fileUrl ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-40" />
            <p className="text-sm">No file attached to this document.</p>
          </div>
        ) : blobUrl && isPdf ? (
          <iframe
            src={blobUrl}
            title={getDocLabel(doc.type)}
            className="h-[65vh] w-full rounded border-0"
          />
        ) : blobUrl && isImage ? (
          <img
            src={blobUrl}
            alt={getDocLabel(doc.type)}
            className="max-h-[65vh] max-w-full rounded object-contain"
          />
        ) : blobUrl && !isViewable ? (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <FileText className="h-16 w-16 opacity-30" />
            <p className="text-sm font-medium">Preview not available for this file type</p>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download File
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
