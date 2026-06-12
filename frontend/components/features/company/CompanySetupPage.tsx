"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { usePermissions } from "@/hooks/usePermissions";
import { companyApi, type Company } from "@/lib/api/companies";

export function CompanySetupPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", email: "", phone: "", address: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.getAll(),
  });

  const createMut = useMutation({
    mutationFn: () => companyApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setForm({ name: "", code: "", email: "", phone: "", address: "" });
    },
  });

  const columns: Column<Company>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Company Settings"
        description="Manage companies in your organization. Create a company before adding branches and employees."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings" },
          { label: "Company" },
        ]}
        actions={
          can("company:create") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyTitle="No companies"
        emptyDescription="Create your first company, then add branches."
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add Company"
        footer={
          <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>
            Create Company
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="NOOR Trading LLC" />
          </div>
          <div>
            <Label>Company Code *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="NOOR01" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
