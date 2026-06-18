"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  EmployeeFormModal,
  formToPayload,
} from "@/components/features/employees/EmployeeFormModal";
import { EmployeeDetailsModal } from "@/components/features/employees/EmployeeDetailsModal";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmployees, useEmployeeMutations } from "@/hooks/useEmployees";
import type { ComplianceFiles, Employee } from "@/types/employee";
import type { EmployeeFormValues } from "@/lib/validations/employee";

const STATUS_FILTER = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
];
const TYPE_FILTER = [
  { value: "", label: "All Types" },
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];

export function EmployeesPage() {
  const { user } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const { can } = usePermissions();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const params = {
    page,
    limit: 20,
    search: search || undefined,
    branchId: branchFilter || activeBranchId || undefined,
    status: statusFilter || undefined,
    employmentType: typeFilter || undefined,
    department: departmentFilter || undefined,
  };

  const { data, isLoading, refetch } = useEmployees(params);
  const { create, update, remove, uploadDoc, uploadFamilyBataka } = useEmployeeMutations();

  const branchMap = useMemo(
    () => Object.fromEntries(branches.map((b) => [b._id, b.name])),
    [branches]
  );

  const columns: Column<Employee>[] = [
    { key: "id", header: "Employee ID", cell: (r) => <span className="font-mono text-xs">{r.employeeId}</span> },
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <span className="font-medium">{r.firstName} {r.lastName}</span>
      ),
    },
    { key: "email", header: "Email", cell: (r) => r.email },
    { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { key: "branch", header: "Branch", cell: (r) => branchMap[r.branchId] ?? "—" },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="capitalize">{r.employmentType.replace(/_/g, " ")}</span>,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setSelected(r); setDetailsOpen(true); }} className="rounded p-1 hover:bg-muted" title="View">
            <Eye className="h-4 w-4" />
          </button>
          {can("employee:edit") ? (
            <button onClick={() => { setSelected(r); setFormOpen(true); }} className="rounded p-1 hover:bg-muted" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {can("employee:delete") ? (
            <button onClick={() => { setSelected(r); setDeleteOpen(true); }} className="rounded p-1 text-destructive hover:bg-muted" title="Archive">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  async function uploadComplianceFiles(
    employeeId: string,
    files: ComplianceFiles,
    form?: EmployeeFormValues
  ) {
    const entries = Object.entries(files) as [keyof ComplianceFiles, File][];
    await Promise.all(
      entries.map(([type, file]) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", type);
        // Send dates so the document record is always complete
        const docDates = form?.[type as keyof EmployeeFormValues] as
          | { issuanceDate?: string; expiryDate?: string }
          | undefined;
        if (docDates?.issuanceDate) fd.append("issuanceDate", docDates.issuanceDate);
        if (docDates?.expiryDate) fd.append("expiryDate", docDates.expiryDate);
        return uploadDoc.mutateAsync({ id: employeeId, formData: fd });
      })
    );
  }

  async function uploadFamilyBatakaFiles(
    employeeId: string,
    savedMembers: import("@/types/employee").FamilyMember[],
    files: Map<number, File>
  ) {
    await Promise.all(
      Array.from(files.entries()).map(([idx, file]) => {
        const memberId = savedMembers[idx]?._id;
        if (!memberId) return Promise.resolve();
        const fd = new FormData();
        fd.append("file", file);
        return uploadFamilyBataka.mutateAsync({ id: employeeId, memberId, formData: fd });
      })
    );
  }

  async function handleSubmit(
    form: EmployeeFormValues,
    files: ComplianceFiles,
    extra?: { familyType?: "individual" | "family"; familyMembers?: import("@/types/employee").FamilyMember[]; familyBatakaFiles?: Map<number, File> }
  ) {
    const branch = branches.find((b) => b._id === form.branchId);
    const companyId = user?.companyId ?? branch?.companyId;
    if (!companyId) {
      toast.error("Create a company and branch first (Settings → Company → Branches)");
      return;
    }
    if (!form.branchId) {
      toast.error("Select a branch for this employee");
      return;
    }
    const payload = formToPayload(form, companyId, extra);
    const fbFiles = extra?.familyBatakaFiles;
    if (selected && formOpen) {
      const updated = await update.mutateAsync({ id: selected._id, data: payload });
      if (Object.keys(files).length) {
        await uploadComplianceFiles(selected._id, files, form);
      }
      if (fbFiles?.size && updated?.familyMembers?.length) {
        await uploadFamilyBatakaFiles(selected._id, updated.familyMembers, fbFiles);
      }
    } else {
      const created = await create.mutateAsync(payload);
      if (Object.keys(files).length && created?._id) {
        await uploadComplianceFiles(created._id, files, form);
      }
      if (fbFiles?.size && created?._id && created?.familyMembers?.length) {
        await uploadFamilyBatakaFiles(created._id, created.familyMembers, fbFiles);
      }
    }
    setFormOpen(false);
    setSelected(null);
  }

  async function handleUpload(file: File, type: string, issuanceDate: string, expiryDate: string) {
    if (!selected) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (issuanceDate) fd.append("issuanceDate", issuanceDate);
    if (expiryDate) fd.append("expiryDate", expiryDate);
    await uploadDoc.mutateAsync({ id: selected._id, formData: fd });
    refetch();
  }

  function handleExport() {
    const rows = data?.data ?? [];
    const csv = [
      ["Employee ID", "Name", "Email", "Department", "Branch", "Type", "Status"].join(","),
      ...rows.map((r) =>
        [r.employeeId, `${r.firstName} ${r.lastName}`, r.email, r.department, branchMap[r.branchId], r.employmentType, r.status].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    toast.success("Export downloaded");
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your workforce — add, edit, and track employee records."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Employees" }]}
        actions={
          can("employee:create") ? (
            <Button onClick={() => { setSelected(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          ) : undefined
        }
      />

      {!branches.length && !isLoading ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          No branches available.{" "}
          <a href="/settings/branches" className="font-medium underline">Add a branch</a>{" "}
          before creating employees.
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email, ID..." />
        </div>
        <Select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }} options={[{ value: "", label: "All Branches" }, ...branches.map((b) => ({ value: b._id, label: b.name }))]} className="w-40" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} options={STATUS_FILTER} className="w-36" />
        <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} options={TYPE_FILTER} className="w-36" />
        <input
          type="text"
          placeholder="Department"
          value={departmentFilter}
          onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
          className="h-10 w-36 rounded-lg border border-border bg-card px-3 text-sm"
        />
        {can("employee:export") || can("report:export") ? (
          <Button variant="secondary" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        ) : null}
      </div>

      {selectedIds.size > 0 && can("employee:edit") ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2">
          <span className="text-sm">{selectedIds.size} selected</span>
          <Button variant="secondary" onClick={() => toast.info("Bulk status change — select status in filter and edit individually for now")}>
            Bulk Actions
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyTitle="No employees found"
        emptyDescription="Add your first employee or adjust filters."
        onRowClick={(row) => { setSelected(row); setDetailsOpen(true); }}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
        selectedIds={selectedIds}
        getRowId={(r) => r._id}
        onSelectRow={can("employee:edit") ? (id, checked) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
          });
        } : undefined}
      />

      <EmployeeFormModal
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setSelected(null); }}
        employee={selected}
        onSubmit={handleSubmit}
        onUploadDocument={selected ? handleUpload : undefined}
        loading={create.isPending || update.isPending}
      />

      <EmployeeDetailsModal
        employeeId={selected?._id ?? null}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        branchName={selected ? branchMap[selected.branchId] : undefined}
        onEdit={(emp) => { setDetailsOpen(false); setSelected(emp); setFormOpen(true); }}
      />

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Archive Employee"
        description={`Archive ${selected?.firstName} ${selected?.lastName}? This is a soft delete.`}
        confirmLabel="Archive"
        variant="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (selected) {
            await remove.mutateAsync(selected._id);
            setDeleteOpen(false);
            setSelected(null);
          }
        }}
      />
    </div>
  );
}
