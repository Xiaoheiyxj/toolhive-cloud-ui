import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeWorkload,
  getRuntimeWorkloadStatus,
  listRuntimeWorkloads,
} from "./toolhive-runtime";

const originalRuntimeUrl = process.env.TOOLHIVE_API_BASE_URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalRuntimeUrl === undefined) {
    delete process.env.TOOLHIVE_API_BASE_URL;
  } else {
    process.env.TOOLHIVE_API_BASE_URL = originalRuntimeUrl;
  }
});

describe("ToolHive Runtime client", () => {
  it("reads the list, detail, and status contracts", async () => {
    process.env.TOOLHIVE_API_BASE_URL = "http://runtime.test";
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/v1beta/workloads?all=true")) {
        return new Response(
          JSON.stringify({
            workloads: [{ name: "demo", url: "http://127.0.0.1:28190/mcp" }],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/v1beta/workloads/demo/status")) {
        return new Response(JSON.stringify({ status: "running" }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ name: "demo", image: "mcp/demo:latest" }),
        {
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listRuntimeWorkloads()).resolves.toEqual({
      ok: true,
      data: [
        {
          name: "demo",
          url: "http://127.0.0.1:28190/mcp",
          remote: false,
        },
      ],
    });
    await expect(getRuntimeWorkload("demo")).resolves.toEqual({
      ok: true,
      data: { name: "demo", image: "mcp/demo:latest" },
    });
    await expect(getRuntimeWorkloadStatus("demo")).resolves.toEqual({
      ok: true,
      data: "running",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a missing workload without hiding the not-found state", async () => {
    process.env.TOOLHIVE_API_BASE_URL = "http://runtime.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("workload not found", { status: 404 })),
    );

    await expect(getRuntimeWorkload("missing")).resolves.toMatchObject({
      ok: false,
      kind: "not_found",
    });
  });

  it("reports an unavailable Runtime when the API cannot be reached", async () => {
    process.env.TOOLHIVE_API_BASE_URL = "http://runtime.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );

    await expect(listRuntimeWorkloads()).resolves.toMatchObject({
      ok: false,
      kind: "unavailable",
    });
  });
});
