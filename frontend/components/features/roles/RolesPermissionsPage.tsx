"use client";

import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { PermissionBadges } from "@/components/features/roles/PermissionMatrix";
import {
  UserPermissionsModal,
  type PermissionsFormState,
} from "@/components/features/roles/UserPermissionsModal";
import { ROLE_LABELS } from "@/config/permissions";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useRoleDefinitions, useUserMutations, useUsers } from "@/hooks/useUsers";
import type { ManagedUser } from "@/lib/api/users";
import type { UserRole } from "@/types/auth-user";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: ROLE_LABELS.super_admin },
  { value: "business_owner", label: ROLE_LABELS.business_owner },
  { value: "branch_manager", label: ROLE_LABELS.branch_manager },
  { value: "hr_manager", label: ROLE_LABELS.hr_manager },
  { value: "employee", label: ROLE_LABELS.employee },
];

const ROLE_FILTER = [
  { value: "", label: "All Roles" },
  ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
];

interface UserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
}

const EMPTY_FORM: UserFormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "employee",
};

function getAssignableRoles(actorRole: UserRole): UserRole[] {
  const map: Record<UserRole, UserRole[]> = {
    super_admin: ["super_admin", "business_owner", "branch_manager", "hr_manager", "employee"],
    business_owner: ["business_owner", "branch_manager", "hr_manager", "employee"],
    branch_manager: ["employee"],
    hr_manager: ["employee"],
    employee: [],
  };
  return map[actorRole] ?? [];
}

export function RolesPermissionsPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [isEdit, setIsEdit] = useState(false);

  const assignableRoles = useMemo(
    () => getAssignableRoles(currentUser?.role ?? "employee"),
    [currentUser?.role]
  );

  const roleOptions = ROLE_OPTIONS.filter((r) => assignableRoles.includes(r.value));

  const { data, isLoading, refetch } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: roleFilter || undefined,
  });

  const { data: roleDefs } = useRoleDefinitions();
  const { create, update, remove } = useUserMutations();

  const users = data?.data ?? [];
  const meta = data?.meta;

  function openCreate() {
    setIsEdit(false);
    setSelected(null);
    setForm({
      ...EMPTY_FORM,
      role: assignableRoles.includes("employee") ? "employee" : assignableRoles[0],
    });
    setFormOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setIsEdit(true);
    setSelected(user);
    setForm({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      role: user.role,
    });
    setFormOpen(true);
  }

  function openPermissions(user: ManagedUser) {
    setSelected(user);
    setPermissionsOpen(true);
  }

  async function handleSubmit() {
    if (isEdit && selected) {
      await update.mutateAsync({
        id: selected.id,
        data: {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        },
      });
    } else {
      await create.mutateAsync({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        role: form.role,
        companyId: currentUser?.companyId,
      });
    }
    setFormOpen(false);
    refetch();
  }

  async function handlePermissionsSave(data: PermissionsFormState) {
    if (!selected) return;
    await update.mutateAsync({
      id: selected.id,
      data: {
        role: data.role,
        useCustomPermissions: data.useCustomPermissions,
        permissions: data.useCustomPermissions ? data.permissions : [],
      },
    });
    if (selected.id === currentUser?.id) {
      await refreshUser();
    }
    setPermissionsOpen(false);
    refetch();
  }

  async function handleDelete() {
    if (!selected) return;
    await remove.mutateAsync(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    refetch();
  }

  const columns: Column<ManagedUser>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.fullName}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (r) => (
        <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          {ROLE_LABELS[r.role]}
        </span>
      ),
    },
    {
      key: "permissions",
      header: "Access",
      cell: (r) => (
        <button
          type="button"
          disabled={!can("user:edit")}
          onClick={(e) => {
            e.stopPropagation();
            if (can("user:edit")) openPermissions(r);
          }}
          className="text-left disabled:cursor-default"
        >
          {r.useCustomPermissions ? (
            <span className="text-xs text-amber-600">Custom</span>
          ) : (
            <span className="text-xs text-muted-foreground">Role defaults</span>
          )}
          <div className="mt-0.5">
            <PermissionBadges permissions={r.effectivePermissions ?? []} />
          </div>
          {can("user:edit") ? (
            <span className="mt-1 block text-[10px] text-brand hover:underline">
              Click to edit permissions
            </span>
          ) : null}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {can("user:edit") ? (
            <>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Edit user"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(r);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Edit permissions"
                onClick={(e) => {
                  e.stopPropagation();
                  openPermissions(r);
                }}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {can("user:delete") && r.id !== currentUser?.id ? (
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive"
              title="Deactivate user"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(r);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Manage users, assign roles, and configure granular access for each module and action."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings" },
          { label: "Roles & Permissions" },
        ]}
        actions={
          activeTab === "users" && can("user:create") ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          ) : null
        }
      />

      <Tabs
        tabs={[
          { id: "users", label: "Users" },
          { id: "roles", label: "Role Defaults" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === "users" ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search users..."
            />
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              options={ROLE_FILTER}
              className="sm:w-48"
            />
          </div>

          <DataTable
            columns={columns}
            data={users}
            loading={isLoading}
            emptyTitle="No users found"
            emptyDescription="Create a user and assign a role to get started."
            page={page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Default permissions assigned to each role. Users inherit these unless custom
            permissions are enabled.
          </p>
          {(roleDefs ?? Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({ role, permissions }))).map(
            (def) => (
              <div key={def.role} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-brand" />
                  <h3 className="font-semibold text-foreground">
                    {ROLE_LABELS[def.role as UserRole]}
                  </h3>
                  <span className="text-xs text-muted-foreground">({def.role})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {def.permissions.includes("*") ? (
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                      Full system access
                    </span>
                  ) : (
                    def.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
                      >
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={isEdit ? "Edit User" : "Add User"}
        description={
          isEdit
            ? "Update user profile details."
            : "Create a new user. You can set permissions after creation."
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              onClick={handleSubmit}
              disabled={!form.email || !form.firstName || !form.lastName || (!isEdit && !form.password)}
            >
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password">{isEdit ? "New Password (optional)" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={isEdit ? "Leave blank to keep current" : "Min. 8 characters"}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                options={roleOptions}
              />
            </div>
          </div>
        </div>
      </Modal>

      <UserPermissionsModal
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={selected}
        roleOptions={roleOptions}
        loading={update.isPending}
        onSave={handlePermissionsSave}
      />

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Deactivate User"
        description={`Are you sure you want to deactivate ${selected?.fullName}? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={handleDelete}
        loading={remove.isPending}
      />
    </div>
  );
}
