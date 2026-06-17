"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  label?: string;
  className?: string;
  error?: string;
}

export function FileUpload({
  accept,
  onFileSelect,
  label = "Click or drag file to upload",
  className,
  error,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-6 transition-colors",
          error
            ? "border-destructive/60 bg-destructive/5 hover:border-destructive hover:bg-destructive/10"
            : "border-border bg-muted/30 hover:border-brand hover:bg-muted/50",
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
        <Upload className={cn("mb-2 h-7 w-7", error ? "text-destructive/70" : "text-muted-foreground")} />
        <p className={cn("text-sm", error ? "text-destructive/80" : "text-muted-foreground")}>
          {label}
        </p>
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
