import { useAuth } from "@/hooks";
import { hasPermission, isHrOrAbove, isManager } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();
  return {
    user,
    can: (permission: string) => hasPermission(user, permission),
    isManager: isManager(user),
    isHrOrAbove: isHrOrAbove(user),
  };
}
