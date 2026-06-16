import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

const postHandlers: Record<string, ReturnType<typeof apiRoute>> = {
  "schedule-interview": apiRoute({
    controller: recruitmentController.scheduleInterview,
    auth: true,
    permission: { resource: "recruitment", action: "edit" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id/schedule-interview",
  }),
  "interview-feedback": apiRoute({
    controller: recruitmentController.interviewFeedback,
    auth: true,
    permission: { resource: "recruitment", action: "edit" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id/interview-feedback",
  }),
  "convert-to-employee": apiRoute({
    controller: recruitmentController.convertToEmployee,
    auth: true,
    permission: { resource: "recruitment", action: "create" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id/convert-to-employee",
  }),
};

const putHandlers: Record<string, ReturnType<typeof apiRoute>> = {
  status: apiRoute({
    controller: recruitmentController.updateCandidateStatus,
    auth: true,
    permission: { resource: "recruitment", action: "edit" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id/status",
  }),
};

type RouteContext = { params: Promise<{ id: string; action: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id, action } = await context.params;
  const handler = postHandlers[action];
  if (!handler) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: `Unknown action: ${action}` } },
      { status: 404 }
    );
  }
  return handler(request, { params: Promise.resolve({ id }) });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id, action } = await context.params;
  const handler = putHandlers[action];
  if (!handler) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: `Unknown action: ${action}` } },
      { status: 404 }
    );
  }
  return handler(request, { params: Promise.resolve({ id }) });
}
