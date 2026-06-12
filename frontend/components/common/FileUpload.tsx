"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  label?: string;
  className?: string;
}

export function FileUpload({
  accept,
  onFileSelect,
  label = "Click or drag file to upload",
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 transition-colors hover:border-brand hover:bg-muted/50",
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
      }}
    >
      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
    </div>
  );
}
