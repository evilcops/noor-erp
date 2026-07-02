"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { performanceApi, type PerformanceReview } from "@/lib/api/performance";
import { formatDate } from "@/lib/date";
import { getEmployeeLabel, safeArray } from "@/lib/format";

function toReviewForm(review: PerformanceReview) {
  return {
    rating: review.rating ?? 3,
    strengths: safeArray(review.strengths).join("\n"),
    improvements: safeArray(review.improvements).join("\n"),
    managerComments: review.managerComments ?? "",
    employeeComments: review.employeeComments ?? "",
  };
}

export function PerformancePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { can, isHrOrAbove } = usePermissions();
  const qc = useQueryClient();

  const [tab, setTab] = useState("my");
  const [tabReady, setTabReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PerformanceReview | null>(null);
  const [form, setForm] = useState({ employeeId: "", reviewCycle: "", dueDate: "" });
  const [reviewForm, setReviewForm] = useState({
    rating: 3,
    strengths: "",
    improvements: "",
    managerComments: "",
    employeeComments: "",
  });

  const showPendingTab = can("performance:edit");

  const tabs = useMemo(
    () => [
      ...(isHrOrAbove ? [{ id: "all", label: "All Reviews" }] : []),
      { id: "my", label: "My Reviews" },
      ...(showPendingTab ? [{ id: "pending", label: "To Complete" }] : []),
    ],
    [isHrOrAbove, showPendingTab]
  );

  useEffect(() => {
    if (!authLoading && user && !tabReady) {
      setTab(isHrOrAbove ? "all" : "my");
      setTabReady(true);
    }
  }, [authLoading, user, isHrOrAbove, tabReady]);

  const queryReady = !authLoading && !!user;

  const { data: myReviews, isLoading: myLoading, isError: myError, refetch: refetchMy } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => performanceApi.getMyReviews(),
    enabled: queryReady && tab === "my",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: allReviews, isLoading: allLoading, isError: allError, refetch: refetchAll } = useQuery({
    queryKey: ["all-reviews"],
    queryFn: () => performanceApi.list({ limit: 50 }),
    enabled: queryReady && tab === "all" && isHrOrAbove,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: pendingReviews, isLoading: pendingLoading, isError: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ["pending-reviews"],
    queryFn: () => performanceApi.list({ status: "pending_manager", limit: 50 }),
    enabled: queryReady && tab === "pending" && showPendingTab,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createMut = useMutation({
    mutationFn: () => performanceApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-reviews"] });
      qc.invalidateQueries({ queryKey: ["pending-reviews"] });
      toast.success("Review created");
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => performanceApi.update(selected!._id, {
      rating: reviewForm.rating,
      strengths: reviewForm.strengths.split("\n").filter(Boolean),
      improvements: reviewForm.improvements.split("\n").filter(Boolean),
      managerComments: reviewForm.managerComments,
      employeeComments: reviewForm.employeeComments,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      qc.invalidateQueries({ queryKey: ["all-reviews"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: () => performanceApi.complete(selected!._id, {
      rating: reviewForm.rating,
      managerComments: reviewForm.managerComments,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-reviews"] });
      qc.invalidateQueries({ queryKey: ["all-reviews"] });
      toast.success("Review completed");
      setDetailOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openReview(review: PerformanceReview) {
    setSelected(review);
    setReviewForm(toReviewForm(review));
    setDetailOpen(true);
  }

  const columns: Column<PerformanceReview>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => getEmployeeLabel(r.employeeId),
    },
    { key: "cycle", header: "Cycle", cell: (r) => r.reviewCycle ?? "—" },
    { key: "rating", header: "Rating", cell: (r) => (r.rating ? `${r.rating}/5` : "—") },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "date",
      header: "Updated",
      cell: (r) => (r.updatedAt ? formatDate(r.updatedAt) : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button variant="ghost" onClick={() => openReview(r)}>View</Button>
      ),
    },
  ];

  const list =
    tab === "my"
      ? safeArray(myReviews)
      : tab === "pending"
        ? safeArray(pendingReviews?.data)
        : safeArray(allReviews?.data);

  const loading =
    authLoading ||
    (tab === "my" ? myLoading : tab === "pending" ? pendingLoading : allLoading);

  const isError = tab === "my" ? myError : tab === "pending" ? pendingError : allError;
  const refetch = tab === "my" ? refetchMy : tab === "pending" ? refetchPending : refetchAll;

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        description="Conduct reviews, set goals, and track employee development."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Performance" }]}
        actions={can("performance:create") ? (
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Start Review</Button>
        ) : undefined}
      />

      {isError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Could not load performance reviews. Ensure the backend is running.
          <Button variant="ghost" onClick={() => refetch()} className="ml-2">Retry</Button>
        </div>
      ) : null}

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} className="mb-6" />

      <DataTable
        columns={columns}
        data={list}
        loading={loading}
        onRowClick={openReview}
        emptyTitle={
          tab === "my"
            ? "No reviews assigned to you"
            : tab === "pending"
              ? "No reviews waiting for completion"
              : "No performance reviews yet"
        }
      />

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="Start Review" footer={
        <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>Create</Button>
      }>
        <div className="space-y-4">
          <div><Label>Employee ID *</Label><Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} placeholder="Employee record ID" /></div>
          <div><Label>Review Cycle *</Label><Input value={form.reviewCycle} onChange={(e) => setForm({ ...form, reviewCycle: e.target.value })} placeholder="Q1 2026" /></div>
          <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title="Review Details" size="xl" footer={
        <>
          <Button variant="secondary" loading={updateMut.isPending} onClick={() => updateMut.mutate()}>Save Draft</Button>
          {can("performance:approve") && selected?.status === "pending_manager" ? (
            <Button loading={completeMut.isPending} onClick={() => completeMut.mutate()}>Complete Review</Button>
          ) : null}
        </>
      }>
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">{getEmployeeLabel(selected.employeeId)}</p>
              <p className="text-muted-foreground">{selected.reviewCycle} · <StatusBadge status={selected.status} /></p>
            </div>
            <div>
              <Label>Overall Rating (1-5)</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: n })}>
                    <Star className={`h-6 w-6 ${n <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Strengths</Label><textarea value={reviewForm.strengths} onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="One per line" /></div>
            <div><Label>Areas for Improvement</Label><textarea value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
            <div><Label>Manager Comments</Label><textarea value={reviewForm.managerComments} onChange={(e) => setReviewForm({ ...reviewForm, managerComments: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
            <div><Label>Employee Response</Label><textarea value={reviewForm.employeeComments} onChange={(e) => setReviewForm({ ...reviewForm, employeeComments: e.target.value })} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
            {safeArray(selected.goals).length ? (
              <div>
                <Label>Goals</Label>
                <ul className="mt-2 space-y-1 text-sm">
                  {safeArray(selected.goals).map((g, i) => (
                    <li key={i} className="flex justify-between rounded border border-border px-3 py-2">
                      <span>{g.description}</span>
                      <StatusBadge status={g.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
