type RuntimeWorkloadStatus =
  | "running"
  | "stopped"
  | "error"
  | "starting"
  | "stopping"
  | "unhealthy"
  | "removing"
  | "unknown"
  | "unauthenticated"
  | "auth_retrying"
  | "policy_stopped";

export interface RuntimeWorkload {
  name: string;
  package?: string;
  url?: string;
  transport_type?: string;
  proxy_mode?: string;
  status?: RuntimeWorkloadStatus;
  group?: string;
  remote: boolean;
}

export interface RuntimeWorkloadDetail {
  name?: string;
  image?: string;
  host?: string;
  target_port?: number;
  proxy_port?: number;
  transport?: string;
  proxy_mode?: string;
  network_isolation?: boolean;
  group?: string;
}

export interface RuntimeCreateResponse {
  name: string;
  port: number;
}

export interface ContainerWorkloadCreateRequest {
  mode: "container";
  name: string;
  image: string;
  transport: string;
  cmd_arguments?: string[];
  volumes?: string[];
  network_isolation?: boolean;
}

export interface RemoteWorkloadCreateRequest {
  mode: "remote";
  name: string;
  url: string;
  transport: string;
}

export type RuntimeWorkloadCreateRequest =
  | ContainerWorkloadCreateRequest
  | RemoteWorkloadCreateRequest;

export type RuntimeErrorKind =
  | "unavailable"
  | "not_found"
  | "invalid_response"
  | "invalid_request"
  | "conflict";

export class ToolHiveRuntimeError extends Error {
  readonly kind: RuntimeErrorKind;
  readonly statusCode?: number;

  constructor(kind: RuntimeErrorKind, message: string, statusCode?: number) {
    super(message);
    this.name = "ToolHiveRuntimeError";
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: RuntimeErrorKind; message: string };

const REQUEST_TIMEOUT_MS = 5_000;

function runtimeBaseUrl(): string {
  const baseUrl = process.env.TOOLHIVE_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ToolHiveRuntimeError(
      "unavailable",
      "ToolHive Runtime is not configured. Set TOOLHIVE_API_BASE_URL.",
    );
  }
  return baseUrl.replace(/\/$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkloadList(value: unknown): RuntimeWorkload[] {
  if (!isObject(value)) {
    throw new ToolHiveRuntimeError(
      "invalid_response",
      "ToolHive Runtime returned an invalid workload list.",
    );
  }
  const workloads = value.workloads;
  if (workloads === null || workloads === undefined) {
    return [];
  }
  if (!Array.isArray(workloads)) {
    throw new ToolHiveRuntimeError(
      "invalid_response",
      "ToolHive Runtime returned an invalid workload list.",
    );
  }
  return workloads
    .filter(
      (workload): workload is Record<string, unknown> =>
        isObject(workload) && typeof workload.name === "string",
    )
    .map((workload) => ({
      name: workload.name as string,
      package:
        typeof workload.package === "string" ? workload.package : undefined,
      url: typeof workload.url === "string" ? workload.url : undefined,
      transport_type:
        typeof workload.transport_type === "string"
          ? workload.transport_type
          : undefined,
      proxy_mode:
        typeof workload.proxy_mode === "string"
          ? workload.proxy_mode
          : undefined,
      status:
        typeof workload.status === "string"
          ? (workload.status as RuntimeWorkloadStatus)
          : undefined,
      group: typeof workload.group === "string" ? workload.group : undefined,
      remote: workload.remote === true,
    }));
}

function parseWorkloadDetail(value: unknown): RuntimeWorkloadDetail {
  if (!isObject(value)) {
    throw new ToolHiveRuntimeError(
      "invalid_response",
      "ToolHive Runtime returned an invalid workload detail.",
    );
  }
  return value as RuntimeWorkloadDetail;
}

function parseWorkloadStatus(value: unknown): RuntimeWorkloadStatus {
  if (!isObject(value) || typeof value.status !== "string") {
    throw new ToolHiveRuntimeError(
      "invalid_response",
      "ToolHive Runtime returned an invalid workload status.",
    );
  }
  return value.status as RuntimeWorkloadStatus;
}

async function requestJson<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  const baseUrl = runtimeBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new ToolHiveRuntimeError(
        "unavailable",
        "ToolHive Runtime is unavailable. Check thv serve and TOOLHIVE_API_BASE_URL.",
      );
    }

    if (response.status === 404) {
      throw new ToolHiveRuntimeError(
        "not_found",
        "The requested ToolHive workload was not found.",
        response.status,
      );
    }
    if (!response.ok) {
      throw new ToolHiveRuntimeError(
        "unavailable",
        `ToolHive Runtime request failed (HTTP ${response.status}).`,
        response.status,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ToolHiveRuntimeError(
        "invalid_response",
        "ToolHive Runtime returned invalid JSON.",
        response.status,
      );
    }
    return parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

export async function listRuntimeWorkloads(): Promise<
  RuntimeResult<RuntimeWorkload[]>
> {
  try {
    return {
      ok: true,
      data: await requestJson(
        "/api/v1beta/workloads?all=true",
        parseWorkloadList,
      ),
    };
  } catch (error) {
    return runtimeErrorResult(error);
  }
}

export async function getRuntimeWorkload(
  name: string,
): Promise<RuntimeResult<RuntimeWorkloadDetail>> {
  try {
    return {
      ok: true,
      data: await requestJson(
        `/api/v1beta/workloads/${encodeURIComponent(name)}`,
        parseWorkloadDetail,
      ),
    };
  } catch (error) {
    return runtimeErrorResult(error);
  }
}

export async function getRuntimeWorkloadStatus(
  name: string,
): Promise<RuntimeResult<RuntimeWorkloadStatus>> {
  try {
    return {
      ok: true,
      data: await requestJson(
        `/api/v1beta/workloads/${encodeURIComponent(name)}/status`,
        parseWorkloadStatus,
      ),
    };
  } catch (error) {
    return runtimeErrorResult(error);
  }
}

export async function createRuntimeWorkload(
  request: RuntimeWorkloadCreateRequest,
): Promise<RuntimeResult<RuntimeCreateResponse>> {
  try {
    const body =
      request.mode === "container"
        ? {
            name: request.name,
            image: request.image,
            transport: request.transport,
            ...(request.cmd_arguments?.length
              ? { cmd_arguments: request.cmd_arguments }
              : {}),
            ...(request.volumes?.length ? { volumes: request.volumes } : {}),
            ...(request.network_isolation === undefined
              ? {}
              : { network_isolation: request.network_isolation }),
          }
        : {
            name: request.name,
            url: request.url,
            transport: request.transport,
          };
    return { ok: true, data: await postCreateRequest(body) };
  } catch (error) {
    return runtimeErrorResult(error);
  }
}

async function postCreateRequest(
  body: Record<string, unknown>,
): Promise<RuntimeCreateResponse> {
  const baseUrl = runtimeBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1beta/workloads`, {
        method: "POST",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ToolHiveRuntimeError(
        "unavailable",
        "ToolHive Runtime is unavailable. Check thv serve and TOOLHIVE_API_BASE_URL.",
      );
    }

    let responseText = "";
    try {
      responseText = await response.text();
    } catch {
      responseText = "";
    }
    if (response.status === 400) {
      throw new ToolHiveRuntimeError(
        "invalid_request",
        responseText || "ToolHive rejected the workload request.",
        response.status,
      );
    }
    if (response.status === 409) {
      throw new ToolHiveRuntimeError(
        "conflict",
        responseText || "A workload with this name already exists.",
        response.status,
      );
    }
    if (!response.ok) {
      throw new ToolHiveRuntimeError(
        "unavailable",
        `ToolHive Runtime request failed (HTTP ${response.status}).`,
        response.status,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new ToolHiveRuntimeError(
        "invalid_response",
        "ToolHive Runtime returned invalid JSON.",
        response.status,
      );
    }
    if (
      !isObject(parsed) ||
      typeof parsed.name !== "string" ||
      typeof parsed.port !== "number"
    ) {
      throw new ToolHiveRuntimeError(
        "invalid_response",
        "ToolHive Runtime returned an invalid create response.",
        response.status,
      );
    }
    return { name: parsed.name, port: parsed.port };
  } finally {
    clearTimeout(timeout);
  }
}

function runtimeErrorResult<T>(error: unknown): RuntimeResult<T> {
  if (error instanceof ToolHiveRuntimeError) {
    return { ok: false, kind: error.kind, message: error.message };
  }
  return {
    ok: false,
    kind: "unavailable",
    message:
      "ToolHive Runtime is unavailable. Check thv serve and its API URL.",
  };
}
