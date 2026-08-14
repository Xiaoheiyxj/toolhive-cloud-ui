import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect, test } from "./fixtures";

const TOOLHIVE_API_BASE_URL = process.env.TOOLHIVE_API_BASE_URL;
const CONTAINER_NAME = "phase4c-ui-container";
const REMOTE_NAME = "phase4c-ui-remote";
const REMOTE_FIXTURE_URL = "http://127.0.0.1:19610/mcp";

async function mcpCall(
  request: APIRequestContext,
  endpoint: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
) {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  let response: APIResponse | undefined;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      response = await request.post(endpoint, {
        headers,
        data: { jsonrpc: "2.0", id, method, params },
      });
      break;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!response)
    throw new Error(`MCP request did not produce a response: ${endpoint}`);
  expect(response).toBeOK();
  return {
    body: await response.text(),
    sessionId: response.headers()["mcp-session-id"] ?? sessionId,
  };
}

test("creates Container and Remote workloads and calls both proxies", async ({
  authenticatedPage,
  request,
}, testInfo) => {
  if (!TOOLHIVE_API_BASE_URL) {
    throw new Error(
      "TOOLHIVE_API_BASE_URL is required for Runtime create E2E.",
    );
  }

  const diagnostics: string[] = [];
  const runtimeRequests: Array<{
    method: string;
    url: string;
    status: number;
  }> = [];
  authenticatedPage.on("console", (message) => {
    if (message.type() === "error")
      diagnostics.push(`console: ${message.text()}`);
  });
  authenticatedPage.on("pageerror", (error) => {
    diagnostics.push(`pageerror: ${error.message}`);
  });
  authenticatedPage.on("requestfailed", (requestEvent) => {
    diagnostics.push(
      `requestfailed: ${requestEvent.method()} ${requestEvent.url()} ${requestEvent.failure()?.errorText ?? "unknown"}`,
    );
  });
  authenticatedPage.on("response", (response) => {
    if (response.url().endsWith("/api/runtime/workloads")) {
      runtimeRequests.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
      });
    }
  });

  const runtimeUrl = new URL(TOOLHIVE_API_BASE_URL);
  const invalid = await request.post(
    new URL("/api/v1beta/workloads", runtimeUrl).toString(),
    { data: {} },
  );
  runtimeRequests.push({
    method: "POST",
    url: invalid.url(),
    status: invalid.status(),
  });
  expect(invalid.status()).toBe(400);

  await authenticatedPage.goto("/runtime/workloads/new");
  await expect(
    authenticatedPage.getByRole("heading", { name: "Create Runtime Workload" }),
  ).toBeVisible();
  await authenticatedPage.getByLabel("Workload name").fill(CONTAINER_NAME);
  await authenticatedPage
    .getByLabel("Container image")
    .fill("docker.io/mcp/filesystem:1.0.2");
  await authenticatedPage
    .getByLabel("Command arguments (optional, one per line)")
    .fill("/projects");
  await authenticatedPage
    .getByLabel("Volume mounts (optional, one per line)")
    .fill("/tmp:/projects:ro");
  await authenticatedPage.getByLabel("Disable network isolation").check();
  await authenticatedPage
    .getByRole("button", { name: "Create workload" })
    .click();
  await authenticatedPage.waitForURL(
    new RegExp(`/runtime/workloads/${CONTAINER_NAME}$`),
  );
  await expect(authenticatedPage.getByTestId("runtime-detail-type")).toHaveText(
    "Workload type: Container",
  );
  await expect(
    authenticatedPage.getByTestId("runtime-detail-endpoint"),
  ).toHaveText(/\/mcp$/);
  const containerEndpoint = await authenticatedPage
    .getByTestId("runtime-detail-endpoint")
    .innerText();
  const containerStatus = await request.get(
    new URL(
      `/api/v1beta/workloads/${CONTAINER_NAME}/status`,
      runtimeUrl,
    ).toString(),
  );
  runtimeRequests.push({
    method: "GET",
    url: containerStatus.url(),
    status: containerStatus.status(),
  });
  expect(containerStatus).toBeOK();
  expect(await containerStatus.json()).toEqual({ status: "running" });

  let containerMcp = await mcpCall(
    request,
    containerEndpoint,
    1,
    "initialize",
    {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "cloud-ui-e2e", version: "1" },
    },
  );
  expect(containerMcp.body).toContain("serverInfo");
  containerMcp = await mcpCall(
    request,
    containerEndpoint,
    2,
    "tools/list",
    {},
    containerMcp.sessionId,
  );
  expect(containerMcp.body).toContain("tools");
  containerMcp = await mcpCall(
    request,
    containerEndpoint,
    3,
    "tools/call",
    { name: "list_allowed_directories", arguments: {} },
    containerMcp.sessionId,
  );
  expect(containerMcp.body).toContain("content");

  await authenticatedPage.goto("/runtime/workloads/new");
  await authenticatedPage.getByRole("tab", { name: "Remote MCP" }).click();
  await authenticatedPage.getByLabel("Workload name").fill(REMOTE_NAME);
  await authenticatedPage.getByLabel("Remote MCP URL").fill(REMOTE_FIXTURE_URL);
  await authenticatedPage
    .getByRole("button", { name: "Create workload" })
    .click();
  await authenticatedPage.waitForURL(
    new RegExp(`/runtime/workloads/${REMOTE_NAME}$`),
  );
  await expect(authenticatedPage.getByTestId("runtime-detail-type")).toHaveText(
    "Workload type: Remote",
  );
  await expect(
    authenticatedPage.getByTestId("runtime-detail-endpoint"),
  ).toHaveText(/\/mcp$/);
  const remoteEndpoint = await authenticatedPage
    .getByTestId("runtime-detail-endpoint")
    .innerText();
  let remoteMcp = await mcpCall(request, remoteEndpoint, 1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "cloud-ui-e2e", version: "1" },
  });
  expect(remoteMcp.body).toContain("phase4c-remote-fixture");
  remoteMcp = await mcpCall(
    request,
    remoteEndpoint,
    2,
    "tools/list",
    {},
    remoteMcp.sessionId,
  );
  expect(remoteMcp.body).toContain("fixture_ping");
  remoteMcp = await mcpCall(
    request,
    remoteEndpoint,
    3,
    "tools/call",
    { name: "fixture_ping", arguments: {} },
    remoteMcp.sessionId,
  );
  expect(remoteMcp.body).toContain("remote-fixture-pong");

  const duplicate = await request.post(
    new URL("/api/v1beta/workloads", runtimeUrl).toString(),
    {
      data: {
        name: CONTAINER_NAME,
        image: "docker.io/mcp/filesystem:1.0.2",
        transport: "stdio",
      },
    },
  );
  runtimeRequests.push({
    method: "POST",
    url: duplicate.url(),
    status: duplicate.status(),
  });
  expect(duplicate.status()).toBe(409);

  console.log(
    `[runtime-create-e2e] ${JSON.stringify({
      toolhiveApiBaseUrl: TOOLHIVE_API_BASE_URL,
      runtimeRequests,
      container: {
        name: CONTAINER_NAME,
        endpoint: containerEndpoint,
        mcp: "initialize/tools/list/tools/call PASS",
      },
      remote: {
        name: REMOTE_NAME,
        endpoint: remoteEndpoint,
        mcp: "initialize/tools/list/tools/call PASS",
      },
      diagnostics,
    })}`,
  );
  await testInfo.attach("runtime-create-e2e-evidence.json", {
    body: JSON.stringify(
      { runtimeRequests, containerEndpoint, remoteEndpoint, diagnostics },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(
    diagnostics.filter(
      (diagnostic) =>
        !diagnostic.startsWith("requestfailed:") ||
        !diagnostic.includes("net::ERR_ABORTED"),
    ),
  ).toEqual([]);
});
