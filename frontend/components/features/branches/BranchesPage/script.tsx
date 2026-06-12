"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  formToCreatePayload,
  formToUpdatePayload,
  type BranchFormValues,
} from "@/components/features/branches/BranchFormModal";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useBranches, useBranchMutations } from "@/hooks/useBranches";
import type { Branch } from "@/types/branch";
import styles from "./style.module.css";

export interface BranchesPageTemplateProps {
  search: string;
  setSearch: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  formOpen: boolean;
  setFormOpen: (o: boolean) => void;
  deleteOpen: boolean;
  setDeleteOpen: (o: boolean) => void;
  selected: Branch | null;
  setSelected: (b: Branch | null) => void;
  data: ReturnType<typeof useBranches>["data"];
  isLoading: boolean;
  columns: Column<Branch>[];
  canCreate: boolean;
  handleSubmit: (form: BranchFormValues) => Promise<void>;
  handleDelete: () => Promise<void>;
  formLoading: boolean;
  deleteLoading: boolean;
  showEmptyBanner: boolean;
}

export function useBranchesPageScript(): BranchesPageTemplateProps {
  const { user } = useAuth();
  const { refreshBranches } = useBranch();
  const { can } = usePermissions();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Branch | null>(null);

  const params = {
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    companyId: user?.companyId || undefined,
  };

  const { data, isLoading } = useBranches(params);
  const { create, update, remove } = useBranchMutations();

  const columns: Column<Branch>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "address", header: "Address", cell: (r) => r.address ?? "—" },
    { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
    {
      key: "gps",
      header: "GPS Zone",
      cell: (r) => (r.gpsCoordinates ? `${r.allowedRadius ?? 100}m radius` : "—"),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className={styles.actions}>
          {can("branch:edit") ? (
            <button
              type="button"
              onClick={() => { setSelected(r); setFormOpen(true); }}
              className={styles.actionBtn}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {can("branch:delete") ? (
            <button
              type="button"
              onClick={() => { setSelected(r); setDeleteOpen(true); }}
              className={`${styles.actionBtn} ${styles.actionDanger}`}
              title="Archive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  async function handleSubmit(form: BranchFormValues) {
    if (selected && formOpen) {
      await update.mutateAsync({ id: selected._id, data: formToUpdatePayload(form) });
    } else {
      await create.mutateAsync(formToCreatePayload(form));
    }
    await refreshBranches();
    setFormOpen(false);
    setSelected(null);
  }

  async function handleDelete() {
    if (selected) {
      await remove.mutateAsync(selected._id);
      await refreshBranches();
      setDeleteOpen(false);
      setSelected(null);
    }
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    formOpen,
    setFormOpen,
    deleteOpen,
    setDeleteOpen,
    selected,
    setSelected,
    data,
    isLoading,
    columns,
    canCreate: can("branch:create"),
    handleSubmit,
    handleDelete,
    formLoading: create.isPending || update.isPending,
    deleteLoading: remove.isPending,
    showEmptyBanner: !data?.data?.length && !isLoading,
  };
}
