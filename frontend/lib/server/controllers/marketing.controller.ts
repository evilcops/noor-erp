import type { Request, Response } from "express";
import {
  approveProductAd,
  broadcastProductAd,
  createAndGenerateProductAd,
  finalizeProductAdFromOpenArt,
  getProductAd,
  listProductAds,
  reviseProductAd,
} from "../services/product-ad.service";
import { verifyOpenArtWebhookSecret, testOpenArtConnection } from "../services/openart.service";
import {
  assertCompanyAccess,
  resolveRequestCompanyId,
} from "../services/permission.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function createProductAd(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(req.user!, req.body.companyId);
  await assertCompanyAccess(req.user!, companyId);

  const ad = await createAndGenerateProductAd({
    companyId,
    productId: req.body.productId,
    language: req.body.language,
    durationSeconds: req.body.durationSeconds,
    waitForCompletion: req.body.waitForCompletion,
    autoBroadcast: req.body.autoBroadcast === true,
    revisionFeedback: req.body.revisionFeedback,
    parentAdId: req.body.parentAdId,
    userId: req.user!._id,
  });

  return sendSuccess(res, ad, 201);
}

export async function listAds(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(
    req.user!,
    typeof req.query.companyId === "string" ? req.query.companyId : undefined
  );
  await assertCompanyAccess(req.user!, companyId);

  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const productId =
    typeof req.query.productId === "string" ? req.query.productId : undefined;

  const result = await listProductAds({ companyId, productId, page, limit });
  return sendSuccess(res, result.items, 200, buildMeta(page, limit, result.total));
}

export async function getAd(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(req.user!);
  const ad = await getProductAd(req.params.id, companyId);
  return sendSuccess(res, ad);
}

export async function broadcastAd(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(req.user!);
  const existing = await getProductAd(req.params.id, companyId);
  const ad = await broadcastProductAd(String(existing._id), req.user!._id);
  return sendSuccess(res, ad);
}

export async function approveAd(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(req.user!);
  await getProductAd(req.params.id, companyId);
  const ad = await approveProductAd(req.params.id, req.user!._id, {
    broadcast: req.body.broadcast !== false,
  });
  return sendSuccess(res, ad);
}

export async function reviseAd(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(req.user!);
  await getProductAd(req.params.id, companyId);
  const ad = await reviseProductAd({
    adId: req.params.id,
    feedback: req.body.feedback,
    companyId,
    userId: req.user!._id,
  });
  return sendSuccess(res, ad, 201);
}

/**
 * Webhook / completion hook: when OpenArt finishes generating the ad,
 * mark it ready for approval (broadcast only if autoBroadcast=true).
 */
export async function openArtGenerationWebhook(req: Request, res: Response) {
  const secret =
    req.headers["x-openart-webhook-secret"] ||
    req.headers["x-webhook-secret"] ||
    (typeof req.query.secret === "string" ? req.query.secret : undefined);

  if (!verifyOpenArtWebhookSecret(typeof secret === "string" ? secret : null)) {
    throw new AppError("UNAUTHORIZED", "Invalid OpenArt webhook secret", 401);
  }

  const status = String(req.body.status || "completed").toLowerCase();
  if (status === "failed" || status === "error") {
    throw new AppError("BAD_REQUEST", "OpenArt reported a failed generation", 400);
  }

  if (!req.body.adId && !req.body.historyId && !req.body.resourceId && !req.body.videoUrl) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Provide adId, historyId, resourceId, or videoUrl",
      400
    );
  }

  const ad = await finalizeProductAdFromOpenArt({
    adId: req.body.adId,
    historyId: req.body.historyId,
    resourceId: req.body.resourceId,
    videoUrl: req.body.videoUrl,
    thumbnailUrl: req.body.thumbnailUrl,
    autoBroadcast: req.body.autoBroadcast === true,
  });

  return sendSuccess(res, ad);
}

export async function openArtStatus(_req: Request, res: Response) {
  const status = await testOpenArtConnection();
  return sendSuccess(res, status);
}
