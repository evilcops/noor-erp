import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";
import { openArtWebhookSchema } from "@/lib/server/schemas/marketing.schema";

/**
 * Completion webhook: OpenArt (or an internal poller) POSTs here when the ad
 * video is ready. The handler finalizes the ProductAd and broadcasts it to
 * all customers in the ERP company.
 *
 * Secure with OPENART_WEBHOOK_SECRET via header `x-openart-webhook-secret`.
 */
export const POST = apiRoute({
  controller: marketingController.openArtGenerationWebhook,
  auth: false,
  validate: { schema: openArtWebhookSchema },
  apiPath: "/marketing/webhooks/openart",
});
