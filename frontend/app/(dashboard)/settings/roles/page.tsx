import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const metadata = {
  title: "Roles & Permissions",
};

export default function RolesSettingsPage() {
  return (
    <PlaceholderPage
      title="Roles & Permissions"
      description="Configure role-based access control across companies and branches."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Settings" },
        { label: "Roles & Permissions" },
      ]}
    />
  );
}
