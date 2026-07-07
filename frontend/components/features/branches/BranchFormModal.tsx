"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks";
import { companyApi } from "@/lib/api/companies";
import { branchApi } from "@/lib/api/branches";
import { geocodeAddress } from "@/lib/geocoding-client";
import type { Branch, CreateBranchInput, UpdateBranchInput } from "@/types/branch";

const MapLocationPicker = dynamic(
  () => import("@/components/common/MapLocationPicker").then((m) => m.MapLocationPicker),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full rounded-lg" />,
  }
);

export interface BranchFormValues {
  companyId: string;
  parentBranchId: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  lat: string;
  lng: string;
  allowedRadius: string;
  deliveryRadiusKm: string;
  deliveryClusterCount: string;
  status: "active" | "inactive";
}

const EMPTY: BranchFormValues = {
  companyId: "",
  parentBranchId: "",
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  lat: "",
  lng: "",
  allowedRadius: "100",
  deliveryRadiusKm: "10",
  deliveryClusterCount: "5",
  status: "active",
};

interface BranchFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  /** Pre-select parent when adding a sub-branch */
  defaultParentBranchId?: string;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  loading?: boolean;
}

export function BranchFormModal({
  open,
  onOpenChange,
  branch,
  defaultParentBranchId,
  onSubmit,
  loading,
}: BranchFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<BranchFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof BranchFormValues, string>>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [mapFocusKey, setMapFocusKey] = useState(0);

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.getAll(),
    enabled: open && !user?.companyId,
  });

  const companyIdForQuery = branch?.companyId ?? user?.companyId ?? form.companyId;

  const { data: mainBranchesData } = useQuery({
    queryKey: ["branches", "main", companyIdForQuery],
    queryFn: () =>
      branchApi.getAll({
        companyId: companyIdForQuery || undefined,
        type: "main",
        limit: 200,
      }),
    enabled: open && !!companyIdForQuery,
  });

  const mainBranches = mainBranchesData?.data ?? [];

  useEffect(() => {
    if (branch) {
      const parentId =
        typeof branch.parentBranchId === "object"
          ? branch.parentBranchId?._id ?? ""
          : branch.parentBranchId ?? "";
      setForm({
        companyId: branch.companyId,
        parentBranchId: parentId,
        name: branch.name,
        code: branch.code,
        address: branch.address ?? "",
        phone: branch.phone ?? "",
        email: branch.email ?? "",
        lat: branch.gpsCoordinates?.lat?.toString() ?? "",
        lng: branch.gpsCoordinates?.lng?.toString() ?? "",
        allowedRadius: String(branch.allowedRadius ?? 100),
        deliveryRadiusKm: String(branch.deliveryRadiusKm ?? 10),
        deliveryClusterCount: String(branch.deliveryClusterCount ?? 5),
        status: branch.status,
      });
    } else {
      setForm({
        ...EMPTY,
        companyId: user?.companyId ?? "",
        parentBranchId: defaultParentBranchId ?? "",
        allowedRadius: "100",
      });
    }
    setErrors({});
  }, [branch, open, user?.companyId, defaultParentBranchId]);

  function update<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function setLocation(lat: number, lng: number) {
    setForm((prev) => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));
    setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));
  }

  async function findAddressOnMap() {
    if (!form.address.trim()) {
      toast.error("Enter an address first");
      return;
    }
    setGeocoding(true);
    try {
      const coords = await geocodeAddress(form.address);
      if (!coords) {
        toast.error("Could not find that address on the map");
        return;
      }
      setLocation(coords.lat, coords.lng);
      setMapFocusKey((k) => k + 1);
      toast.success("Location pinned from address");
    } catch {
      toast.error("Geocoding failed — try clicking the map instead");
    } finally {
      setGeocoding(false);
    }
  }

  const parsedLat = form.lat ? Number(form.lat) : null;
  const parsedLng = form.lng ? Number(form.lng) : null;
  const radiusMeters = form.allowedRadius ? Number(form.allowedRadius) : undefined;

  async function handleSubmit() {
    const next: Partial<Record<keyof BranchFormValues, string>> = {};
    if (!form.companyId) next.companyId = "Company is required";
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.code.trim()) next.code = "Code is required";
    if (form.code.length < 2) next.code = "Code must be at least 2 characters";
    if (form.parentBranchId && !mainBranches.some((b) => b._id === form.parentBranchId)) {
      next.parentBranchId = "Select a valid parent branch";
    }
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

  const isSubBranch = !!form.parentBranchId;
  const isSubBranchCreate = !branch && !!defaultParentBranchId;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        branch
          ? branch.parentBranchId
            ? "Edit Sub-Branch"
            : "Edit Branch"
          : isSubBranchCreate || isSubBranch
            ? "Add Sub-Branch"
            : "Add Branch"
      }
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

        {!branch && !defaultParentBranchId ? (
          <div className="sm:col-span-2">
            <Label>Branch type</Label>
            <Select
              value={form.parentBranchId ? "sub" : "main"}
              onChange={(e) => {
                if (e.target.value === "main") update("parentBranchId", "");
                else if (mainBranches.length) update("parentBranchId", mainBranches[0]._id);
              }}
              options={[
                { value: "main", label: "Main branch" },
                { value: "sub", label: "Sub-branch (under a main branch)" },
              ]}
            />
          </div>
        ) : null}

        {form.parentBranchId ? (
          <div className="sm:col-span-2">
            <Label>Parent branch *</Label>
            <Select
              value={form.parentBranchId}
              onChange={(e) => update("parentBranchId", e.target.value)}
              disabled={!!branch || !!defaultParentBranchId}
              placeholder="Select main branch"
              options={mainBranches.map((b) => ({
                value: b._id,
                label: `${b.name} (${b.code})`,
              }))}
            />
            {!branch ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Sub-branches can have their own warehouse location, stock, and attendance zone.
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label>{isSubBranch ? "Sub-branch name" : "Branch name"} *</Label>
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
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <Label>Address</Label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void findAddressOnMap()}
              disabled={geocoding || !form.address.trim()}
              loading={geocoding}
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Find on map
            </Button>
          </div>
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
        <div className="sm:col-span-2">
          <Label>Warehouse location</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Click the map to pin the warehouse, or drag the marker. Used for dispatch routes and attendance geofence.
          </p>
          <MapLocationPicker
            lat={parsedLat}
            lng={parsedLng}
            onChange={setLocation}
            radiusMeters={radiusMeters}
            focusKey={mapFocusKey}
          />
        </div>
        <div>
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={form.lat}
            onChange={(e) => update("lat", e.target.value)}
            placeholder="23.5880"
          />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input
            type="number"
            step="any"
            value={form.lng}
            onChange={(e) => update("lng", e.target.value)}
            placeholder="58.3829"
          />
        </div>
        <div>
          <Label>Attendance radius (m)</Label>
          <Input type="number" value={form.allowedRadius} onChange={(e) => update("allowedRadius", e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Green circle on map</p>
        </div>
        {!isSubBranch ? (
          <>
            <div>
              <Label>Delivery radius (km)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.deliveryRadiusKm}
                onChange={(e) => update("deliveryRadiusKm", e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Service area circle size (e.g. 10 km). Clusters divide this disk.
              </p>
            </div>
            <div>
              <Label>Number of clusters</Label>
              <Input
                type="number"
                min={2}
                max={24}
                value={form.deliveryClusterCount}
                onChange={(e) => update("deliveryClusterCount", e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Equal pie slices around the warehouse (e.g. 7 clusters).
              </p>
            </div>
          </>
        ) : null}
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

export function formToCreatePayload(form: BranchFormValues): CreateBranchInput {
  const payload: CreateBranchInput = {
    companyId: form.companyId,
    parentBranchId: form.parentBranchId || null,
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
  if (!form.parentBranchId) {
    payload.deliveryRadiusKm = form.deliveryRadiusKm ? Number(form.deliveryRadiusKm) : 10;
    payload.deliveryClusterCount = form.deliveryClusterCount
      ? Number(form.deliveryClusterCount)
      : 5;
  }
  return payload;
}

export function formToUpdatePayload(form: BranchFormValues): UpdateBranchInput {
  const payload: UpdateBranchInput = {
    parentBranchId: form.parentBranchId || null,
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
  if (!form.parentBranchId) {
    payload.deliveryRadiusKm = form.deliveryRadiusKm ? Number(form.deliveryRadiusKm) : 10;
    payload.deliveryClusterCount = form.deliveryClusterCount
      ? Number(form.deliveryClusterCount)
      : 5;
  }
  return payload;
}
