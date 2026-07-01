"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/api/token";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

function getExt(url: string): string {
  return url.split(".").pop()?.toLowerCase().split("?")[0] ?? "";
}

interface LeaveAttachmentViewerProps {
  attachmentUrl: string | null | undefined;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveAttachmentViewer({
  attachmentUrl,
  title = "Leave supporting document",
  open,
  onOpenChange,
}: LeaveAttachmentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ext = attachmentUrl ? getExt(attachmentUrl) : "";
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === "pdf";
  const isViewable = isImage || isPdf;

  useEffect(() => {
    if (!open || !attachmentUrl) return;

    let revoke = "";
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    const token = getAccessToken();
    fetch(attachmentUrl, {
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
  }, [open, attachmentUrl]);

  function handleDownload() {
    if (!blobUrl || !attachmentUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = attachmentUrl.split("/").pop() ?? "leave-document";
    a.click();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        blobUrl ? (
          <Button variant="secondary" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        ) : null
      }
    >
      {!attachmentUrl ? (
        <p className="text-sm text-muted-foreground">No document attached.</p>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading document...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">{error}</p>
      ) : isImage && blobUrl ? (
        <img src={blobUrl} alt="Leave supporting document" className="mx-auto max-h-[70vh] rounded-lg" />
      ) : isPdf && blobUrl ? (
        <iframe src={blobUrl} title="Leave document" className="h-[70vh] w-full rounded-lg border border-border" />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <FileText className="h-12 w-12" />
          <p className="text-sm">Preview not available for this file type.</p>
          {blobUrl ? (
            <Button variant="secondary" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download file
            </Button>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
