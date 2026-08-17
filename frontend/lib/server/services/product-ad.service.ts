import type { Types } from "mongoose";
import { Customer } from "../models/Customer.model";
import { Product } from "../models/Product.model";
import { ProductAd, type IProductAd, type ProductAdLanguage } from "../models/ProductAd.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { sendEmail } from "./email.service";
import {
  buildProductAdPrompt,
  clampAdDuration,
  DEFAULT_AD_DURATION_SECONDS,
  generateProductAdVideo,
  getResource,
  waitForResource,
  type AdLanguage,
} from "./openart.service";

const APP_PUBLIC_URL = () =>
  (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

function toAbsoluteMediaUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${APP_PUBLIC_URL()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function languageHeadline(language: ProductAdLanguage, productName: string) {
  switch (language) {
    case "ur":
      return `نیا پروڈکٹ: ${productName}`;
    case "ar":
      return `منتج جديد: ${productName}`;
    default:
      return `New product: ${productName}`;
  }
}

function languageBody(language: ProductAdLanguage, productName: string) {
  switch (language) {
    case "ur":
      return `ہم نے ${productName} کے لیے ایک نیا اشتہار تیار کیا ہے۔ اسے دیکھیں اور آرڈر کریں۔`;
    case "ar":
      return `لقد أنشأنا إعلانًا جديدًا لـ ${productName}. شاهده واطلب الآن.`;
    default:
      return `We created a new ad for ${productName}. Watch it and place your order.`;
  }
}

export async function createAndGenerateProductAd(input: {
  companyId: string | Types.ObjectId;
  productId: string;
  language: ProductAdLanguage;
  durationSeconds?: number;
  waitForCompletion?: boolean;
  /** Defaults to false — ads must be approved before broadcast / PO unlock */
  autoBroadcast?: boolean;
  revisionFeedback?: string;
  parentAdId?: string;
  userId?: string | Types.ObjectId;
}) {
  const product = await Product.findOne({
    _id: input.productId,
    companyId: input.companyId,
    deletedAt: null,
  });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  const durationSeconds = clampAdDuration(
    input.durationSeconds ?? DEFAULT_AD_DURATION_SECONDS
  );
  const prompt = buildProductAdPrompt({
    productName: product.name,
    language: input.language as AdLanguage,
    durationSeconds,
    brand: product.brand,
    category: product.category,
    description: product.description,
    sellingPrice: product.sellingPrice,
    revisionFeedback: input.revisionFeedback,
  });

  const ad = await ProductAd.create({
    companyId: input.companyId,
    productId: product._id,
    language: input.language,
    prompt,
    durationSeconds,
    status: "generating",
    revisionFeedback: input.revisionFeedback,
    parentAdId: input.parentAdId || null,
    createdBy: input.userId,
    updatedBy: input.userId,
  });

  try {
    // Always lock brand character via OpenArt image-to-video when possible.
    const wait = input.waitForCompletion === true;
    const autoBroadcast = input.autoBroadcast === true;

    const result = await generateProductAdVideo({
      prompt,
      durationSeconds,
      useBrandCharacter: true,
      wait,
    });

    ad.openArtHistoryId = result.historyId;
    ad.openArtResourceIds = result.resourceIds;

    if (result.resource?.url) {
      ad.videoUrl = result.resource.url;
      ad.thumbnailUrl = result.resource.thumbnailUrl;
      ad.status = "ready";
      await ad.save();

      if (autoBroadcast) {
        return broadcastProductAd(String(ad._id), input.userId);
      }
      return ad;
    }

    ad.status = "generating";
    await ad.save();

    const resourceId = result.resourceIds[0] || result.historyId;
    void completeAdInBackground({
      adId: String(ad._id),
      resourceId,
      userId: input.userId,
      autoBroadcast,
    });

    return ad;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenArt generation failed";
    ad.status = "failed";
    ad.errorMessage = message;
    await ad.save();
    throw error;
  }
}

async function completeAdInBackground(input: {
  adId: string;
  resourceId: string;
  userId?: string | Types.ObjectId;
  autoBroadcast: boolean;
}) {
  try {
    const resource = await waitForResource(input.resourceId);
    await finalizeProductAdFromOpenArt({
      adId: input.adId,
      resourceId: input.resourceId,
      videoUrl: resource.url,
      thumbnailUrl: resource.thumbnailUrl,
      userId: input.userId,
      autoBroadcast: input.autoBroadcast,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background OpenArt completion failed";
    logger.error("Product ad background completion failed", { adId: input.adId, message });
    await ProductAd.updateOne(
      { _id: input.adId },
      { status: "failed", errorMessage: message }
    );
  }
}

/**
 * Called when OpenArt finishes (webhook) or when we poll and find the asset ready.
 * Marks the ad ready for human approval (does not broadcast unless autoBroadcast=true).
 */
export async function finalizeProductAdFromOpenArt(input: {
  adId?: string;
  historyId?: string;
  resourceId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  userId?: string | Types.ObjectId;
  autoBroadcast?: boolean;
}) {
  let ad: IProductAd | null = null;

  if (input.adId) {
    ad = await ProductAd.findById(input.adId);
  } else if (input.historyId) {
    ad = await ProductAd.findOne({ openArtHistoryId: input.historyId });
  } else if (input.resourceId) {
    ad = await ProductAd.findOne({ openArtResourceIds: input.resourceId });
  }

  if (!ad) throw new AppError("NOT_FOUND", "Product ad not found", 404);

  let videoUrl = input.videoUrl;
  let thumbnailUrl = input.thumbnailUrl;

  if (!videoUrl && input.resourceId) {
    const resource = await getResource(input.resourceId);
    videoUrl = resource.url;
    thumbnailUrl = resource.thumbnailUrl || thumbnailUrl;
    if (!ad.openArtResourceIds.includes(input.resourceId)) {
      ad.openArtResourceIds.push(input.resourceId);
    }
  }

  if (!videoUrl) {
    throw new AppError("VALIDATION_ERROR", "videoUrl or resourceId with a ready asset is required", 400);
  }

  ad.videoUrl = videoUrl;
  ad.thumbnailUrl = thumbnailUrl;
  ad.status = "ready";
  ad.errorMessage = undefined;
  if (input.userId) ad.updatedBy = input.userId as Types.ObjectId;
  await ad.save();

  if (input.autoBroadcast === true) {
    return broadcastProductAd(String(ad._id), input.userId);
  }

  return ad;
}

/** Approve a ready ad → unlocks purchase orders for that product and broadcasts to customers. */
export async function approveProductAd(
  adId: string,
  userId?: string | Types.ObjectId,
  options?: { broadcast?: boolean }
) {
  const ad = await ProductAd.findById(adId);
  if (!ad) throw new AppError("NOT_FOUND", "Product ad not found", 404);
  if (!ad.videoUrl) throw new AppError("BAD_REQUEST", "Ad video is not ready yet", 400);
  if (ad.status === "approved" || ad.status === "broadcasted") {
    return ad;
  }
  if (ad.status !== "ready" && ad.status !== "revision_requested") {
    throw new AppError("BAD_REQUEST", `Cannot approve ad in status "${ad.status}"`, 400);
  }

  ad.status = "approved";
  ad.approvedAt = new Date();
  if (userId) {
    ad.approvedBy = userId as Types.ObjectId;
    ad.updatedBy = userId as Types.ObjectId;
  }
  await ad.save();

  if (options?.broadcast !== false) {
    return broadcastProductAd(String(ad._id), userId);
  }
  return ad;
}

/** Mark current ad as needing revision and generate a new version with user feedback. */
export async function reviseProductAd(input: {
  adId: string;
  feedback: string;
  companyId: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
}) {
  const feedback = input.feedback.trim();
  if (!feedback) {
    throw new AppError("VALIDATION_ERROR", "Please describe what to improve in the video", 400);
  }

  const previous = await ProductAd.findOne({
    _id: input.adId,
    companyId: input.companyId,
  });
  if (!previous) throw new AppError("NOT_FOUND", "Product ad not found", 404);
  if (!previous.videoUrl && previous.status !== "failed") {
    throw new AppError("BAD_REQUEST", "Wait until the current ad finishes before revising", 400);
  }

  previous.status = "revision_requested";
  previous.revisionFeedback = feedback;
  if (input.userId) previous.updatedBy = input.userId as Types.ObjectId;
  await previous.save();

  return createAndGenerateProductAd({
    companyId: input.companyId,
    productId: String(previous.productId),
    language: previous.language,
    durationSeconds: previous.durationSeconds || DEFAULT_AD_DURATION_SECONDS,
    revisionFeedback: feedback,
    parentAdId: String(previous._id),
    autoBroadcast: false,
    userId: input.userId,
  });
}

/** True if the product has at least one approved or broadcasted ad. */
export async function productHasApprovedAd(
  companyId: string | Types.ObjectId,
  productId: string | Types.ObjectId
) {
  const count = await ProductAd.countDocuments({
    companyId,
    productId,
    status: { $in: ["approved", "broadcasted"] },
  });
  return count > 0;
}

export async function assertProductsHaveApprovedAds(
  companyId: string | Types.ObjectId,
  productIds: Array<string | Types.ObjectId>
) {
  const uniqueIds = [...new Set(productIds.map(String))];
  if (uniqueIds.length === 0) return;

  const approved = await ProductAd.find({
    companyId,
    productId: { $in: uniqueIds },
    status: { $in: ["approved", "broadcasted"] },
  })
    .select("productId")
    .lean();

  const approvedSet = new Set(approved.map((a) => String(a.productId)));
  const missing = uniqueIds.filter((id) => !approvedSet.has(id));
  if (missing.length === 0) return;

  const products = await Product.find({ _id: { $in: missing } })
    .select("name sku")
    .lean();
  const names = products.map((p) => p.name || p.sku || String(p._id)).join(", ");

  throw new AppError(
    "BAD_REQUEST",
    `Purchase order blocked: approve a product ad first for: ${names}`,
    400,
    { productIds: missing }
  );
}

/**
 * Broadcast the finished OpenArt ad to every customer in the company.
 * Prefers email; falls back to a WhatsApp deep-link record when only phone exists.
 */
export async function broadcastProductAd(
  adId: string,
  userId?: string | Types.ObjectId
) {
  const ad = await ProductAd.findById(adId);
  if (!ad) throw new AppError("NOT_FOUND", "Product ad not found", 404);

  if (!ad.videoUrl) {
    throw new AppError("BAD_REQUEST", "Ad video is not ready yet", 400);
  }

  if (ad.status === "broadcasted") {
    return ad;
  }

  const product = await Product.findById(ad.productId);
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  ad.status = "broadcasting";
  if (userId) ad.updatedBy = userId as Types.ObjectId;
  await ad.save();

  const customers = await Customer.find({
    companyId: ad.companyId,
    deletedAt: null,
  }).select("_id name phone email");

  const headline = languageHeadline(ad.language, product.name);
  const body = languageBody(ad.language, product.name);
  const results: IProductAd["broadcastResults"] = [];

  for (const customer of customers) {
    if (customer.email) {
      try {
        await sendEmail({
          to: customer.email,
          subject: headline,
          text: `${body}\n\nWatch the ad: ${ad.videoUrl}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;color:#111827;">
              <h2 style="margin:0 0 12px;">${headline}</h2>
              <p style="margin:0 0 16px;line-height:1.5;">${body}</p>
              ${
                ad.thumbnailUrl
                  ? `<p><img src="${ad.thumbnailUrl}" alt="${product.name}" style="max-width:100%;border-radius:8px;" /></p>`
                  : ""
              }
              <p style="margin:16px 0;">
                <a href="${ad.videoUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
                  Watch ad
                </a>
              </p>
              <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">Sent automatically by NOOR ERP marketing.</p>
            </div>
          `,
        });
        results.push({
          customerId: customer._id,
          channel: "email",
          status: "sent",
          detail: customer.email,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Email failed";
        logger.warn("Product ad email broadcast failed", {
          adId,
          customerId: String(customer._id),
          detail,
        });
        results.push({
          customerId: customer._id,
          channel: "email",
          status: "failed",
          detail,
        });
      }
      continue;
    }

    if (customer.phone) {
      const phone = customer.phone.replace(/[^\d]/g, "");
      const text = encodeURIComponent(`${headline}\n${body}\n${ad.videoUrl}`);
      const whatsappLink = `https://wa.me/${phone}?text=${text}`;
      results.push({
        customerId: customer._id,
        channel: "whatsapp",
        status: "sent",
        detail: whatsappLink,
      });
      continue;
    }

    results.push({
      customerId: customer._id,
      channel: "email",
      status: "skipped",
      detail: "No email or phone on customer",
    });
  }

  ad.broadcastResults = results;
  ad.broadcastAt = new Date();
  ad.status = "broadcasted";
  await ad.save();

  logger.info("Product ad broadcast complete", {
    adId,
    customers: customers.length,
    sent: results.filter((r) => r.status === "sent").length,
  });

  return ad;
}

export async function getProductAd(adId: string, companyId?: string | Types.ObjectId) {
  const filter: Record<string, unknown> = { _id: adId };
  if (companyId) filter.companyId = companyId;
  const ad = await ProductAd.findOne(filter).populate("productId", "name sku images");
  if (!ad) throw new AppError("NOT_FOUND", "Product ad not found", 404);
  return ad;
}

export async function listProductAds(input: {
  companyId: string | Types.ObjectId;
  productId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = { companyId: input.companyId };
  if (input.productId) filter.productId = input.productId;

  const [items, total] = await Promise.all([
    ProductAd.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("productId", "name sku")
      .lean(),
    ProductAd.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}
