import { z } from "zod";

export const assignDeliverySchema = z.object({
  riderId: z.string().min(1),
  scheduledDate: z.string().min(1),
  timeSlotStart: z.string().min(1),
  timeSlotEnd: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum([
    "scheduled",
    "in_transit",
    "delivered",
    "failed",
    "refused",
    "rescheduled",
    "cancelled",
  ]),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
  cashCollected: z.number().min(0).optional(),
  cashHandedOver: z.boolean().optional(),
  wastageItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().min(0),
        reason: z.string().optional(),
      })
    )
    .optional(),
  rescheduleTimeSlotStart: z.string().optional(),
  rescheduleTimeSlotEnd: z.string().optional(),
});

export const optimizeRouteSchema = z.object({
  riderId: z.string().min(1),
  scheduledDate: z.string().min(1),
  deliveryIds: z.array(z.string().min(1)).min(1),
});

export const riderLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
