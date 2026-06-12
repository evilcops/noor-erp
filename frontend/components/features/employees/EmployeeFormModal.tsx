"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { FileUpload } from "@/components/common/FileUpload";
import { useBranch } from "@/hooks";
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/validations/employee";
import type { Employee } from "@/types/employee";

const DEPARTMENTS = ["HR", "IT", "Sales", "Operations", "Finance", "Marketing"];
const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
  { value: "archived", label: "Archived" },
];
const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "visa", label: "Visa" },
  { value: "labour_card", label: "Labour Card" },
  { value: "id_card", label: "ID Card" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
];

const EMPTY: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  branchId: "",
  department: "",
  designation: "",
  employmentType: "full_time",
  joiningDate: "",
  contractStartDate: "",
  contractEndDate: "",
  status: "active",
  notes: "",
};

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onUploadDocument?: (file: File, type: string, expiryDate: string) => Promise<void>;
  loading?: boolean;
}

export function EmployeeFormModal({
  open,
  onOpenChange,
  employee,
  onSubmit,
  onUploadDocument,
  loading,
}: EmployeeFormModalProps) {
  const { branches } = useBranch();
  const [tab, setTab] = useState("personal");
  const [form, setForm] = useState<EmployeeFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormValues, string>>>({});
  const [docType, setDocType] = useState("passport");
  const [docExpiry, setDocExpiry] = useState("");

  useEffect(() => {
    if (employee) {
      setForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone ?? "",
        address: employee.address ?? "",
        emergencyContactName: employee.emergencyContact?.name ?? "",
        emergencyContactRelationship: employee.emergencyContact?.relationship ?? "",
        emergencyContactPhone: employee.emergencyContact?.phone ?? "",
        branchId: employee.branchId,
        department: employee.department ?? "",
        designation: employee.designation ?? "",
        employmentType: employee.employmentType,
        joiningDate: employee.joiningDate?.slice(0, 10) ?? "",
        contractStartDate: employee.contractStartDate?.slice(0, 10) ?? "",
        contractEndDate: employee.contractEndDate?.slice(0, 10) ?? "",
        status: employee.status,
        notes: employee.notes ?? "",
      });
    } else {
      setForm({ ...EMPTY, branchId: branches[0]?._id ?? "" });
    }
    setTab("personal");
    setErrors({});
  }, [employee, open, branches]);

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit() {
    const result = employeeFormSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof EmployeeFormValues;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    await onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={employee ? "Edit Employee" : "Add Employee"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {employee ? "Save Changes" : "Create Employee"}
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { id: "personal", label: "Personal" },
          { id: "employment", label: "Employment" },
          { id: "status", label: "Status & Documents" },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "personal" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>First Name *</Label>
            <Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} error={errors.firstName} />
          </div>
          <div>
            <Label>Last Name *</Label>
            <Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} error={errors.lastName} />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} error={errors.email} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label>Emergency Contact Name</Label>
            <Input value={form.emergencyContactName} onChange={(e) => updateField("emergencyContactName", e.target.value)} />
          </div>
          <div>
            <Label>Relationship</Label>
            <Input value={form.emergencyContactRelationship} onChange={(e) => updateField("emergencyContactRelationship", e.target.value)} />
          </div>
          <div>
            <Label>Emergency Phone</Label>
            <Input value={form.emergencyContactPhone} onChange={(e) => updateField("emergencyContactPhone", e.target.value)} />
          </div>
        </div>
      ) : null}

      {tab === "employment" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {employee ? (
            <div>
              <Label>Employee ID</Label>
              <Input value={employee.employeeId} readOnly className="bg-muted" />
            </div>
          ) : null}
          <div>
            <Label>Branch *</Label>
            <Select
              value={form.branchId}
              onChange={(e) => updateField("branchId", e.target.value)}
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
              placeholder="Select branch"
              error={errors.branchId}
            />
          </div>
          <div>
            <Label>Department *</Label>
            <Input
              list="departments"
              value={form.department}
              onChange={(e) => updateField("department", e.target.value)}
              error={errors.department}
            />
            <datalist id="departments">
              {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <Label>Designation *</Label>
            <Input value={form.designation} onChange={(e) => updateField("designation", e.target.value)} error={errors.designation} />
          </div>
          <div>
            <Label>Employment Type *</Label>
            <Select
              value={form.employmentType}
              onChange={(e) => updateField("employmentType", e.target.value as EmployeeFormValues["employmentType"])}
              options={EMPLOYMENT_TYPES}
            />
          </div>
          <div>
            <Label>Joining Date *</Label>
            <Input type="date" value={form.joiningDate} onChange={(e) => updateField("joiningDate", e.target.value)} error={errors.joiningDate} />
          </div>
          <div>
            <Label>Contract Start</Label>
            <Input type="date" value={form.contractStartDate} onChange={(e) => updateField("contractStartDate", e.target.value)} />
          </div>
          <div>
            <Label>Contract End</Label>
            <Input type="date" value={form.contractEndDate} onChange={(e) => updateField("contractEndDate", e.target.value)} />
          </div>
        </div>
      ) : null}

      {tab === "status" ? (
        <div className="space-y-4">
          <div>
            <Label>Employment Status *</Label>
            <Select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value as EmployeeFormValues["status"])}
              options={STATUS_OPTIONS}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          {employee && onUploadDocument ? (
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 text-sm font-medium">Upload Document</h4>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <Select value={docType} onChange={(e) => setDocType(e.target.value)} options={DOC_TYPES} />
                <Input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
              </div>
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onFileSelect={(file) => onUploadDocument(file, docType, docExpiry)}
              />
              {employee.documents?.length ? (
                <ul className="mt-4 space-y-2">
                  {employee.documents.map((doc) => (
                    <li key={doc._id} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{doc.type.replace(/_/g, " ")}</span>
                      {doc.expiryDate ? (
                        <span className="text-muted-foreground">
                          Expires {new Date(doc.expiryDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

export function formToPayload(form: EmployeeFormValues, companyId: string) {
  return {
    companyId,
    branchId: form.branchId,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone || undefined,
    address: form.address || undefined,
    emergencyContact:
      form.emergencyContactName
        ? {
            name: form.emergencyContactName,
            relationship: form.emergencyContactRelationship || "Other",
            phone: form.emergencyContactPhone || "",
          }
        : undefined,
    department: form.department,
    designation: form.designation,
    employmentType: form.employmentType,
    joiningDate: form.joiningDate,
    contractStartDate: form.contractStartDate || undefined,
    contractEndDate: form.contractEndDate || undefined,
    status: form.status,
    notes: form.notes || undefined,
  };
}
