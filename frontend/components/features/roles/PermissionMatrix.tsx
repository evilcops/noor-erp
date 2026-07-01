"use client";

import {
  ACTION_LABELS,
  permissionKey,
  RESOURCE_LABELS,
  UI_ACTIONS,
  UI_RESOURCES,
} from "@/config/permissions";
import type { Action, Resource } from "@/types/auth-user";
import { cn } from "@/lib/utils";

interface PermissionMatrixProps {
  value: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

function isChecked(permissions: string[], resource: Resource, action: Action): boolean {
  const key = permissionKey(resource, action);
  return permissions.some((p) => {
    if (p === "*") return true;
    const [gRes, gAct] = p.split(":");
    if (gRes === resource && (gAct === "*" || gAct === action)) return true;
    return false;
  });
}

function togglePermission(
  permissions: string[],
  resource: Resource,
  action: Action,
  checked: boolean
): string[] {
  const other = permissions.filter((p) => {
    if (p === "*") return false;
    const [gRes] = p.split(":");
    return gRes !== resource;
  });

  const currentActions = new Set<Action>();
  for (const p of permissions) {
    const [gRes, gAct] = p.split(":");
    if (gRes !== resource) continue;
    if (gAct === "*") {
      UI_ACTIONS.forEach((a) => currentActions.add(a));
    } else {
      currentActions.add(gAct as Action);
    }
  }

  if (checked) currentActions.add(action);
  else currentActions.delete(action);

  return [...other, ...[...currentActions].map((a) => permissionKey(resource, a))];
}

export function PermissionMatrix({ value, onChange, disabled }: PermissionMatrixProps) {
  function handleToggle(resource: Resource, action: Action, checked: boolean) {
    onChange(togglePermission(value, resource, action, checked));
  }

  function handleRowAll(resource: Resource, checked: boolean) {
    const withoutResource = value.filter((p) => {
      const [gRes] = p.split(":");
      return gRes !== resource && p !== "*";
    });
    if (checked) {
      onChange([...withoutResource, ...UI_ACTIONS.map((a) => permissionKey(resource, a))]);
    } else {
      onChange(withoutResource);
    }
  }

  function isRowAllChecked(resource: Resource): boolean {
    return UI_ACTIONS.every((a) => isChecked(value, resource, a));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground">All</th>
            {UI_ACTIONS.map((action) => (
              <th key={action} className="px-3 py-2 text-center font-medium text-muted-foreground">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UI_RESOURCES.map((resource) => (
            <tr key={resource} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium text-foreground">{RESOURCE_LABELS[resource]}</td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={isRowAllChecked(resource)}
                  disabled={disabled}
                  onChange={(e) => handleRowAll(resource, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
              </td>
              {UI_ACTIONS.map((action) => (
                <td key={action} className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isChecked(value, resource, action)}
                    disabled={disabled}
                    onChange={(e) => handleToggle(resource, action, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-brand"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionBadges({ permissions }: { permissions: string[] }) {
  if (permissions.includes("*")) {
    return (
      <span className="inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
        Full Access
      </span>
    );
  }

  const count = permissions.length;
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">No permissions</span>;
  }

  return (
    <span className={cn("text-xs text-muted-foreground")}>
      {count} permission{count !== 1 ? "s" : ""}
    </span>
  );
}
