import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { BranchFormModal } from "@/components/features/branches/BranchFormModal";
import type { BranchesPageTemplateProps } from "./script";
import styles from "./style.module.css";

export function BranchesPageTemplate({
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
  canCreate,
  handleSubmit,
  handleDelete,
  formLoading,
  deleteLoading,
  showEmptyBanner,
}: BranchesPageTemplateProps) {
  return (
    <div className={styles.root}>
      <PageHeader
        title="Branches"
        description="Manage branch locations and GPS attendance zones. You need at least one branch before adding employees."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings" },
          { label: "Branches" },
        ]}
        actions={
          canCreate ? (
            <Button onClick={() => { setSelected(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          ) : undefined
        }
      />

      {showEmptyBanner ? (
        <div className={styles.emptyBanner}>
          No branches yet. Create your first branch here, then go to{" "}
          <a href="/employees" className={styles.emptyLink}>Employees</a> to add staff.
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchBar
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search name or code..."
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={[
            { value: "", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          className="w-36"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyTitle="No branches found"
        emptyDescription="Add a branch to start managing employees."
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <BranchFormModal
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setSelected(null); }}
        branch={selected}
        onSubmit={handleSubmit}
        loading={formLoading}
      />

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Archive Branch"
        description={`Archive "${selected?.name}"? Employees linked to this branch will remain but the branch will be marked inactive.`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
