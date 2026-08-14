import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import {
  createRuntimeWorkload,
  type RuntimeWorkloadCreateRequest,
} from "@/lib/toolhive-runtime";

function errorStatus(kind: string): number {
  if (kind === "invalid_request") return 400;
  if (kind === "conflict") return 409;
  if (kind === "not_found") return 404;
  return 503;
}

function isCreateRequest(
  value: unknown,
): value is RuntimeWorkloadCreateRequest {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  if (
    (request.mode !== "container" && request.mode !== "remote") ||
    typeof request.name !== "string" ||
    typeof request.transport !== "string"
  ) {
    return false;
  }
  if (request.mode === "container") {
    return typeof request.image === "string";
  }
  return typeof request.url === "string";
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        kind: "unavailable",
        message:
          "Your session has expired. Sign in again before creating a workload.",
      },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        kind: "invalid_request",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }
  if (!isCreateRequest(body)) {
    return NextResponse.json(
      {
        ok: false,
        kind: "invalid_request",
        message: "Invalid workload request.",
      },
      { status: 400 },
    );
  }

  const result = await createRuntimeWorkload(body);
  return NextResponse.json(result, {
    status: result.ok ? 201 : errorStatus(result.kind),
  });
}
