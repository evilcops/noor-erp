import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const storeRegisterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email(),
  phone: z.string().min(1).refine((v) => normalizePhone(v).length > 0, "Valid phone required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.string().optional(),
  area: z.string().optional(),
  branchId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const storeLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const storeLocationSchema = z
  .object({
    address: z.string().optional(),
    area: z.string().optional(),
    branchId: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  })
  .refine(
    (v) =>
      Boolean(v.branchId?.trim()) ||
      Boolean(v.address?.trim()) ||
      (v.coordinates?.lat != null && v.coordinates?.lng != null) ||
      (v.lat != null && v.lng != null),
    { message: "Provide a branch, address, or GPS coordinates" }
  );

export const storeCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().min(1),
      })
    )
    .min(1),
  name: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  notes: z.string().optional(),
  promisedWindowStart: z.string().optional(),
  promisedWindowEnd: z.string().optional(),
});
