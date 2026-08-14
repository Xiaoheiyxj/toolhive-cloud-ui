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

export type RuntimeErrorKind = "unavailable" | "not_found" | "invalid_response";

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
