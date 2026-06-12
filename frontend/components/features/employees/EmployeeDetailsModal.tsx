"use client";

import { AlertTriangle, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useEmployee } from "@/hooks/useEmployees";
import type { Employee, EmployeeDocument } from "@/types/employee";

function docExpiryWarning(doc: EmployeeDocument) {
  if (!doc.expiryDate) return null;
  const expiry = new Date(doc.expiryDate);
  const now = new Date();
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { color: "text-destructive", label: "Expired" };
  if (days <= 30) return { color: "text-warning", label: `Expires in ${days} days` };
  return { color: "text-muted-foreground", label: expiry.toLocaleDateString() };
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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
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
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">
                {employee.firstName} {employee.lastName}
              </h3>
              <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
            </div>
            <StatusBadge status={employee.status} />
          </div>

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
              <Field label="Type" value={employee.employmentType.replace(/_/g, " ")} />
              <Field label="Joined" value={employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : undefined} />
            </Section>
            {employee.emergencyContact ? (
              <Section title="Emergency Contact">
                <Field label="Name" value={employee.emergencyContact.name} />
                <Field label="Relationship" value={employee.emergencyContact.relationship} />
                <Field label="Phone" value={employee.emergencyContact.phone} />
              </Section>
            ) : null}
            {employee.notes ? (
              <Section title="Notes">
                <p className="text-sm text-muted-foreground">{employee.notes}</p>
              </Section>
            ) : null}
          </div>

          {employee.documents?.length ? (
            <Section title="Documents">
              <ul className="space-y-2">
                {employee.documents.map((doc) => {
                  const warn = docExpiryWarning(doc);
                  return (
                    <li
                      key={doc._id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium capitalize">
                          {doc.type.replace(/_/g, " ")}
                        </span>
                        {warn ? (
                          <p className={`text-xs ${warn.color} flex items-center gap-1`}>
                            {warn.label.includes("Expir") ? <AlertTriangle className="h-3 w-3" /> : null}
                            {warn.label}
                          </p>
                        ) : null}
                      </div>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          <Download className="h-4 w-4" />
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          <Section title="Activity">
            <div className="space-y-2 border-l-2 border-border pl-4">
              <p className="text-sm">
                Created {new Date(employee.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Last updated {new Date(employee.updatedAt).toLocaleString()}
              </p>
            </div>
          </Section>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Employee not found.</p>
      )}
    </Modal>
  );
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
