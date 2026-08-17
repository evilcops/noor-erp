"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
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

type CartLine = {
  key: string;
  productId: string;
  branchId: string;
  name: string;
  sku: string;
  available: number;
  quantity: number;
};

function refName(ref: string | { name?: string; sku?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function stockIds(row: StockLevel) {
  const productId = typeof row.productId === "object" ? row.productId._id : row.productId;
  const branchId = typeof row.branchId === "object" ? row.branchId._id : row.branchId;
  const name = typeof row.productId === "object" ? row.productId.name : "Product";
  const sku = typeof row.productId === "object" ? row.productId.sku : "—";
  return { productId, branchId, name, sku };
}

function toCartLine(row: StockLevel, quantity = 1): CartLine {
  const { productId, branchId, name, sku } = stockIds(row);
  return {
    key: row._id,
    productId,
    branchId,
    name,
    sku,
    available: row.currentStock,
    quantity: Math.min(Math.max(1, quantity), row.currentStock),
  };
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

const emptyCustomerForm = {
  customerPhone: "",
  customerEmail: "",
  customerName: "",
  customerAddress: "",
  customerArea: "",
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [customerSelection, setCustomerSelection] = useState("");
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [promiseWindows, setPromiseWindows] = useState<
    { start: string; end: string; label: string }[]
  >([]);
  const [selectedWindow, setSelectedWindow] = useState<{ start: string; end: string } | null>(null);
  const [promiseTiming, setPromiseTiming] = useState<{
    preparationMinutes: number;
    warehouseReadyAt: string;
    travelTimeMinutes: number;
    estimatedDeliveryAt: string;
  } | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";
  const isNewCustomer = customerSelection === NEW_CUSTOMER_VALUE;
  const cartBranchId = cart[0]?.branchId ?? "";
  const cartTotalQty = cart.reduce((sum, line) => sum + line.quantity, 0);

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

  const { data: cartStockData } = useQuery({
    queryKey: ["stock-levels", "cart-picker", cartBranchId],
    queryFn: () => inventoryApi.listStock({ page: 1, limit: 200, branchId: cartBranchId }),
    enabled: !!user && sellOpen && !!cartBranchId,
  });

  const customers = customersData?.data ?? [];
  const cartStock = (cartStockData?.data ?? []).filter((row) => row.currentStock > 0);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c._id === customerSelection),
    [customers, customerSelection]
  );

  const customerOptions = useMemo(
    () => [
      { value: NEW_CUSTOMER_VALUE, label: "+ Add new customer" },
      ...customers.map((c) => ({ value: c._id, label: customerLabel(c) })),
    ],
    [customers]
  );

  const addProductOptions = useMemo(() => {
    const inCart = new Set(cart.map((line) => line.productId));
    return cartStock
      .filter((row) => !inCart.has(stockIds(row).productId))
      .map((row) => {
        const { productId, name, sku } = stockIds(row);
        return {
          value: productId,
          label: `${name} (${sku}) · ${row.currentStock} avail`,
        };
      });
  }, [cart, cartStock]);

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
      lines,
    }: {
      promise?: { start: string; end: string };
      selection: string;
      form: typeof emptyCustomerForm;
      lines: CartLine[];
    }) => {
      const isNew = selection === NEW_CUSTOMER_VALUE;
      return salesApi.record({
        companyId,
        branchId: lines[0].branchId,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
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
      const customer = typeof sale.customerId === "object" ? sale.customerId : null;
      if (sale.riderAssigned && sale.riderCode) {
        toast.success(
          `Sale recorded — rider ${sale.riderCode} assigned automatically for one delivery`
        );
      } else if (sale.customerCreated === false && customer) {
        toast.success(
          `Sale recorded — linked to existing customer (${customer.name || customer.phone}). Delivery queued — no rider available yet.`
        );
      } else {
        toast.success("Sale recorded — one delivery queued (assign rider from Deliveries if needed)");
      }
      setSellOpen(false);
      setPromiseOpen(false);
      resetSellForm();
      setSelectedWindow(null);
      setPromiseTiming(null);
      setCompletedSale(sale);
      setReceiptOpen(true);
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promiseMut = useMutation({
    mutationFn: async () => {
      const branchId = cart[0]?.branchId;
      if (!branchId || cart.length === 0) throw new Error("Cart is empty");

      let coordinates: { lat: number; lng: number } | undefined;
      if (!isNewCustomer && customerSelection) {
        const customer = customers.find((c) => c._id === customerSelection);
        if (customer?.coordinates?.lat != null && customer?.coordinates?.lng != null) {
          coordinates = { lat: customer.coordinates.lat, lng: customer.coordinates.lng };
        }
      }

      return deliveryApi.predictPromise({
        companyId,
        branchId,
        coordinates,
        totalAmount: cartTotalQty,
        quantity: cartTotalQty,
        earliestAcceptableAt: customerForm.earliestDelivery
          ? new Date(customerForm.earliestDelivery).toISOString()
          : undefined,
      });
    },
    onSuccess: (prediction) => {
      setPromiseTiming({
        preparationMinutes: prediction.preparationMinutes,
        warehouseReadyAt: prediction.warehouseReadyAt,
        travelTimeMinutes: prediction.travelTimeMinutes,
        estimatedDeliveryAt: prediction.estimatedDeliveryAt,
      });
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
    setCart([]);
    setAddProductId("");
    setCustomerForm(emptyCustomerForm);
    setCustomerSelection("");
  };

  const openSell = (row: StockLevel) => {
    setCart([toCartLine(row, 1)]);
    setAddProductId("");
    setCustomerForm(emptyCustomerForm);
    setCustomerSelection("");
    setSellOpen(true);
  };

  const updateCartQty = (key: string, nextQty: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.key !== key) return line;
          const quantity = Math.min(Math.max(1, nextQty), line.available);
          return { ...line, quantity };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const removeCartLine = (key: string) => {
    setCart((prev) => prev.filter((line) => line.key !== key));
  };

  const addProductToCart = (productId: string) => {
    if (!productId) return;
    const row = cartStock.find((item) => stockIds(item).productId === productId);
    if (!row) return;
    const line = toCartLine(row, 1);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === line.productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === line.productId
            ? { ...item, quantity: Math.min(item.available, item.quantity + 1) }
            : item
        );
      }
      return [...prev, line];
    });
    setAddProductId("");
  };

  const handleCustomerChange = (value: string) => {
    setCustomerSelection(value);
    if (value === NEW_CUSTOMER_VALUE) {
      setCustomerForm((prev) => ({
        ...prev,
        customerPhone: "",
        customerEmail: "",
        customerName: "",
        customerAddress: "",
        customerArea: "",
      }));
    }
  };

  const cartValid =
    cart.length > 0 &&
    cart.every((line) => line.quantity >= 1 && line.quantity <= line.available) &&
    cart.every((line) => line.branchId === cart[0].branchId);

  const canCompleteSale =
    cartValid &&
    (isNewCustomer
      ? normalizePhone(customerForm.customerPhone).length > 0
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
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(r);
                setQty("");
                setReason("");
                setAdjustOpen(true);
              }}
            >
              Adjust
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Inventory"
        description="Branch-wise stock levels, damaged and returned quantities"
      />
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
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <Modal
        open={sellOpen}
        onOpenChange={(open) => {
          setSellOpen(open);
          if (!open) resetSellForm();
        }}
        title="Sale cart"
        description="Add multiple products for one customer — sold together as a single delivery"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Cart ({cart.length} products)</p>
              </div>
              <p className="text-xs text-muted-foreground">{cartTotalQty} units total</p>
            </div>

            {cart.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((line) => (
                  <div key={line.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.sku} · Available {line.available}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => updateCartQty(line.key, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={line.available}
                        value={line.quantity}
                        onChange={(e) => updateCartQty(line.key, Number(e.target.value) || 1)}
                        className="w-16 text-center"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => updateCartQty(line.key, line.quantity + 1)}
                        disabled={line.quantity >= line.available}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Remove"
                      onClick={() => removeCartLine(line.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 ? (
              <div className="border-t border-border px-4 py-3">
                <Label>Add another product</Label>
                <div className="mt-1 flex gap-2">
                  <Select
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    options={addProductOptions}
                    placeholder={
                      addProductOptions.length ? "Select product from same branch" : "No more products available"
                    }
                    disabled={!addProductOptions.length}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!addProductId}
                    onClick={() => addProductToCart(addProductId)}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <Label>Customer *</Label>
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
              {selectedCustomer.email ? (
                <p className="text-muted-foreground">Email: {selectedCustomer.email}</p>
              ) : null}
              {selectedCustomer.address ? (
                <p className="text-muted-foreground">Address: {selectedCustomer.address}</p>
              ) : null}
            </div>
          ) : null}

          {isNewCustomer ? (
            <>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={customerForm.customerPhone}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerForm.customerEmail}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                />
              </div>
              <div>
                <Label>Delivery address</Label>
                <Input
                  value={customerForm.customerAddress}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerAddress: e.target.value })}
                  placeholder="Street, building, area"
                />
              </div>
              <div>
                <Label>Area / zone</Label>
                <Input
                  value={customerForm.customerArea}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerArea: e.target.value })}
                  placeholder="e.g. Al Khuwair, Ruwi"
                />
              </div>
            </>
          ) : null}

          <div>
            <Label>Earliest delivery (optional)</Label>
            <Input
              type="datetime-local"
              value={customerForm.earliestDelivery}
              onChange={(e) => setCustomerForm({ ...customerForm, earliestDelivery: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If the customer cannot receive before a certain time, set it here.
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={customerForm.notes}
              onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSellOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canCompleteSale || promiseMut.isPending || sellMut.isPending}
            onClick={() => promiseMut.mutate()}
          >
            Check Delivery Window
          </Button>
        </div>
      </Modal>

      <Modal open={promiseOpen} onOpenChange={setPromiseOpen} title="45-Minute Delivery Promise">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All cart items will be sold together and assigned as one delivery. Select an achievable window.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {cart.length} product{cart.length === 1 ? "" : "s"} · {cartTotalQty} unit
              {cartTotalQty === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {cart.map((line) => (
                <li key={line.key}>
                  {line.name} × {line.quantity}
                </li>
              ))}
            </ul>
          </div>
          {promiseTiming ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">How we calculate this</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  Packing &amp; loading:{" "}
                  <span className="text-foreground">{promiseTiming.preparationMinutes} min</span>
                </li>
                <li>
                  Ready for dispatch:{" "}
                  <span className="text-foreground">
                    {new Date(promiseTiming.warehouseReadyAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
                {promiseTiming.travelTimeMinutes > 0 ? (
                  <li>
                    Travel to customer:{" "}
                    <span className="text-foreground">~{promiseTiming.travelTimeMinutes} min</span>
                  </li>
                ) : null}
                <li>
                  Estimated arrival:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(promiseTiming.estimatedDeliveryAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
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
          <Button variant="secondary" onClick={() => setPromiseOpen(false)}>
            Back
          </Button>
          <Button
            disabled={!selectedWindow || sellMut.isPending || cart.length === 0}
            onClick={() =>
              selectedWindow &&
              sellMut.mutate({
                promise: selectedWindow,
                selection: customerSelection,
                form: customerForm,
                lines: cart,
              })
            }
          >
            Confirm Sale &amp; Promise
          </Button>
        </div>
      </Modal>

      <Modal open={adjustOpen} onOpenChange={setAdjustOpen} title="Stock Adjustment">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{selected ? refName(selected.productId) : ""}</p>
          <div>
            <Label>Type</Label>
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
          <div>
            <Label>Quantity (+/-)</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdjustOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!reason || !qty || adjustMut.isPending} onClick={() => adjustMut.mutate()}>
            Apply
          </Button>
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
