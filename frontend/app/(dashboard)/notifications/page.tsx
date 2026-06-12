import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return (
    <PlaceholderPage
      title="Notifications"
      description="All system notifications — leave, attendance, documents, and recruitment."
      breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Notifications" }]}
    />
  );
}
