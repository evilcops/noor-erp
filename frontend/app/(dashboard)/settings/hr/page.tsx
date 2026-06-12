import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const metadata = {
  title: "HR Settings",
};

export default function HrSettingsPage() {
  return (
    <PlaceholderPage
      title="HR Settings"
      description="Leave types, document categories, attendance rules, and HR policies."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Settings" },
        { label: "HR Settings" },
      ]}
    />
  );
}
