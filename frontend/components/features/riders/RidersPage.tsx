"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, ShieldX } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { isRiderRole } from "@/lib/permissions";
import { riderApi } from "@/lib/api/riders";
import { RiderWorkspace } from "@/components/features/riders/RiderWorkspace";
import type { Rider } from "@/types/rider";

function empName(rider: Rider) {
  const emp = rider.employeeId;
  if (typeof emp === "object") return `${emp.firstName} ${emp.lastName}`;
  return rider.riderCode;
}

function riderEmail(rider: Rider) {
  const emp = rider.employeeId;
  if (typeof emp === "object" && emp.email) return emp.email;
  return "—";
}

function formatDate(v?: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}

function RidersAdminList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["riders", page, search],
    queryFn: () => riderApi.list({ page, limit: 20, search: search || undefined }),
    enabled: !!user,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["rider", selectedId],
    queryFn: () => riderApi.get(selectedId!),
    enabled: !!selectedId && detailOpen,
  });

  const columns: Column<Rider>[] = [
    { key: "riderCode", header: "Code", cell: (r) => r.riderCode },
    { key: "name", header: "Rider", cell: (r) => empName(r) },
    {
      key: "license",
      header: "Licence",
      cell: (r) => (
        <span className="text-sm">
          {r.drivingLicenseNumber ?? "—"}
          {r.drivingLicenseExpiry ? (
            <span className="block text-xs text-muted-foreground">
              Exp: {formatDate(r.drivingLicenseExpiry)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (r) =>
        r.vehiclePlate ? `${r.vehicleMake ?? ""} ${r.vehicleModel ?? ""} · ${r.vehiclePlate}`.trim() : "—",
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "today",
      header: "Today",
      cell: (r) => String(r.todayDeliveries ?? 0),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <button
          type="button"
          className="rounded p-1 hover:bg-muted"
          onClick={() => {
            setSelectedId(r._id);
            setDetailOpen(true);
          }}
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riders"
        description="Delivery riders registered from employees — licence, vehicle, and schedule"
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search riders…" />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
        emptyDescription='No riders yet. Register riders from Employees using "Register as delivery rider" and create a Rider login.'
      />

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title="Rider Profile" size="lg">
        {detailLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{empName(detail)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rider code</p>
                <p className="font-medium">{detail.riderCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{riderEmail(detail)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">WhatsApp</p>
                <p>{detail.whatsappPhone ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Driving licence</p>
                <p>{detail.drivingLicenseNumber ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Expires: {formatDate(detail.drivingLicenseExpiry)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Vehicle</p>
                <p>
                  {[detail.vehicleMake, detail.vehicleModel, detail.vehiclePlate]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={detail.status} />
              </div>
            </div>
            {detail.recentDeliveries?.length ? (
              <div>
                <p className="mb-2 font-medium">Recent deliveries</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {detail.recentDeliveries.slice(0, 8).map((d) => (
                    <li key={d._id} className="flex justify-between px-3 py-2">
                      <span>{d.deliveryNumber}</span>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function RidersPage() {
  const { user } = useAuth();
  const { can } = usePermissions();

  if (isRiderRole(user)) {
    return <RiderWorkspace />;
  }

  if (can("rider:view")) {
    return <RidersAdminList />;
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ShieldX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This page is for dispatch staff or registered riders with a Rider login.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
