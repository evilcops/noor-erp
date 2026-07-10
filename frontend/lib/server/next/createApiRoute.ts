import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";
import type { Action, Resource } from "../config/constants";
import { connectDatabase } from "../config/database";
import { authenticate } from "../middleware/auth";
import { auditMiddleware } from "../middleware/audit";
import { requirePermission } from "../middleware/permission";
import { validate } from "../middleware/validation";
import { ensureDevAdmin, runMigrations } from "../services/bootstrap.service";
import { ensureBackgroundDispatchLoop } from "../services/dispatch-engine.service";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import type { UploadedFile } from "../types/upload";

type ControllerFn = (req: Request, res: Response, next?: NextFunction) => Promise<unknown>;
type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

let devAdminReady = false;
let migrationsRan = false;

async function ensureDevAdminOnce() {
  if (devAdminReady) return;
  await ensureDevAdmin();
  devAdminReady = true;
}

async function runMigrationsOnce() {
  if (migrationsRan) return;
  await runMigrations();
  ensureBackgroundDispatchLoop();
  migrationsRan = true;
}

class MockResponse {
  statusCode = 200;
  body: unknown = null;
  sent = false;
  private jsonInterceptor: ((body: unknown) => unknown) | null = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: unknown) {
    if (this.sent) return this;
    const payload = this.jsonInterceptor ? this.jsonInterceptor(data) : data;
    this.body = payload;
    this.sent = true;
    return this;
  }

  wrapJson(interceptor: (body: unknown) => unknown) {
    this.jsonInterceptor = interceptor;
    return this;
  }

  toNextResponse(): NextResponse {
    return NextResponse.json(this.body, { status: this.statusCode });
  }
}

function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      { status: err.statusCode }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: err.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  if (err instanceof Error && err.name === "ValidationError") {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: err.message } },
      { status: 422 }
    );
  }

  if (err instanceof Error && (err as { code?: number }).code === 11000) {
    return NextResponse.json(
      { success: false, error: { code: "CONFLICT", message: "Duplicate entry" } },
      { status: 409 }
    );
  }

  logger.error("Unhandled error", { error: err });
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 }
  );
}

async function parseRequestPayload(
  request: NextRequest,
  upload: boolean
): Promise<{ body: unknown; file?: UploadedFile }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const body: Record<string, unknown> = {};
    let file: UploadedFile | undefined;

    formData.forEach((value, key) => {
      if (key === "file" && value instanceof File) {
        file = {
          fieldname: "file",
          originalname: value.name,
          encoding: "7bit",
          mimetype: value.type,
          size: value.size,
          buffer: Buffer.alloc(0),
          destination: "",
          filename: value.name,
          path: "",
        };
      } else {
        body[key] = value;
      }
    });

    if (file && upload) {
      const f = formData.get("file");
      if (f instanceof File) {
        const buffer = Buffer.from(await f.arrayBuffer());
        file.buffer = buffer;
        file.size = buffer.length;
      }
    }

    return { body, file: upload ? file : undefined };
  }

  if (contentType.includes("application/json")) {
    try {
      return { body: await request.json() };
    } catch {
      return { body: {} };
    }
  }

  return { body: {} };
}

function runChain(
  req: Request,
  res: MockResponse,
  middlewares: MiddlewareFn[],
  controller: ControllerFn
): Promise<NextResponse> {
  return new Promise((resolve) => {
    let index = 0;

    const next: NextFunction = (err?: unknown) => {
      if (res.sent) {
        resolve(res.toNextResponse());
        return;
      }
      if (err) {
        resolve(handleError(err));
        return;
      }
      if (index >= middlewares.length) {
        Promise.resolve(controller(req, res as unknown as Response, next))
          .then(() => {
            if (!res.sent) {
              resolve(
                NextResponse.json(
                  { success: false, error: { code: "INTERNAL_ERROR", message: "No response sent" } },
                  { status: 500 }
                )
              );
            } else {
              resolve(res.toNextResponse());
            }
          })
          .catch((error) => resolve(handleError(error)));
        return;
      }

      const middleware = middlewares[index++];
      Promise.resolve(middleware(req, res as unknown as Response, next)).catch((error) =>
        resolve(handleError(error))
      );
    };

    next();
  });
}

export interface ApiRouteOptions {
  controller: ControllerFn;
  auth?: boolean;
  permission?: { resource: Resource; action: Action };
  validate?: { schema: ZodSchema; part?: "body" | "query" | "params" };
  audit?: string;
  upload?: boolean;
  apiPath?: string;
}

function createHandler(options: ApiRouteOptions) {
  return async (
    request: NextRequest,
    context: { params?: Promise<Record<string, string>> | Record<string, string> } = {
      params: Promise.resolve({}),
    }
  ): Promise<NextResponse> => {
    await connectDatabase();
    await ensureDevAdminOnce();
    await runMigrationsOnce();

    const params =
      context?.params instanceof Promise ? await context.params : (context?.params ?? {});

    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const { body, file } = await parseRequestPayload(request, !!options.upload);

    const req = {
      method: request.method,
      path: options.apiPath ?? (url.pathname.replace(/^\/api/, "") || "/"),
      url: url.pathname + url.search,
      headers: Object.fromEntries(request.headers.entries()),
      query,
      params,
      body,
      file,
      ip: request.headers.get("x-forwarded-for") ?? "127.0.0.1",
    } as unknown as Request;

    const res = new MockResponse();
    const middlewares: MiddlewareFn[] = [];

    if (options.audit) {
      middlewares.push(auditMiddleware(options.audit) as MiddlewareFn);
    }

    if (options.auth) {
      middlewares.push(authenticate as MiddlewareFn);
    }

    if (options.permission) {
      middlewares.push(
        requirePermission(options.permission.resource, options.permission.action) as MiddlewareFn
      );
    }

    if (options.validate) {
      middlewares.push(
        validate(options.validate.schema, options.validate.part ?? "body") as MiddlewareFn
      );
    }

    return runChain(req, res, middlewares, options.controller);
  };
}

export function apiRoute(options: ApiRouteOptions) {
  return createHandler(options);
}

export function apiRoutes(handlers: Record<string, ApiRouteOptions>) {
  const result: Record<string, ReturnType<typeof createHandler>> = {};
  for (const [method, config] of Object.entries(handlers)) {
    result[method] = createHandler(config);
  }
  return result;
}
