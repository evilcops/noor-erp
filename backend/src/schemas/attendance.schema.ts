import { z } from "zod";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
});

export const checkInSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  deviceInfo: z.string().optional(),
});

export const checkOutSchema = checkInSchema;

export const correctionRequestSchema = z.object({
  attendanceId: z.string().min(1),
  requestedTimeIn: z.string().optional(),
  requestedTimeOut: z.string().optional(),
  reason: z.string().min(1),
});

export const approveCorrectionSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
});
