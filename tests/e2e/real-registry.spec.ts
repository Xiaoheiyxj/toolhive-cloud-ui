import { expect, test } from "./fixtures";

const REGISTRY_API_BASE_URL = process.env.REGISTRY_API_BASE_URL;
const REAL_REGISTRY_E2E = process.env.REAL_REGISTRY_E2E === "true";
const REGISTRY_NAME = process.env.REGISTRY_NAME || "default";
const SERVER_NAME = "io.github.stacklok/adb-mysql-mcp-server";
const SERVER_TITLE = "adb-mysql-mcp-server";
const SERVER_VERSION = "1.0.0";

interface DiagnosticEvent {
  kind: "console-error" | "pageerror" | "requestfailed";
  value: string;
}

/**
 * Validates the production Cloud UI path against a real upstream Registry.
 * The direct Registry requests are evidence for request/status diagnostics;
 * the Catalog and Detail assertions prove the rendered DOM consumes that data.
 */
test.describe("Real Registry Catalog and Detail", () => {
  test("renders the upstream fixture after mock OIDC login", async ({
    authenticatedPage,
    request,
  }, testInfo) => {
    if (!REAL_REGISTRY_E2E || !REGISTRY_API_BASE_URL) {
      throw new Error(
        "Real Registry E2E requires REAL_REGISTRY_E2E=true and REGISTRY_API_BASE_URL.",
      );
    }
    const diagnostics: DiagnosticEvent[] = [];
    const registryRequests: Array<{ url: string; status: number }> = [];

    authenticatedPage.on("console", (message) => {
      if (message.type() === "error") {
        diagnostics.push({ kind: "console-error", value: message.text() });
      }
    });
    authenticatedPage.on("pageerror", (error) => {
      diagnostics.push({ kind: "pageerror", value: error.message });
    });
    authenticatedPage.on("requestfailed", (requestFailure) => {
      diagnostics.push({
        kind: "requestfailed",
        value: `${requestFailure.method()} ${requestFailure.url()} ${requestFailure.failure()?.errorText ?? "unknown"}`,
      });
    });

    const registryUrl = new URL(REGISTRY_API_BASE_URL);
    const registriesResponse = await request.get(
      new URL("/v1/registries", registryUrl).toString(),
    );
    registryRequests.push({
      url: registriesResponse.url(),
      status: registriesResponse.status(),
    });
    expect(registriesResponse).toBeOK();

    const catalogResponse = await request.get(
      new URL(
        `/registry/${REGISTRY_NAME}/v0.1/servers?version=latest`,
        registryUrl,
      ).toString(),
    );
    registryRequests.push({
      url: catalogResponse.url(),
      status: catalogResponse.status(),
    });
    expect(catalogResponse).toBeOK();

    const detailResponse = await request.get(
      new URL(
        `/registry/${REGISTRY_NAME}/v0.1/servers/${encodeURIComponent(SERVER_NAME)}/versions/${SERVER_VERSION}`,
        registryUrl,
      ).toString(),
    );
    registryRequests.push({
      url: detailResponse.url(),
      status: detailResponse.status(),
    });
    expect(detailResponse).toBeOK();

    await authenticatedPage.goto(`/catalog?registryName=${REGISTRY_NAME}`);
    await expect(
      authenticatedPage.getByRole("heading", { name: "MCP Server Catalog" }),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(SERVER_TITLE)).toBeVisible();

    await authenticatedPage.getByText(SERVER_TITLE).first().click();
    await expect(authenticatedPage).toHaveURL(
      new RegExp(
        `/catalog/io\\.github\\.stacklok/adb-mysql-mcp-server/${SERVER_VERSION}`,
      ),
    );
    await expect(
      authenticatedPage.getByRole("heading", { name: SERVER_TITLE }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText(
        "Official MCP server for AnalyticDB for MySQL of Alibaba Cloud",
      ),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText(`v${SERVER_VERSION}`),
    ).toBeVisible();

    const evidence = {
      apiBaseUrl: REGISTRY_API_BASE_URL,
      realRegistryMode: REAL_REGISTRY_E2E,
      controlledWebServer: {
        command: "pnpm start:e2e:real-registry",
        reuseExistingServer: false,
      },
      registryRequests,
      diagnostics,
    };
    console.log(`[real-registry-e2e] ${JSON.stringify(evidence)}`);
    await testInfo.attach("real-registry-e2e-diagnostics.json", {
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
