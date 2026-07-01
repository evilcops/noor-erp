"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PermissionMatrix } from "@/components/features/roles/PermissionMatrix";
import { expandPermission, ROLE_LABELS } from "@/config/permissions";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import type { ManagedUser } from "@/lib/api/users";
import type { UserRole } from "@/types/auth-user";

export interface PermissionsFormState {
  role: UserRole;
  useCustomPermissions: boolean;
  permissions: string[];
}

function expandRolePermissions(role: UserRole): string[] {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (perms.includes("*")) return perms;
  return [...new Set(perms.flatMap((p) => expandPermission(p)))];
}

interface UserPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUser | null;
  roleOptions: { value: UserRole; label: string }[];
  loading?: boolean;
  onSave: (data: PermissionsFormState) => Promise<void>;
}

export function UserPermissionsModal({
  open,
  onOpenChange,
  user,
  roleOptions,
  loading,
  onSave,
}: UserPermissionsModalProps) {
  const [form, setForm] = useState<PermissionsFormState>({
    role: "employee",
    useCustomPermissions: false,
    permissions: [],
  });

  useEffect(() => {
    if (!user || !open) return;
    setForm({
      role: user.role,
      useCustomPermissions: user.useCustomPermissions ?? false,
      permissions: user.useCustomPermissions
        ? (user.permissions ?? [])
        : expandRolePermissions(user.role),
    });
  }, [user, open]);

  const roleDefaultCount = useMemo(
    () => expandRolePermissions(form.role).length,
    [form.role]
  );

  function handleRoleChange(role: UserRole) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: prev.useCustomPermissions ? expandRolePermissions(role) : [],
      useCustomPermissions: prev.useCustomPermissions,
    }));
  }

  function handleCustomToggle(enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      useCustomPermissions: enabled,
      permissions: enabled ? expandRolePermissions(prev.role) : [],
    }));
  }

  async function handleSubmit() {
    await onSave({
      role: form.role,
      useCustomPermissions: form.useCustomPermissions,
      permissions: form.useCustomPermissions ? form.permissions : [],
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Permissions"
      description={
        user
          ? `Configure access for ${user.fullName} (${user.email})`
          : "Configure user access"
      }
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            Update Permissions
          </Button>
        </div>
      }
    >
      <div className="space-y-5 overflow-y-auto p-6">
        {user ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Shield className="h-5 w-5 text-brand" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        ) : null}

        <div>
          <Label htmlFor="perm-role">Role</Label>
          <Select
            id="perm-role"
            value={form.role}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            options={roleOptions}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {form.useCustomPermissions
              ? "Role is kept for reference; access is controlled by custom permissions below."
              : `Uses ${roleDefaultCount} default permission${roleDefaultCount !== 1 ? "s" : ""} from the ${ROLE_LABELS[form.role]} role.`}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.useCustomPermissions}
              onChange={(e) => handleCustomToggle(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-brand"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Use custom permissions</p>
              <p className="text-xs text-muted-foreground">
                Override role defaults. Enable this to grant only specific actions — for example
                View on Employees without create, edit, or delete.
              </p>
            </div>
          </label>
        </div>

        {form.useCustomPermissions ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Permission Matrix</p>
              <Button
                type="button"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    permissions: expandRolePermissions(prev.role),
                  }))
                }
              >
                Reset to role defaults
              </Button>
            </div>
            <PermissionMatrix
              value={form.permissions}
              onChange={(permissions) => setForm((prev) => ({ ...prev, permissions }))}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              This user inherits all permissions from the{" "}
              <strong className="text-foreground">{ROLE_LABELS[form.role]}</strong> role.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 h-8 text-xs"
              onClick={() => handleCustomToggle(true)}
            >
              Customize permissions
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
