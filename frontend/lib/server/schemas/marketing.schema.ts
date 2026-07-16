import { z } from "zod";

export const createProductAdSchema = z.object({
  productId: z.string().min(1),
  companyId: z.string().min(1).optional(),
  language: z.enum(["en", "ur", "ar"]),
  durationSeconds: z.number().int().min(4).max(9).optional(),
  waitForCompletion: z.boolean().optional(),
  autoBroadcast: z.boolean().optional(),
  revisionFeedback: z.string().max(1000).optional(),
  parentAdId: z.string().optional(),
});

export const reviseProductAdSchema = z.object({
  feedback: z.string().min(3).max(1000),
});

export const approveProductAdSchema = z.object({
  broadcast: z.boolean().optional(),
});

export const broadcastProductAdSchema = z.object({
  autoBroadcast: z.boolean().optional(),
});

export const openArtWebhookSchema = z.object({
  adId: z.string().optional(),
  historyId: z.string().optional(),
  resourceId: z.string().optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  status: z.string().optional(),
  autoBroadcast: z.boolean().optional(),
});
