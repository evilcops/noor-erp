"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { FileUpload } from "@/components/common/FileUpload";
import { DocumentViewer } from "@/components/features/employees/DocumentViewer";
import { useBranch } from "@/hooks";
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/validations/employee";
import type {
  ComplianceDocInput,
  ComplianceDocType,
  ComplianceDocs,
  ComplianceFiles,
  Employee,
  EmployeeDocument,
} from "@/types/employee";

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

const COMPLIANCE_DOC_KEYS = [
  "passport",
  "driving_license",
  "pataka",
  "mulkiya",
  "car_insurance",
] as const;

type ComplianceKey = (typeof COMPLIANCE_DOC_KEYS)[number];

const PERSONAL_FIELDS = ["firstName", "lastName", "email"];
const EMPLOYMENT_FIELDS = ["branchId", "department", "designation", "joiningDate"];
const STATUS_FIELDS = ["status"];
const DOC_FIELDS = [
  "passport.issuanceDate",
  "passport.expiryDate",
  "passport.file",
  "driving_license.issuanceDate",
  "driving_license.expiryDate",
  "driving_license.file",
  "pataka.issuanceDate",
  "pataka.expiryDate",
  "pataka.file",
  "mulkiya.issuanceDate",
  "mulkiya.expiryDate",
  "mulkiya.file",
  "car_insurance.issuanceDate",
  "car_insurance.expiryDate",
  "car_insurance.file",
];

function countErrors(errors: Record<string, string>, fields: string[]): number {
  return fields.filter((f) => errors[f]).length;
}

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
  hasVehicle: false,
  passport: { issuanceDate: "", expiryDate: "" },
  driving_license: { issuanceDate: "", expiryDate: "" },
  pataka: { issuanceDate: "", expiryDate: "" },
  mulkiya: { issuanceDate: "", expiryDate: "" },
  car_insurance: { issuanceDate: "", expiryDate: "" },
};

const EMPTY_FILES: ComplianceFiles = {};

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (values: EmployeeFormValues, files: ComplianceFiles) => Promise<void>;
  onUploadDocument?: (file: File, type: string, issuanceDate: string, expiryDate: string) => Promise<void>;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<ComplianceFiles>(EMPTY_FILES);
  const [viewerDoc, setViewerDoc] = useState<EmployeeDocument | null>(null);

  useEffect(() => {
    if (employee) {
      const findDoc = (type: ComplianceDocType) => {
        const d = employee.documents?.find((x) => x.type === type);
        return {
          issuanceDate: d?.issuanceDate?.slice(0, 10) ?? "",
          expiryDate: d?.expiryDate?.slice(0, 10) ?? "",
        };
      };
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
        hasVehicle: employee.hasVehicle ?? false,
        passport: findDoc("passport"),
        driving_license: findDoc("driving_license"),
        pataka: findDoc("pataka"),
        mulkiya: findDoc("mulkiya"),
        car_insurance: findDoc("car_insurance"),
      });
    } else {
      setForm({ ...EMPTY, branchId: branches[0]?._id ?? "" });
    }
    setFiles(EMPTY_FILES);
    setTab("personal");
    setErrors({});
  }, [employee, open, branches]);

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function updateDocDate(docKey: ComplianceKey, field: "issuanceDate" | "expiryDate", value: string) {
    setForm((prev) => ({
      ...prev,
      [docKey]: { ...(prev[docKey] ?? {}), [field]: value },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${docKey}.${field}`];
      return next;
    });
  }

  function setDocFile(type: ComplianceKey, file: File | undefined) {
    setFiles((prev) => ({ ...prev, [type]: file }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${type}.file`];
      return next;
    });
  }

  function toggleVehicle(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      hasVehicle: checked,
      ...(!checked
        ? {
            mulkiya: { issuanceDate: "", expiryDate: "" },
            car_insurance: { issuanceDate: "", expiryDate: "" },
          }
        : {}),
    }));
    if (!checked) {
      setFiles((prev) => {
        const next = { ...prev };
        delete next.mulkiya;
        delete next.car_insurance;
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        ["mulkiya.issuanceDate", "mulkiya.expiryDate", "mulkiya.file",
          "car_insurance.issuanceDate", "car_insurance.expiryDate", "car_insurance.file",
        ].forEach((k) => delete next[k]);
        return next;
      });
    }
  }

  async function handleSubmit() {
    const allErrors: Record<string, string> = {};

    // Zod validation (date fields)
    const result = employeeFormSchema.safeParse(form);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        allErrors[issue.path.join(".")] = issue.message;
      });
    }

    // File validation — required when no existing file is already stored
    const activeDocKeys: ComplianceKey[] = [
      "passport",
      "driving_license",
      "pataka",
      ...(form.hasVehicle ? (["mulkiya", "car_insurance"] as ComplianceKey[]) : []),
    ];
    for (const key of activeDocKeys) {
      const hasExisting = !!employee?.documents?.find((d) => d.type === key)?.fileUrl;
      if (!files[key] && !hasExisting) {
        allErrors[`${key}.file`] = "Document file is required";
      }
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Navigate to first tab that has errors
      if (PERSONAL_FIELDS.some((f) => allErrors[f])) {
        setTab("personal");
      } else if (EMPLOYMENT_FIELDS.some((f) => allErrors[f])) {
        setTab("employment");
      } else if (STATUS_FIELDS.some((f) => allErrors[f])) {
        setTab("status");
      } else {
        setTab("documents");
      }
      return;
    }

    await onSubmit(form, files);
  }

  const personalErrorCount = countErrors(errors, PERSONAL_FIELDS);
  const employmentErrorCount = countErrors(errors, EMPLOYMENT_FIELDS);
  const statusErrorCount = countErrors(errors, STATUS_FIELDS);
  const docErrorCount = countErrors(errors, DOC_FIELDS);

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
          { id: "personal", label: "Personal", errorCount: personalErrorCount },
          { id: "employment", label: "Employment", errorCount: employmentErrorCount },
          { id: "status", label: "Status", errorCount: statusErrorCount },
          { id: "documents", label: "Documents", errorCount: docErrorCount },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {/* ── Personal ── */}
      {tab === "personal" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>First Name *</Label>
            <Input
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              error={errors.firstName}
            />
          </div>
          <div>
            <Label>Last Name *</Label>
            <Input
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              error={errors.lastName}
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={errors.email}
            />
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
            <Input
              value={form.emergencyContactName}
              onChange={(e) => updateField("emergencyContactName", e.target.value)}
            />
          </div>
          <div>
            <Label>Relationship</Label>
            <Input
              value={form.emergencyContactRelationship}
              onChange={(e) => updateField("emergencyContactRelationship", e.target.value)}
            />
          </div>
          <div>
            <Label>Emergency Phone</Label>
            <Input
              value={form.emergencyContactPhone}
              onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {/* ── Employment ── */}
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
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Designation *</Label>
            <Input
              value={form.designation}
              onChange={(e) => updateField("designation", e.target.value)}
              error={errors.designation}
            />
          </div>
          <div>
            <Label>Employment Type *</Label>
            <Select
              value={form.employmentType}
              onChange={(e) =>
                updateField(
                  "employmentType",
                  e.target.value as EmployeeFormValues["employmentType"]
                )
              }
              options={EMPLOYMENT_TYPES}
            />
          </div>
          <div>
            <Label>Joining Date *</Label>
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(e) => updateField("joiningDate", e.target.value)}
              error={errors.joiningDate}
            />
          </div>
          <div>
            <Label>Contract Start</Label>
            <Input
              type="date"
              value={form.contractStartDate}
              onChange={(e) => updateField("contractStartDate", e.target.value)}
            />
          </div>
          <div>
            <Label>Contract End</Label>
            <Input
              type="date"
              value={form.contractEndDate}
              onChange={(e) => updateField("contractEndDate", e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {/* ── Status ── */}
      {tab === "status" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Employment Status *</Label>
            <Select
              value={form.status}
              onChange={(e) =>
                updateField("status", e.target.value as EmployeeFormValues["status"])
              }
              options={STATUS_OPTIONS}
              error={errors.status}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}

      {/* ── Documents ── */}
      {tab === "documents" ? (
        <DocumentsTab
          form={form}
          files={files}
          errors={errors}
          employee={employee}
          viewerDoc={viewerDoc}
          onUpdateDocDate={updateDocDate}
          onSetDocFile={setDocFile}
          onToggleVehicle={toggleVehicle}
          onSetViewerDoc={setViewerDoc}
          onUploadDocument={onUploadDocument}
        />
      ) : null}

      <DocumentViewer
        doc={viewerDoc}
        open={viewerDoc !== null}
        onOpenChange={(o) => {
          if (!o) setViewerDoc(null);
        }}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Documents tab — extracted to keep the main component readable
// ---------------------------------------------------------------------------

interface DocumentsTabProps {
  form: EmployeeFormValues;
  files: ComplianceFiles;
  errors: Record<string, string>;
  employee?: Employee | null;
  viewerDoc: EmployeeDocument | null;
  onUpdateDocDate: (key: ComplianceKey, field: "issuanceDate" | "expiryDate", v: string) => void;
  onSetDocFile: (key: ComplianceKey, file: File | undefined) => void;
  onToggleVehicle: (checked: boolean) => void;
  onSetViewerDoc: (doc: EmployeeDocument | null) => void;
  onUploadDocument?: (file: File, type: string, issuanceDate: string, expiryDate: string) => Promise<void>;
}

function DocumentsTab({
  form,
  files,
  errors,
  employee,
  onUpdateDocDate,
  onSetDocFile,
  onToggleVehicle,
  onSetViewerDoc,
  onUploadDocument,
}: DocumentsTabProps) {
  // Collect missing doc names for the summary banner
  const missing: string[] = [];
  const activeKeys: ComplianceKey[] = [
    "passport",
    "driving_license",
    "pataka",
    ...(form.hasVehicle ? (["mulkiya", "car_insurance"] as ComplianceKey[]) : []),
  ];
  for (const key of activeKeys) {
    const hasExisting = !!employee?.documents?.find((d) => d.type === key)?.fileUrl;
    const hasDateError =
      errors[`${key}.issuanceDate`] ||
      errors[`${key}.expiryDate`] ||
      errors[`${key}.file`];
    if (hasDateError && !hasExisting) {
      const labels: Record<string, string> = {
        passport: "Passport",
        driving_license: "Driving License",
        pataka: "Pataka",
        mulkiya: "Mulkiya",
        car_insurance: "Car Insurance",
      };
      missing.push(labels[key]);
    }
  }

  function findExistingDoc(type: ComplianceKey) {
    return employee?.documents?.find((d) => d.type === type);
  }

  return (
    <div className="space-y-5">
      {/* Error summary banner */}
      {missing.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Required documents missing</p>
            <p className="mt-0.5 text-xs text-destructive/80">
              Please complete: {missing.join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      {/* Passport */}
      <ComplianceDocRow
        label="Passport"
        required
        alertNote="Alerts at 9 months, 6 months, 3 months before expiry"
        issuanceDate={form.passport?.issuanceDate ?? ""}
        expiryDate={form.passport?.expiryDate ?? ""}
        file={files.passport}
        existingDoc={findExistingDoc("passport")}
        issuanceDateError={errors["passport.issuanceDate"]}
        expiryDateError={errors["passport.expiryDate"]}
        fileError={errors["passport.file"]}
        onIssuanceChange={(v) => onUpdateDocDate("passport", "issuanceDate", v)}
        onExpiryChange={(v) => onUpdateDocDate("passport", "expiryDate", v)}
        onFileChange={(f) => onSetDocFile("passport", f)}
        onView={(d) => onSetViewerDoc(d)}
      />

      {/* Driving License */}
      <ComplianceDocRow
        label="Driving License"
        required
        alertNote="Alerts at 9 months, 6 months, 3 months before expiry"
        issuanceDate={form.driving_license?.issuanceDate ?? ""}
        expiryDate={form.driving_license?.expiryDate ?? ""}
        file={files.driving_license}
        existingDoc={findExistingDoc("driving_license")}
        issuanceDateError={errors["driving_license.issuanceDate"]}
        expiryDateError={errors["driving_license.expiryDate"]}
        fileError={errors["driving_license.file"]}
        onIssuanceChange={(v) => onUpdateDocDate("driving_license", "issuanceDate", v)}
        onExpiryChange={(v) => onUpdateDocDate("driving_license", "expiryDate", v)}
        onFileChange={(f) => onSetDocFile("driving_license", f)}
        onView={(d) => onSetViewerDoc(d)}
      />

      {/* Pataka */}
      <ComplianceDocRow
        label="Pataka (Residency Permit / ID)"
        required
        alertNote="Alerts at 2 months, 1 month, 15 days before expiry"
        issuanceDate={form.pataka?.issuanceDate ?? ""}
        expiryDate={form.pataka?.expiryDate ?? ""}
        file={files.pataka}
        existingDoc={findExistingDoc("pataka")}
        issuanceDateError={errors["pataka.issuanceDate"]}
        expiryDateError={errors["pataka.expiryDate"]}
        fileError={errors["pataka.file"]}
        onIssuanceChange={(v) => onUpdateDocDate("pataka", "issuanceDate", v)}
        onExpiryChange={(v) => onUpdateDocDate("pataka", "expiryDate", v)}
        onFileChange={(f) => onSetDocFile("pataka", f)}
        onView={(d) => onSetViewerDoc(d)}
      />

      {/* Vehicle toggle */}
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-3">
        <input
          id="hasVehicle"
          type="checkbox"
          checked={form.hasVehicle ?? false}
          onChange={(e) => onToggleVehicle(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor="hasVehicle" className="cursor-pointer select-none text-sm font-medium">
          Does this employee have / drive a vehicle for work?
        </label>
      </div>

      {/* Vehicle docs */}
      {form.hasVehicle ? (
        <div className="space-y-5 rounded-lg border border-border/60 bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vehicle Documents
          </p>

          <ComplianceDocRow
            label="Mulkiya (Vehicle Registration)"
            required
            alertNote="Alerts at 9 months, 6 months, 3 months before expiry"
            issuanceDate={form.mulkiya?.issuanceDate ?? ""}
            expiryDate={form.mulkiya?.expiryDate ?? ""}
            file={files.mulkiya}
            existingDoc={findExistingDoc("mulkiya")}
            issuanceDateError={errors["mulkiya.issuanceDate"]}
            expiryDateError={errors["mulkiya.expiryDate"]}
            fileError={errors["mulkiya.file"]}
            onIssuanceChange={(v) => onUpdateDocDate("mulkiya", "issuanceDate", v)}
            onExpiryChange={(v) => onUpdateDocDate("mulkiya", "expiryDate", v)}
            onFileChange={(f) => onSetDocFile("mulkiya", f)}
            onView={(d) => onSetViewerDoc(d)}
          />

          <ComplianceDocRow
            label="Car Insurance"
            required
            alertNote="Alerts at 2 months, 1 month, 15 days before expiry"
            issuanceDate={form.car_insurance?.issuanceDate ?? ""}
            expiryDate={form.car_insurance?.expiryDate ?? ""}
            file={files.car_insurance}
            existingDoc={findExistingDoc("car_insurance")}
            issuanceDateError={errors["car_insurance.issuanceDate"]}
            expiryDateError={errors["car_insurance.expiryDate"]}
            fileError={errors["car_insurance.file"]}
            onIssuanceChange={(v) => onUpdateDocDate("car_insurance", "issuanceDate", v)}
            onExpiryChange={(v) => onUpdateDocDate("car_insurance", "expiryDate", v)}
            onFileChange={(f) => onSetDocFile("car_insurance", f)}
            onView={(d) => onSetViewerDoc(d)}
          />
        </div>
      ) : null}

      {/* Legacy upload (edit mode only) */}
      {employee && onUploadDocument ? (
        <LegacyDocUpload employee={employee} onUploadDocument={onUploadDocument} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComplianceDocRow
// ---------------------------------------------------------------------------

interface ComplianceDocRowProps {
  label: string;
  required?: boolean;
  alertNote: string;
  issuanceDate: string;
  expiryDate: string;
  file?: File;
  existingDoc?: EmployeeDocument;
  issuanceDateError?: string;
  expiryDateError?: string;
  fileError?: string;
  onIssuanceChange: (v: string) => void;
  onExpiryChange: (v: string) => void;
  onFileChange: (f: File | undefined) => void;
  onView?: (doc: EmployeeDocument) => void;
}

function ComplianceDocRow({
  label,
  required,
  alertNote,
  issuanceDate,
  expiryDate,
  file,
  existingDoc,
  issuanceDateError,
  expiryDateError,
  fileError,
  onIssuanceChange,
  onExpiryChange,
  onFileChange,
  onView,
}: ComplianceDocRowProps) {
  const hasExistingFile = !!existingDoc?.fileUrl;
  const hasAnyError = issuanceDateError || expiryDateError || fileError;

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasAnyError ? "border-destructive/50 bg-destructive/5" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </span>
        <span className="text-[10px] text-muted-foreground">{alertNote}</span>
      </div>

      {/* Dates */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">
            Issuance Date{required ? " *" : ""}
          </Label>
          <Input
            type="date"
            value={issuanceDate}
            onChange={(e) => onIssuanceChange(e.target.value)}
            error={issuanceDateError}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Expiry Date{required ? " *" : ""}
          </Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => onExpiryChange(e.target.value)}
            error={expiryDateError}
          />
        </div>
      </div>

      {/* File */}
      <div className="mt-3">
        {hasExistingFile && !file ? (
          <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground">File attached</span>
            <button
              type="button"
              onClick={() => onView?.(existingDoc!)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </button>
          </div>
        ) : null}

        <Label
          className={`text-xs ${fileError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {file
            ? `New file: ${file.name}`
            : hasExistingFile
            ? "Replace file (optional)"
            : required
            ? "Attach Document *"
            : "Attach Document (PDF / Image)"}
        </Label>
        <FileUpload
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onFileSelect={(f) => onFileChange(f)}
          error={!hasExistingFile && !file ? fileError : undefined}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LegacyDocUpload
// ---------------------------------------------------------------------------

interface LegacyDocUploadProps {
  employee: Employee;
  onUploadDocument: (file: File, type: string, issuanceDate: string, expiryDate: string) => Promise<void>;
}

function LegacyDocUpload({ employee, onUploadDocument }: LegacyDocUploadProps) {
  const [docType, setDocType] = useState("visa");
  const [docIssuance, setDocIssuance] = useState("");
  const [docExpiry, setDocExpiry] = useState("");

  const LEGACY_DOC_TYPES = [
    { value: "visa", label: "Visa" },
    { value: "labour_card", label: "Labour Card" },
    { value: "id_card", label: "ID Card" },
    { value: "contract", label: "Contract" },
    { value: "certificate", label: "Certificate" },
  ];

  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="mb-3 text-sm font-medium">Upload Additional Document</h4>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          options={LEGACY_DOC_TYPES}
        />
        <Input
          type="date"
          placeholder="Issuance date"
          value={docIssuance}
          onChange={(e) => setDocIssuance(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Expiry date"
          value={docExpiry}
          onChange={(e) => setDocExpiry(e.target.value)}
        />
      </div>
      <FileUpload
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onFileSelect={(file) => onUploadDocument(file, docType, docIssuance, docExpiry)}
      />
      {employee.documents
        ?.filter((d) =>
          ["visa", "labour_card", "id_card", "contract", "certificate"].includes(d.type)
        )
        .map((doc) => (
          <div
            key={doc._id}
            className="mt-2 flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
          >
            <span className="capitalize">{doc.type.replace(/_/g, " ")}</span>
            {doc.expiryDate ? (
              <span className="text-muted-foreground">
                Expires {new Date(doc.expiryDate).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// formToPayload
// ---------------------------------------------------------------------------

function pickDocDates(
  d: { issuanceDate?: string; expiryDate?: string } | undefined
): ComplianceDocInput | undefined {
  if (!d?.issuanceDate && !d?.expiryDate) return undefined;
  return {
    issuanceDate: d.issuanceDate || undefined,
    expiryDate: d.expiryDate || undefined,
  };
}

export function formToPayload(form: EmployeeFormValues, companyId: string) {
  const complianceDocs: ComplianceDocs = {
    passport: pickDocDates(form.passport),
    driving_license: pickDocDates(form.driving_license),
    pataka: pickDocDates(form.pataka),
    ...(form.hasVehicle
      ? {
          mulkiya: pickDocDates(form.mulkiya),
          car_insurance: pickDocDates(form.car_insurance),
        }
      : {}),
  };

  const hasAnyDoc = Object.values(complianceDocs).some(Boolean);

  return {
    companyId,
    branchId: form.branchId,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone || undefined,
    address: form.address || undefined,
    emergencyContact: form.emergencyContactName
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
    hasVehicle: form.hasVehicle ?? false,
    complianceDocs: hasAnyDoc ? complianceDocs : undefined,
  };
}
