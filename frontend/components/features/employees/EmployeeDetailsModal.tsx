"use client";

import { useState } from "react";
import { AlertTriangle, Download, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { DocumentViewer } from "@/components/features/employees/DocumentViewer";
import { useEmployee } from "@/hooks/useEmployees";
import type { Employee, EmployeeDocument } from "@/types/employee";

const COMPLIANCE_TYPES = new Set([
  "passport",
  "driving_license",
  "pataka",
  "mulkiya",
  "car_insurance",
]);

const DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  driving_license: "Driving License",
  pataka: "Pataka (Residency Permit / ID)",
  mulkiya: "Mulkiya (Vehicle Registration)",
  car_insurance: "Car Insurance",
  visa: "Visa",
  labour_card: "Labour Card",
  id_card: "ID Card",
  contract: "Contract",
  certificate: "Certificate",
};

// Tighter thresholds (days) for pataka/car_insurance
const TIGHT_TYPES = new Set(["pataka", "car_insurance"]);

function docExpiryInfo(doc: EmployeeDocument): {
  label: string;
  color: string;
  icon: boolean;
} | null {
  if (!doc.expiryDate) return null;
  const days = Math.ceil(
    (new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) return { label: "Expired", color: "text-destructive", icon: true };

  const critical = TIGHT_TYPES.has(doc.type) ? 15 : 91;
  const warn = TIGHT_TYPES.has(doc.type) ? 61 : 274;

  if (days <= critical) return { label: `Expires in ${days}d`, color: "text-destructive", icon: true };
  if (days <= warn) return { label: `Expires in ${days}d`, color: "text-warning", icon: true };
  return { label: new Date(doc.expiryDate).toLocaleDateString(), color: "text-muted-foreground", icon: false };
}

interface EmployeeDetailsModalProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
  branchName?: string;
}

export function EmployeeDetailsModal({
  employeeId,
  open,
  onOpenChange,
  onEdit,
  branchName,
}: EmployeeDetailsModalProps) {
  const { data: employee, isLoading } = useEmployee(open ? employeeId : null);
  const [tab, setTab] = useState("overview");
  const [viewerDoc, setViewerDoc] = useState<EmployeeDocument | null>(null);

  const complianceDocs = employee?.documents?.filter((d) => COMPLIANCE_TYPES.has(d.type)) ?? [];
  const otherDocs = employee?.documents?.filter((d) => !COMPLIANCE_TYPES.has(d.type)) ?? [];
  const totalDocs = complianceDocs.length + otherDocs.length;

  // Badge: count docs with expiry issues
  const alertDocCount = (employee?.documents ?? []).filter((d) => {
    if (!d.expiryDate) return false;
    const days = Math.ceil(
      (new Date(d.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const threshold = TIGHT_TYPES.has(d.type) ? 61 : 274;
    return days <= threshold;
  }).length;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) setTab("overview");
        }}
        title="Employee Details"
        size="xl"
        footer={
          employee ? (
            <Button onClick={() => onEdit(employee)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Employee
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : employee ? (
          <>
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  {employee.firstName} {employee.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
              </div>
              <StatusBadge status={employee.status} />
            </div>

            <Tabs
              tabs={[
                { id: "overview", label: "Overview" },
                {
                  id: "documents",
                  label: `Documents${totalDocs ? ` (${totalDocs})` : ""}`,
                  errorCount: alertDocCount,
                },
              ]}
              activeTab={tab}
              onChange={setTab}
              className="mb-5"
            />

            {/* Overview tab */}
            {tab === "overview" ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <Section title="Contact">
                  <Field label="Email" value={employee.email} />
                  <Field label="Phone" value={employee.phone} />
                  <Field label="Address" value={employee.address} />
                </Section>
                <Section title="Employment">
                  <Field label="Branch" value={branchName} />
                  <Field label="Department" value={employee.department} />
                  <Field label="Designation" value={employee.designation} />
                  <Field
                    label="Type"
                    value={employee.employmentType.replace(/_/g, " ")}
                  />
                  <Field
                    label="Joined"
                    value={
                      employee.joiningDate
                        ? new Date(employee.joiningDate).toLocaleDateString()
                        : undefined
                    }
                  />
                </Section>
                <Section title="Status">
                  <Field label="Employment Status" value={employee.status.replace(/_/g, " ")} />
                  <Field
                    label="Vehicle for Work"
                    value={employee.hasVehicle ? "Yes" : "No"}
                  />
                </Section>
                {employee.emergencyContact ? (
                  <Section title="Emergency Contact">
                    <Field label="Name" value={employee.emergencyContact.name} />
                    <Field
                      label="Relationship"
                      value={employee.emergencyContact.relationship}
                    />
                    <Field label="Phone" value={employee.emergencyContact.phone} />
                  </Section>
                ) : null}
                {employee.notes ? (
                  <Section title="Notes">
                    <p className="text-sm text-muted-foreground">{employee.notes}</p>
                  </Section>
                ) : null}
                <Section title="Activity">
                  <p className="text-sm">
                    Created {new Date(employee.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Last updated {new Date(employee.updatedAt).toLocaleString()}
                  </p>
                </Section>
              </div>
            ) : null}

            {/* Documents tab */}
            {tab === "documents" ? (
              <div className="space-y-5">
                {/* Compliance docs */}
                {complianceDocs.length ? (
                  <Section title="Compliance Documents">
                    <ul className="space-y-2">
                      {complianceDocs.map((doc) => (
                        <DocRow
                          key={doc._id ?? doc.type}
                          doc={doc}
                          onView={() => setViewerDoc(doc)}
                        />
                      ))}
                    </ul>
                  </Section>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      No compliance documents on file. Edit the employee to upload required documents.
                    </p>
                  </div>
                )}

                {/* Other docs */}
                {otherDocs.length ? (
                  <Section title="Additional Documents">
                    <ul className="space-y-2">
                      {otherDocs.map((doc) => (
                        <DocRow
                          key={doc._id ?? doc.type}
                          doc={doc}
                          onView={() => setViewerDoc(doc)}
                        />
                      ))}
                    </ul>
                  </Section>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Employee not found.</p>
        )}
      </Modal>

      <DocumentViewer
        doc={viewerDoc}
        open={viewerDoc !== null}
        onOpenChange={(o) => {
          if (!o) setViewerDoc(null);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DocRow({ doc, onView }: { doc: EmployeeDocument; onView: () => void }) {
  const info = docExpiryInfo(doc);

  return (
    <li
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
        info?.color === "text-destructive" ? "border-destructive/30 bg-destructive/5" : "border-border"
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ")}
        </span>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {doc.issuanceDate ? (
            <span className="text-xs text-muted-foreground">
              Issued {new Date(doc.issuanceDate).toLocaleDateString()}
            </span>
          ) : null}
          {info ? (
            <span className={`flex items-center gap-1 text-xs ${info.color}`}>
              {info.icon ? <AlertTriangle className="h-3 w-3" /> : null}
              {info.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-1">
        {doc.fileUrl ? (
          <>
            <button
              onClick={onView}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="View document"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Download"
              onClick={() => downloadDoc(doc)}
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="text-xs italic text-muted-foreground/60">No file</span>
        )}
      </div>
    </li>
  );
}

async function downloadDoc(doc: EmployeeDocument) {
  if (!doc.fileUrl) return;
  const { getAccessToken } = await import("@/lib/api/token");
  const token = getAccessToken();
  const res = await fetch(doc.fileUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const ext = doc.fileUrl.split(".").pop()?.split("?")[0] ?? "";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.type}${ext ? `.${ext}` : ""}`;
  a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-foreground">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="capitalize">{value}</span>
    </p>
  );
}
