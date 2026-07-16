import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

const DEFAULT_BASE_URL = "https://openart.ai/suite/api";
/** Fast tier with native audio — much cheaper/quicker than Seedance 2.0 (~150 vs ~800 credits). */
const DEFAULT_MODEL = "grok-imagine";
/** Short ads use fewer credits and finish faster (Grok supports from ~1s). */
export const DEFAULT_AD_DURATION_SECONDS = 4;
const MAX_AD_DURATION_SECONDS = 9;
const DEFAULT_RESOLUTION = "480p";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

/** Brand spokesperson used in every Noor product ad (matches /public/marketing/ad-character.png). */
export const AD_CHARACTER_DESCRIPTION =
  "Use THIS EXACT woman as the only on-camera spokesperson (same face, hair, outfit, jewelry — do not invent a different person): young South Asian woman, fair complexion, warm smile, long dark wavy hair under a colorful Phulkari-style dupatta, royal blue embroidered kameez with gold and red detailing, bright red salwar, silver jhumka earrings, colorful bangles. Keep her identity locked for the full clip.";

export const AD_CHARACTER_PUBLIC_PATH = "/marketing/ad-character.png";
export const AD_CHARACTER_ID = "noor-brand-woman";
export const AD_CHARACTER_LABEL = "Noor brand woman (blue kameez)";

/** In-memory cache of OpenArt CDN URL after we upload the local character file once. */
let cachedCharacterAssetUrl: string | undefined;

export type AdLanguage = "en" | "ur" | "ar";

export interface OpenArtSubmitResult {
  historyId: string;
  resourceIds: string[];
}

export interface OpenArtResource {
  id: string;
  url?: string;
  thumbnailUrl?: string;
  resourceType?: string;
  status: string;
}

export interface GenerateProductAdInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  /** Public HTTPS image URL for image-to-video (character or product) */
  referenceImageUrl?: string;
  /** Force using the brand character reference when available */
  useBrandCharacter?: boolean;
  model?: string;
  projectId?: string;
}

function env(key: string) {
  return process.env[key]?.trim().replace(/^["']|["']$/g, "") || undefined;
}

function getConfig() {
  const baseUrl = (env("OPENART_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");
  const token = env("OPENART_API_TOKEN") || env("OPENART_API_KEY");
  const sessionCookie = env("OPENART_SESSION_COOKIE");
  const projectId = env("OPENART_PROJECT_ID");
  const model = env("OPENART_MODEL") || DEFAULT_MODEL;
  const webhookSecret = env("OPENART_WEBHOOK_SECRET");
  const resolution = env("OPENART_RESOLUTION") || DEFAULT_RESOLUTION;
  const mock =
    env("OPENART_MOCK") === "true" ||
    env("OPENART_MOCK") === "1" ||
    env("OPENART_MOCK") === "yes";

  return { baseUrl, token, sessionCookie, projectId, model, webhookSecret, resolution, mock };
}

function assertConfigured() {
  const cfg = getConfig();
  if (cfg.mock) return cfg;
  if (!cfg.token && !cfg.sessionCookie) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "OpenArt is not configured. Set OPENART_API_TOKEN (or OPENART_SESSION_COOKIE) in .env, or set OPENART_MOCK=true for local testing",
      503
    );
  }
  return cfg;
}

function buildMockResource(prompt: string): OpenArtResource {
  const id = `mock-${Date.now()}`;
  // Public sample clip used only when OPENART_MOCK=true
  const url = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
  return {
    id,
    url,
    thumbnailUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
    resourceType: "video",
    status: "completed",
  };
}

async function openArtFetch<T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> {
  const cfg = assertConfigured();
  const url = new URL(`${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cfg.token) {
    headers.set("Authorization", `Bearer ${cfg.token}`);
  }
  if (cfg.sessionCookie) {
    headers.set("Cookie", cfg.sessionCookie);
  }
  // OpenArt suite API expects browser-like requests
  if (!headers.has("User-Agent")) {
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
  }
  if (!headers.has("Origin")) {
    headers.set("Origin", "https://openart.ai");
  }
  if (!headers.has("Referer")) {
    headers.set("Referer", "https://openart.ai/suite/");
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message =
      (json as { message?: string; error?: string })?.message ||
      (json as { error?: string })?.error ||
      `OpenArt request failed (${res.status})`;
    logger.error("OpenArt API error", { path, status: res.status, body: json });
    throw new AppError(
      "BAD_REQUEST",
      `OpenArt API (${path}): ${message}`,
      res.status >= 500 ? 502 : 400,
      { path, status: res.status, response: json }
    );
  }

  return json as T;
}

export function clampAdDuration(seconds?: number) {
  const value = Number(seconds ?? DEFAULT_AD_DURATION_SECONDS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_AD_DURATION_SECONDS;
  return Math.min(MAX_AD_DURATION_SECONDS, Math.max(4, Math.round(value)));
}

export function languageLabel(language: AdLanguage) {
  switch (language) {
    case "ur":
      return "Urdu";
    case "ar":
      return "Arabic";
    default:
      return "English";
  }
}

/**
 * Short, credit-efficient product ad prompt with fixed brand character + language.
 */
export function buildProductAdPrompt(input: {
  productName: string;
  language: AdLanguage;
  durationSeconds?: number;
  brand?: string;
  category?: string;
  description?: string;
  sellingPrice?: number;
  revisionFeedback?: string;
}) {
  const duration = clampAdDuration(input.durationSeconds);
  const lang = languageLabel(input.language);
  const spoken =
    input.language === "ur"
      ? `She speaks clear Urdu only, presenting ${input.productName}.`
      : input.language === "ar"
        ? `She speaks clear Arabic only, presenting ${input.productName}.`
        : `She speaks clear English only, presenting ${input.productName}.`;

  const parts = [
    `Create a short ${duration}-second product ad for ${input.productName}, spoken and on-screen text in ${lang}.`,
    AD_CHARACTER_DESCRIPTION,
    "CRITICAL: reuse the identical spokesperson look in every frame — do not change her face, age, skin tone, hair, or outfit.",
    spoken,
    "Keep the clip short and simple: spokesperson holds/presents the product, one clear product focus.",
  ];

  if (input.brand) parts.push(`Brand: ${input.brand}.`);
  if (input.category) parts.push(`Category: ${input.category}.`);
  if (input.description) {
    const shortDesc = input.description.slice(0, 120);
    parts.push(`Product: ${shortDesc}.`);
  }
  if (input.sellingPrice != null) {
    parts.push(`Price: ${input.sellingPrice} OMR.`);
  }
  if (input.revisionFeedback?.trim()) {
    parts.push(`Improve based on this feedback: ${input.revisionFeedback.trim()}.`);
  }

  return parts.join(" ");
}

function capabilityId(model: string, mode: "text2video" | "image2video") {
  return `${model}:${mode}`;
}

function isPublicHttpsUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return false;
    return true;
  } catch {
    return false;
  }
}

export async function getDefaultProjectId() {
  const cfg = assertConfigured();
  if (cfg.projectId) return cfg.projectId;

  const res = await openArtFetch<{ projectId?: string; data?: { projectId?: string } }>(
    "/projects/default"
  );
  const projectId = res.projectId || res.data?.projectId;
  if (!projectId) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "OpenArt project ID missing. Set OPENART_PROJECT_ID in .env",
      503
    );
  }
  return projectId;
}

/**
 * Upload the local brand character PNG to OpenArt so image-to-video can lock the same face.
 * Failures are soft — ads still generate via text2video with the character locked in the prompt.
 */
export async function ensureCharacterAssetUrl(projectId?: string): Promise<string | undefined> {
  const cfg = assertConfigured();
  if (cfg.mock) return undefined;
  // Character file upload to OpenArt is optional and currently unstable against
  // suite validation. Set OPENART_CHARACTER_ASSET_URL to a known CDN image URL
  // to enable image2video start-frame; otherwise we rely on the prompt lock.
  if (env("OPENART_DISABLE_CHARACTER_UPLOAD") !== "false") {
    const fromEnv = env("OPENART_CHARACTER_ASSET_URL");
    if (fromEnv && isPublicHttpsUrl(fromEnv)) {
      cachedCharacterAssetUrl = fromEnv;
      return fromEnv;
    }
    return cachedCharacterAssetUrl;
  }

  try {
    const fromEnv = env("OPENART_CHARACTER_ASSET_URL");
    if (fromEnv && isPublicHttpsUrl(fromEnv)) {
      cachedCharacterAssetUrl = fromEnv;
      return fromEnv;
    }
    if (cachedCharacterAssetUrl) return cachedCharacterAssetUrl;

    const fs = await import("fs/promises");
    const path = await import("path");
    const characterPath = path.join(process.cwd(), "public", "marketing", "ad-character.png");

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(characterPath);
    } catch {
      logger.warn("Brand character file missing", { characterPath });
      return undefined;
    }

    const resolvedProjectId = projectId || (await getDefaultProjectId());
    const filename = "noor-ad-character.png";
    const contentType = "image/png";

    const signed = await openArtFetch<{
      uploadUrl?: string;
      assetUrl?: string;
      data?: { uploadUrl?: string; assetUrl?: string };
    }>("/upload/sign", {
      method: "POST",
      body: JSON.stringify({ filename, contentType }),
    });

    const uploadUrl = signed.uploadUrl || signed.data?.uploadUrl;
    const assetUrl = signed.assetUrl || signed.data?.assetUrl;
    if (!uploadUrl || !assetUrl) {
      logger.warn("OpenArt upload/sign did not return uploadUrl/assetUrl", { signed });
      return undefined;
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(buffer),
    });
    if (!putRes.ok) {
      logger.warn("OpenArt character upload PUT failed", { status: putRes.status });
      return undefined;
    }

    const persisted = await openArtFetch<{
      url?: string;
      id?: string;
      data?: { url?: string; id?: string };
    }>("/upload/persist", {
      method: "POST",
      body: JSON.stringify({ url: assetUrl, projectId: resolvedProjectId }),
    });

    const finalUrl = persisted.url || persisted.data?.url || assetUrl;
    if (!isPublicHttpsUrl(finalUrl)) {
      logger.warn("OpenArt character persist returned non-HTTPS URL", { finalUrl });
      return undefined;
    }

    cachedCharacterAssetUrl = finalUrl;
    logger.info("OpenArt brand character uploaded", { url: finalUrl });
    return finalUrl;
  } catch (error) {
    logger.warn("OpenArt character upload skipped", {
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function submitVideoGeneration(
  input: GenerateProductAdInput
): Promise<OpenArtSubmitResult> {
  const cfg = assertConfigured();

  if (cfg.mock) {
    const resource = buildMockResource(input.prompt);
    logger.info("OpenArt MOCK submit", { prompt: input.prompt, resourceId: resource.id });
    return { historyId: resource.id, resourceIds: [resource.id] };
  }

  const model = String(input.model || cfg.model);
  const projectId = String(input.projectId || (await getDefaultProjectId()));
  const duration = Number(clampAdDuration(input.durationSeconds));
  if (!Number.isFinite(duration)) {
    throw new AppError("VALIDATION_ERROR", "Invalid ad duration", 400);
  }

  // Optional HTTPS character/product start frame (env OPENART_CHARACTER_ASSET_URL).
  // Do not call OpenArt upload APIs here — they currently reject with unrelated Zod errors.
  const referenceImageUrl =
    (input.useBrandCharacter !== false
      ? await ensureCharacterAssetUrl(projectId)
      : undefined) ||
    (isPublicHttpsUrl(input.referenceImageUrl) ? input.referenceImageUrl : undefined);

  // Always start with verified text2video body. Only attach startImageUrl when
  // we already have a known public HTTPS asset URL.
  const mode: "text2video" | "image2video" = referenceImageUrl ? "image2video" : "text2video";

  const body: Record<string, unknown> = {
    prompt: String(input.prompt),
    model,
    projectId,
    videoCount: 1,
    duration,
    aspectRatio: String(input.aspectRatio || "9:16"),
    resolution: String(input.resolution || cfg.resolution || DEFAULT_RESOLUTION),
    autoEnhancePrompt: false,
    enableUnlimited: true,
  };

  if (referenceImageUrl && mode === "image2video") {
    body.startImageUrl = referenceImageUrl;
  }

  try {
    return await postVideoCreation(capabilityId(model, mode), body);
  } catch (firstError) {
    if (mode === "image2video") {
      logger.warn("OpenArt image2video rejected; falling back to text2video", {
        message: firstError instanceof Error ? firstError.message : String(firstError),
      });
      const textBody = { ...body };
      delete textBody.startImageUrl;
      return await postVideoCreation(capabilityId(model, "text2video"), textBody);
    }
    throw firstError;
  }
}

async function postVideoCreation(
  capability: string,
  body: Record<string, unknown>
): Promise<OpenArtSubmitResult> {
  // OpenArt expects the colon encoded in the path segment.
  const path = `/forms/creations/${encodeURIComponent(capability)}`;
  logger.info("OpenArt submit", {
    path,
    model: body.model,
    duration: body.duration,
    keys: Object.keys(body),
  });

  const res = await openArtFetch<{
    historyId?: string;
    resourceIds?: string[];
    data?: { historyId?: string; resourceIds?: string[] };
  }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const historyId = res.historyId || res.data?.historyId;
  const resourceIds = res.resourceIds || res.data?.resourceIds || [];

  if (!historyId && resourceIds.length === 0) {
    throw new AppError("BAD_REQUEST", "OpenArt did not return a generation id", 502, res);
  }

  return {
    historyId: historyId || resourceIds[0],
    resourceIds,
  };
}

export async function getResource(resourceId: string): Promise<OpenArtResource> {
  const cfg = assertConfigured();
  if (cfg.mock || resourceId.startsWith("mock-")) {
    return {
      id: resourceId,
      url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      thumbnailUrl:
        "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
      resourceType: "video",
      status: "completed",
    };
  }

  const res = await openArtFetch<{ data?: OpenArtResource } & OpenArtResource>(
    `/resources/${encodeURIComponent(resourceId)}`
  );
  return (res.data ?? res) as OpenArtResource;
}

export async function waitForResource(
  resourceId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<OpenArtResource> {
  const cfg = getConfig();
  if (cfg.mock || resourceId.startsWith("mock-")) {
    // Brief delay so the UI can show a realistic processing state in dev/mock mode.
    await new Promise((r) => setTimeout(r, 3000));
    return getResource(resourceId);
  }

  const timeoutMs = options?.timeoutMs ?? POLL_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const resource = await getResource(resourceId);
    const status = (resource.status || "").toLowerCase();

    if (status === "completed" || status === "success" || status === "ready") {
      if (!resource.url) {
        throw new AppError("BAD_REQUEST", "OpenArt completed without a media URL", 502);
      }
      return resource;
    }

    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new AppError("BAD_REQUEST", `OpenArt generation ${status}`, 502);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new AppError("SERVICE_UNAVAILABLE", "Timed out waiting for OpenArt generation", 504);
}

/**
 * Submit a product ad to OpenArt and optionally wait until the video URL is ready.
 */
export async function generateProductAdVideo(
  input: GenerateProductAdInput & { wait?: boolean }
) {
  const submitted = await submitVideoGeneration(input);

  if (!input.wait) {
    return { ...submitted, resource: null as OpenArtResource | null };
  }

  const resourceId = submitted.resourceIds[0] || submitted.historyId;
  const resource = await waitForResource(resourceId);
  return { ...submitted, resource };
}

export function verifyOpenArtWebhookSecret(headerSecret?: string | null) {
  const { webhookSecret } = getConfig();
  if (!webhookSecret) return true;
  return Boolean(headerSecret) && headerSecret === webhookSecret;
}

/** Verify session cookie / API token and return workspace info for setup. */
export async function testOpenArtConnection() {
  const cfg = getConfig();

  if (cfg.mock) {
    return {
      ok: true,
      mode: "mock" as const,
      message: "OPENART_MOCK=true — using sample video, not real OpenArt API",
      projectId: cfg.projectId || "mock-project",
    };
  }

  const user = await openArtFetch<{
    id?: string;
    displayName?: string;
    username?: string;
    free_credit_balance?: number;
  }>("/user/my-info", { method: "POST", body: JSON.stringify({}) });

  let projectId = cfg.projectId;
  if (!projectId) {
    try {
      projectId = await getDefaultProjectId();
    } catch {
      projectId = undefined;
    }
  }

  return {
    ok: true,
    mode: "live" as const,
    message: "OpenArt connection successful",
    user: {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      credits: user.free_credit_balance,
    },
    projectId,
    hasSessionCookie: Boolean(cfg.sessionCookie),
    hasApiToken: Boolean(cfg.token),
  };
}

export { MAX_AD_DURATION_SECONDS };
