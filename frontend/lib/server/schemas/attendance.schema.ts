import { z } from "zod";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
});

export const checkInSchema = z.object({
  employeeId: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  deviceInfo: z.string().optional(),
  notes: z.string().optional(),
});

export const checkOutSchema = checkInSchema;

export const createAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string(),
  timeIn: z.string().optional(),
  timeOut: z.string().optional(),
  status: z
    .enum([
      "present",
      "late",
      "absent",
      "half_day",
      "on_leave",
      "holiday",
      "correction_pending",
      "approved_correction",
    ])
    .optional(),
  notes: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  deviceInfo: z.string().optional(),
  isMissedCheckout: z.boolean().optional(),
  locationIn: locationSchema.optional(),
  locationOut: locationSchema.optional(),
});

export const updateAttendanceSchema = createAttendanceSchema.partial().omit({ employeeId: true });

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

export const missedCheckoutSchema = z.object({
  timeOut: z.string().optional(),
  reason: z.string().optional(),
});
