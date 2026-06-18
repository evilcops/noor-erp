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
import type { Employee, EmployeeDocument, FamilyMember } from "@/types/employee";

const COMPLIANCE_TYPES = new Set([
  "passport",
  "driving_license",
  "bataka",
  "mulkiya",
  "car_insurance",
]);

const DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  driving_license: "Driving License",
  bataka: "Bataka (Residency Permit / ID)",
  pataka: "Bataka (Residency Permit / ID)", // legacy alias
  mulkiya: "Mulkiya (Vehicle Registration)",
  car_insurance: "Car Insurance",
  visa: "Visa",
  labour_card: "Labour Card",
  id_card: "ID Card",
  contract: "Contract",
  certificate: "Certificate",
};

// Tighter thresholds (days) for bataka/car_insurance
const TIGHT_TYPES = new Set(["bataka", "car_insurance"]);

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
                ...((employee.familyType === "family" || (employee.familyMembers?.length ?? 0) > 0)
                  ? [{ id: "family", label: `Family (${employee.familyMembers?.length ?? 0})` }]
                  : []),
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
                  <Field
                    label="Employee Type"
                    value={employee.familyType === "family" ? `Family (${employee.familyMembers?.length ?? 0} member${(employee.familyMembers?.length ?? 0) !== 1 ? "s" : ""})` : "Individual"}
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

            {/* Family tab */}
            {tab === "family" ? (
              <FamilyMembersPanel
                members={employee.familyMembers ?? []}
                onView={(doc) => setViewerDoc(doc)}
              />
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

// ---------------------------------------------------------------------------
// FamilyMembersPanel — shown in the Family tab of EmployeeDetailsModal
// ---------------------------------------------------------------------------

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Spouse",
  son: "Son",
  daughter: "Daughter",
  parents: "Parents",
};

function FamilyMembersPanel({
  members,
  onView,
}: {
  members: FamilyMember[];
  onView: (doc: EmployeeDocument) => void;
}) {
  if (!members.length) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No family members recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {members.map((member, idx) => {
        const bataka = member.bataka;

        // Build a synthetic EmployeeDocument so DocumentViewer can open it
        const batakaDoc: EmployeeDocument | null = bataka
          ? {
              _id: member._id ? `${member._id}-bataka` : `fm-${idx}-bataka`,
              type: "bataka",
              fileUrl: bataka.fileUrl,
              issuanceDate: bataka.issueDate,
              expiryDate: bataka.expiryDate,
              status: bataka.status ?? "valid",
            }
          : null;

        const expiryDays =
          bataka?.expiryDate
            ? Math.ceil((new Date(bataka.expiryDate).getTime() - Date.now()) / 86400000)
            : null;

        const expiryColor =
          expiryDays === null
            ? "text-muted-foreground"
            : expiryDays < 0
            ? "text-destructive"
            : expiryDays <= 15
            ? "text-destructive"
            : expiryDays <= 45
            ? "text-warning"
            : "text-muted-foreground";

        const expiryLabel =
          expiryDays === null
            ? "—"
            : expiryDays < 0
            ? `Expired ${Math.abs(expiryDays)}d ago`
            : expiryDays === 0
            ? "Expires today"
            : `Expires in ${expiryDays}d (${new Date(bataka!.expiryDate!).toLocaleDateString()})`;

        return (
          <div
            key={member._id ?? idx}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <span className="text-sm font-semibold uppercase">
                  {member.name?.[0] ?? "?"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{member.name || `Member ${idx + 1}`}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {RELATIONSHIP_LABELS[member.relationship] ?? member.relationship}
                </p>
              </div>
              <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                Member {idx + 1}
              </span>
            </div>

            {/* Bataka document row */}
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Bataka (ID Card)</span>
                    {bataka ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          expiryDays !== null && expiryDays < 0
                            ? "bg-destructive/10 text-destructive"
                            : expiryDays !== null && expiryDays <= 45
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {expiryDays !== null && expiryDays < 0
                          ? "Expired"
                          : expiryDays !== null && expiryDays <= 45
                          ? "Expiring soon"
                          : "Valid"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        Issue Date
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {bataka?.issueDate
                          ? new Date(bataka.issueDate).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        Expiry Date
                      </span>
                      <p className={`text-xs ${expiryColor}`}>
                        {bataka?.expiryDate ? expiryLabel : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* File actions */}
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {batakaDoc?.fileUrl ? (
                    <>
                      <button
                        onClick={() => onView(batakaDoc)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="View Bataka document"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => downloadDoc(batakaDoc)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Download Bataka document"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs italic text-muted-foreground/60">
                      No file
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
