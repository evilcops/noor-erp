import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import type { BreadcrumbItem } from "@/components/common/PageHeader";

interface PlaceholderPageProps {
  title: string;
  description: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function PlaceholderPage({
  title,
  description,
  breadcrumbs,
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />

      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-muted">
          <Construction className="h-7 w-7 text-brand" />
        </div>
        <h2 className="text-lg font-medium text-foreground">
          {title} — Coming Soon
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This module is part of NOOR ERP Phase 1. The layout is ready — feature
          implementation will follow next.
        </p>
      </div>
    </div>
  );
}
