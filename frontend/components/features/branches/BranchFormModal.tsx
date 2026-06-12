"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/hooks";
import { companyApi } from "@/lib/api/companies";
import type { Branch } from "@/types/branch";

export interface BranchFormValues {
  companyId: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  lat: string;
  lng: string;
  allowedRadius: string;
  status: "active" | "inactive";
}

const EMPTY: BranchFormValues = {
  companyId: "",
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  lat: "",
  lng: "",
  allowedRadius: "100",
  status: "active",
};

interface BranchFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  loading?: boolean;
}

export function BranchFormModal({
  open,
  onOpenChange,
  branch,
  onSubmit,
  loading,
}: BranchFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<BranchFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof BranchFormValues, string>>>({});

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.getAll(),
    enabled: open && !user?.companyId,
  });

  useEffect(() => {
    if (branch) {
      setForm({
        companyId: branch.companyId,
        name: branch.name,
        code: branch.code,
        address: branch.address ?? "",
        phone: branch.phone ?? "",
        email: branch.email ?? "",
        lat: branch.gpsCoordinates?.lat?.toString() ?? "",
        lng: branch.gpsCoordinates?.lng?.toString() ?? "",
        allowedRadius: String(branch.allowedRadius ?? 100),
        status: branch.status,
      });
    } else {
      setForm({
        ...EMPTY,
        companyId: user?.companyId ?? "",
        allowedRadius: "100",
      });
    }
    setErrors({});
  }, [branch, open, user?.companyId]);

  function update<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit() {
    const next: Partial<Record<keyof BranchFormValues, string>> = {};
    if (!form.companyId) next.companyId = "Company is required";
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.code.trim()) next.code = "Code is required";
    if (form.code.length < 2) next.code = "Code must be at least 2 characters";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    await onSubmit(form);
  }

  const companyOptions = (companies?.data ?? []).map((c) => ({
    value: c._id,
    label: `${c.name} (${c.code})`,
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={branch ? "Edit Branch" : "Add Branch"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {branch ? "Save Changes" : "Create Branch"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!user?.companyId ? (
          <div className="sm:col-span-2">
            <Label>Company *</Label>
            <Select
              value={form.companyId}
              onChange={(e) => update("companyId", e.target.value)}
              options={companyOptions}
              placeholder="Select company"
              error={errors.companyId}
            />
            {companyOptions.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600">
                No companies found. Create a company in Settings → Company first.
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label>Branch Name *</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} error={errors.name} placeholder="Muscat HQ" />
        </div>
        <div>
          <Label>Branch Code *</Label>
          <Input
            value={form.code}
            onChange={(e) => update("code", e.target.value.toUpperCase())}
            error={errors.code}
            placeholder="MCT-HQ"
            disabled={!!branch}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Al Khuwair, Muscat" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+968 2412 3456" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <Label>GPS Latitude</Label>
          <Input type="number" step="any" value={form.lat} onChange={(e) => update("lat", e.target.value)} placeholder="23.5880" />
        </div>
        <div>
          <Label>GPS Longitude</Label>
          <Input type="number" step="any" value={form.lng} onChange={(e) => update("lng", e.target.value)} placeholder="58.3829" />
        </div>
        <div>
          <Label>Attendance Radius (m)</Label>
          <Input type="number" value={form.allowedRadius} onChange={(e) => update("allowedRadius", e.target.value)} />
        </div>
        {branch ? (
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => update("status", e.target.value as BranchFormValues["status"])}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

import type { CreateBranchInput, UpdateBranchInput } from "@/types/branch";

export function formToCreatePayload(form: BranchFormValues): CreateBranchInput {
  const payload: CreateBranchInput = {
    companyId: form.companyId,
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    address: form.address || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    allowedRadius: form.allowedRadius ? Number(form.allowedRadius) : 100,
  };
  if (form.lat && form.lng) {
    payload.gpsCoordinates = { lat: Number(form.lat), lng: Number(form.lng) };
  }
  return payload;
}

export function formToUpdatePayload(form: BranchFormValues): UpdateBranchInput {
  const payload: UpdateBranchInput = {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    address: form.address || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    allowedRadius: form.allowedRadius ? Number(form.allowedRadius) : 100,
    status: form.status,
  };
  if (form.lat && form.lng) {
    payload.gpsCoordinates = { lat: Number(form.lat), lng: Number(form.lng) };
  }
  return payload;
}
