import { expect, test } from "./fixtures";

const TOOLHIVE_API_BASE_URL = process.env.TOOLHIVE_API_BASE_URL;
const WORKLOAD_NAME = "phase4c-runtime-fixture";
const PROXY_ENDPOINT = "http://127.0.0.1:28190/mcp";

interface DiagnosticEvent {
  kind: "console-error" | "pageerror" | "requestfailed";
  value: string;
}

test.describe("ToolHive Runtime read-only workloads", () => {
  test("renders a real workload and its detail after mock OIDC login", async ({
    authenticatedPage,
    request,
  }, testInfo) => {
    if (!TOOLHIVE_API_BASE_URL) {
      throw new Error("TOOLHIVE_API_BASE_URL is required for Runtime E2E.");
    }

    const diagnostics: DiagnosticEvent[] = [];
    const runtimeRequests: Array<{ url: string; status: number }> = [];
    authenticatedPage.on("console", (message) => {
      if (message.type() === "error") {
        diagnostics.push({ kind: "console-error", value: message.text() });
      }
    });
    authenticatedPage.on("pageerror", (error) => {
      diagnostics.push({ kind: "pageerror", value: error.message });
    });
    authenticatedPage.on("requestfailed", (failedRequest) => {
      diagnostics.push({
        kind: "requestfailed",
        value: `${failedRequest.method()} ${failedRequest.url()} ${failedRequest.failure()?.errorText ?? "unknown"}`,
      });
    });

    const runtimeUrl = new URL(TOOLHIVE_API_BASE_URL);
    const listResponse = await request.get(
      new URL("/api/v1beta/workloads?all=true", runtimeUrl).toString(),
    );
    runtimeRequests.push({
      url: listResponse.url(),
      status: listResponse.status(),
    });
    expect(listResponse).toBeOK();
    expect((await listResponse.json()).workloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: WORKLOAD_NAME }),
      ]),
    );

    const statusResponse = await request.get(
      new URL(
        `/api/v1beta/workloads/${WORKLOAD_NAME}/status`,
        runtimeUrl,
      ).toString(),
    );
    runtimeRequests.push({
      url: statusResponse.url(),
      status: statusResponse.status(),
    });
    expect(statusResponse).toBeOK();
    expect(await statusResponse.json()).toEqual({ status: "running" });

    const detailResponse = await request.get(
      new URL(`/api/v1beta/workloads/${WORKLOAD_NAME}`, runtimeUrl).toString(),
    );
    runtimeRequests.push({
      url: detailResponse.url(),
      status: detailResponse.status(),
    });
    expect(detailResponse).toBeOK();
    expect(await detailResponse.json()).toEqual(
      expect.objectContaining({
        image: "docker.io/mcp/filesystem:1.0.2",
        proxy_port: 28190,
        name: WORKLOAD_NAME,
      }),
    );

    await authenticatedPage.goto("/runtime/workloads");
    await expect(
      authenticatedPage.getByRole("heading", { name: "Runtime Workloads" }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(WORKLOAD_NAME)).toBeVisible();
    await expect(authenticatedPage.getByText(PROXY_ENDPOINT)).toBeVisible();
    await expect(
      authenticatedPage.getByTestId("runtime-workload-status"),
    ).toHaveText("running");

    await authenticatedPage.getByText(WORKLOAD_NAME).first().click();
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/runtime/workloads/${WORKLOAD_NAME}`),
    );
    await expect(
      authenticatedPage.getByTestId("runtime-workload-detail"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("docker.io/mcp/filesystem:1.0.2"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId("runtime-detail-endpoint"),
    ).toHaveText(PROXY_ENDPOINT);
    await expect(authenticatedPage.getByText("streamable-http")).toBeVisible();

    await authenticatedPage.goto(`/runtime/workloads/${WORKLOAD_NAME}-missing`);
    await expect(
      authenticatedPage.getByTestId("runtime-error-not_found"),
    ).toBeVisible();

    const evidence = {
      toolhiveApiBaseUrl: TOOLHIVE_API_BASE_URL,
      controlledWebServer: {
        command: "pnpm start:e2e:real-registry",
        reuseExistingServer: false,
      },
      runtimeRequests,
      fixture: { name: WORKLOAD_NAME, endpoint: PROXY_ENDPOINT },
      diagnostics,
    };
    console.log(`[runtime-e2e] ${JSON.stringify(evidence)}`);
    await testInfo.attach("runtime-e2e-diagnostics.json", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    const unexpectedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.kind !== "requestfailed" ||
        !diagnostic.value.includes("net::ERR_ABORTED"),
    );
    expect(unexpectedDiagnostics).toEqual([]);
  });
});
