"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { effectiveBranchId } from "@/lib/branch-utils";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { customerApi, salesApi } from "@/lib/api/customers";
import { inventoryApi } from "@/lib/api/inventory";
import { deliveryApi } from "@/lib/api/deliveries";
import { normalizePhone } from "@/lib/phone";
import { SaleReceiptModal } from "@/components/features/orders/SaleReceiptModal";
import type { Customer, Sale } from "@/types/customer";
import type { StockLevel } from "@/types/inventory";

const NEW_CUSTOMER_VALUE = "__new__";

function refName(ref: string | { name?: string; sku?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function customerLabel(c: Customer) {
  const parts = [c.name, c.phone, c.email].filter(Boolean);
  return parts.join(" · ");
}

function formatWindow(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const emptySellForm = {
  customerPhone: "",
  customerEmail: "",
  customerName: "",
  customerAddress: "",
  customerArea: "",
  quantity: "",
  notes: "",
  earliestDelivery: "",
};

export function InventoryPage() {
  const { user } = useAuth();
  const { branches, activeMainBranchId, activeSubBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [mainBranchFilter, setMainBranchFilter] = useState(activeMainBranchId ?? "");
  const [subBranchFilter, setSubBranchFilter] = useState(activeSubBranchId ?? "");
  const branchFilter = effectiveBranchId(mainBranchFilter, subBranchFilter);
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [selected, setSelected] = useState<StockLevel | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [adjType, setAdjType] = useState<"adjustment" | "damaged" | "returned" | "manual_correction">("adjustment");
  const [sellForm, setSellForm] = useState(emptySellForm);
  const [customerSelection, setCustomerSelection] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [promiseWindows, setPromiseWindows] = useState<
    { start: string; end: string; label: string }[]
  >([]);
  const [selectedWindow, setSelectedWindow] = useState<{ start: string; end: string } | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";
  const isNewCustomer = customerSelection === NEW_CUSTOMER_VALUE;

  const { data, isLoading } = useQuery({
    queryKey: ["stock-levels", page, branchFilter],
    queryFn: () => inventoryApi.listStock({ page, limit: 20, branchId: branchFilter || undefined }),
    enabled: !!user,
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["customers", "sell-picker"],
    queryFn: () => customerApi.list({ page: 1, limit: 500 }),
    enabled: !!user && sellOpen,
  });

  const customers = customersData?.data ?? [];

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c._id === customerSelection),
    [customers, customerSelection]
  );

  const customerOptions = useMemo(
    () => [
      { value: NEW_CUSTOMER_VALUE, label: "+ Add new customer" },
      ...filteredCustomers.map((c) => ({ value: c._id, label: customerLabel(c) })),
    ],
    [filteredCustomers]
  );

  const adjustMut = useMutation({
    mutationFn: () =>
      inventoryApi.adjust({
        branchId: typeof selected!.branchId === "object" ? selected!.branchId._id : selected!.branchId,
        productId: typeof selected!.productId === "object" ? selected!.productId._id : selected!.productId,
        quantity: Number(qty),
        type: adjType,
        reason,
      }),
    onSuccess: () => {
      toast.success("Stock updated");
      setAdjustOpen(false);
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sellMut = useMutation({
    mutationFn: ({
      promise,
      selection,
      form,
    }: {
      promise?: { start: string; end: string };
      selection: string;
      form: typeof emptySellForm;
    }) => {
      const isNew = selection === NEW_CUSTOMER_VALUE;
      return salesApi.record({
        companyId,
        branchId: typeof selected!.branchId === "object" ? selected!.branchId._id : selected!.branchId,
        productId: typeof selected!.productId === "object" ? selected!.productId._id : selected!.productId,
        quantity: Number(form.quantity),
        ...(isNew
          ? {
              customerPhone: form.customerPhone.trim(),
              customerEmail: form.customerEmail.trim() || undefined,
              customerName: form.customerName.trim() || undefined,
              customerAddress: form.customerAddress.trim() || undefined,
              customerArea: form.customerArea.trim() || undefined,
            }
          : { customerId: selection }),
        notes: form.notes.trim() || undefined,
        promisedWindowStart: promise?.start,
        promisedWindowEnd: promise?.end,
      });
    },
    onSuccess: (sale: Sale) => {
      const customer =
        typeof sale.customerId === "object"
          ? sale.customerId
          : null;
      if (sale.riderAssigned && sale.riderCode) {
        toast.success(
          `Sale recorded — rider ${sale.riderCode} assigned automatically for delivery`
        );
      } else if (sale.customerCreated === false && customer) {
        toast.success(
          `Sale recorded — linked to existing customer (${customer.name || customer.phone}). Delivery queued — no rider available yet.`
        );
      } else {
        toast.success("Sale recorded — delivery queued (assign rider from Deliveries if needed)");
      }
      setSellOpen(false);
      setPromiseOpen(false);
      resetSellForm();
      setSelectedWindow(null);
      setCompletedSale(sale);
      setReceiptOpen(true);
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promiseMut = useMutation({
    mutationFn: async () => {
      const branchId = typeof selected!.branchId === "object" ? selected!.branchId._id : selected!.branchId;
      const qty = Number(sellForm.quantity);
      return deliveryApi.predictPromise({
        companyId,
        branchId,
        totalAmount: qty,
        quantity: qty,
        earliestAcceptableAt: sellForm.earliestDelivery
          ? new Date(sellForm.earliestDelivery).toISOString()
          : undefined,
      });
    },
    onSuccess: (prediction) => {
      const primary = {
        start: prediction.promisedWindowStart,
        end: prediction.promisedWindowEnd,
        label: "Earliest available",
      };
      const alternatives = (prediction.alternativeWindows ?? []).map((w, i) => ({
        start: w.start,
        end: w.end,
        label: `Alternative ${i + 1}`,
      }));
      const windows = [primary, ...alternatives];
      setPromiseWindows(windows);
      setSelectedWindow({ start: primary.start, end: primary.end });
      setPromiseOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetSellForm = () => {
    setSellForm(emptySellForm);
    setCustomerSelection("");
    setCustomerSearch("");
  };

  const openSell = (row: StockLevel) => {
    setSelected(row);
    resetSellForm();
    setSellOpen(true);
  };

  const handleCustomerChange = (value: string) => {
    setCustomerSelection(value);
    if (value === NEW_CUSTOMER_VALUE) {
      setSellForm((prev) => ({
        ...prev,
        customerPhone: "",
        customerEmail: "",
        customerName: "",
        customerAddress: "",
        customerArea: "",
      }));
    }
  };

  const canCompleteSale =
    !!sellForm.quantity &&
    Number(sellForm.quantity) >= 1 &&
    (!selected || Number(sellForm.quantity) <= selected.currentStock) &&
    (isNewCustomer
      ? normalizePhone(sellForm.customerPhone).length > 0
      : !!customerSelection && customerSelection !== NEW_CUSTOMER_VALUE);

  const columns: Column<StockLevel>[] = [
    { key: "product", header: "Product", cell: (r) => refName(r.productId) },
    { key: "sku", header: "SKU", cell: (r) => (typeof r.productId === "object" ? r.productId.sku : "—") },
    { key: "branch", header: "Branch", cell: (r) => refName(r.branchId) },
    { key: "current", header: "Current", cell: (r) => <span className="font-semibold">{r.currentStock}</span> },
    { key: "damaged", header: "Damaged", cell: (r) => r.damagedStock },
    { key: "returned", header: "Returned", cell: (r) => r.returnedStock },
    {
      key: "status",
      header: "Alert",
      cell: (r) => {
        const reorder = r.reorderLevel ?? 0;
        if (r.currentStock <= 0) return <StatusBadge status="out_of_stock" />;
        if (reorder > 0 && r.currentStock <= reorder) return <StatusBadge status="warning" />;
        return <StatusBadge status="active" />;
      },
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          {can("customer:create") ? (
            <Button variant="secondary" onClick={() => openSell(r)} disabled={r.currentStock <= 0}>
              Sell
            </Button>
          ) : null}
          {isSuperAdmin ? (
            <Button variant="secondary" onClick={() => { setSelected(r); setQty(""); setReason(""); setAdjustOpen(true); }}>
              Adjust
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Branch Inventory" description="Branch-wise stock levels, damaged and returned quantities" />
      <BranchSubBranchSelect
        branches={branches}
        mainBranchId={mainBranchFilter}
        subBranchId={subBranchFilter}
        onMainBranchChange={(id) => {
          setMainBranchFilter(id);
          setSubBranchFilter("");
        }}
        onSubBranchChange={setSubBranchFilter}
        allowAllMain
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} />

      <Modal
        open={sellOpen}
        onOpenChange={(open) => {
          setSellOpen(open);
          if (!open) resetSellForm();
        }}
        title="Record Sale"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {selected ? refName(selected.productId) : ""}
            {selected ? ` · Available: ${selected.currentStock}` : ""}
          </p>

          <div>
            <Label>Customer *</Label>
            {/* <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customers by name, phone, or email..."
              className="mb-2"
            /> */}
            <Select
              value={customerSelection}
              onChange={(e) => handleCustomerChange(e.target.value)}
              placeholder={customersLoading ? "Loading customers..." : "Select customer"}
              options={customerOptions}
              disabled={customersLoading}
            />
          </div>

          {selectedCustomer && !isNewCustomer ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedCustomer.name || "Unnamed customer"}</p>
              <p className="text-muted-foreground">Phone: {selectedCustomer.phone}</p>
              {selectedCustomer.email ? <p className="text-muted-foreground">Email: {selectedCustomer.email}</p> : null}
            </div>
          ) : null}

          {isNewCustomer ? (
            <>
              <div><Label>Phone *</Label><Input value={sellForm.customerPhone} onChange={(e) => setSellForm({ ...sellForm, customerPhone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={sellForm.customerEmail} onChange={(e) => setSellForm({ ...sellForm, customerEmail: e.target.value })} /></div>
              <div><Label>Name</Label><Input value={sellForm.customerName} onChange={(e) => setSellForm({ ...sellForm, customerName: e.target.value })} /></div>
              <div><Label>Delivery address</Label><Input value={sellForm.customerAddress} onChange={(e) => setSellForm({ ...sellForm, customerAddress: e.target.value })} placeholder="Street, building, area" /></div>
              <div><Label>Area / zone</Label><Input value={sellForm.customerArea} onChange={(e) => setSellForm({ ...sellForm, customerArea: e.target.value })} placeholder="e.g. Al Khuwair, Ruwi" /></div>
            </>
          ) : null}

          <div><Label>Quantity *</Label><Input type="number" min={1} max={selected?.currentStock ?? undefined} value={sellForm.quantity} onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })} /></div>
          <div>
            <Label>Earliest delivery (optional)</Label>
            <Input
              type="datetime-local"
              value={sellForm.earliestDelivery}
              onChange={(e) => setSellForm({ ...sellForm, earliestDelivery: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If the customer cannot receive before a certain time, set it here (e.g. after 2:00 PM).
            </p>
          </div>
          <div><Label>Notes</Label><Input value={sellForm.notes} onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSellOpen(false)}>Cancel</Button>
          <Button
            disabled={!canCompleteSale || promiseMut.isPending || sellMut.isPending}
            onClick={() => promiseMut.mutate()}
          >
            Check Delivery Window
          </Button>
        </div>
      </Modal>

      <Modal
        open={promiseOpen}
        onOpenChange={setPromiseOpen}
        title="45-Minute Delivery Promise"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select an achievable delivery window. Once confirmed, this becomes the customer&apos;s delivery promise.
          </p>
          <div className="space-y-2">
            {promiseWindows.map((w) => (
              <label
                key={w.start}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  selectedWindow?.start === w.start ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="delivery-window"
                  checked={selectedWindow?.start === w.start}
                  onChange={() => setSelectedWindow({ start: w.start, end: w.end })}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-sm">{w.label}</p>
                  <p className="text-sm text-muted-foreground">{formatWindow(w.start, w.end)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPromiseOpen(false)}>Back</Button>
          <Button
            disabled={!selectedWindow || sellMut.isPending}
            onClick={() => selectedWindow && sellMut.mutate({
              promise: selectedWindow,
              selection: customerSelection,
              form: sellForm,
            })}
          >
            Confirm Sale &amp; Promise
          </Button>
        </div>
      </Modal>

      <Modal open={adjustOpen} onOpenChange={setAdjustOpen} title="Stock Adjustment">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{selected ? refName(selected.productId) : ""}</p>
          <div><Label>Type</Label>
            <Select
              value={adjType}
              onChange={(e) => setAdjType(e.target.value as typeof adjType)}
              options={[
                { value: "adjustment", label: "Adjustment" },
                { value: "damaged", label: "Damaged" },
                { value: "returned", label: "Returned" },
                { value: "manual_correction", label: "Manual Correction" },
              ]}
            />
          </div>
          <div><Label>Quantity (+/-)</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><Label>Reason *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button disabled={!reason || !qty || adjustMut.isPending} onClick={() => adjustMut.mutate()}>Apply</Button>
        </div>
      </Modal>

      <SaleReceiptModal
        sale={completedSale}
        open={receiptOpen}
        onOpenChange={(open) => {
          setReceiptOpen(open);
          if (!open) setCompletedSale(null);
        }}
      />
    </div>
  );
}
