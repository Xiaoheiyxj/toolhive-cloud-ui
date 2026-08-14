# Real Registry development and E2E baseline

This development path runs the Cloud UI with the repository's mock OIDC provider
and an unmodified upstream Registry Server `v1.5.1` backed by PostgreSQL. It is
separate from `pnpm dev`, which intentionally starts MSW for fast UI-only work.

## Start the upstream services

The Registry checkout must be the sibling baseline repository at
`../toolhive-registry-server` and be checked out at `v1.5.1`. The upstream
Compose file uses fixed container names. On a developer machine that already
has a stopped container with one of those names, the upstream command cannot
start even though the Registry source is healthy. Cloud UI therefore provides
the smallest allowed overlay: it includes the upstream Compose services but
uses isolated local names, ports, and a PostgreSQL volume. It does not copy or
modify Registry source.

Verify the sibling baseline and start the isolated standard path:

```bash
cd ../toolhive-registry-server
git rev-parse HEAD # expected: 4ca3b7b10f0e3d3ae9bb99489b5d5d1e78de0dca
git describe --tags --exact-match # expected: v1.5.1

cd ../toolhive-cloud-ui
corepack pnpm@10.33.0 dev:real-registry:up
docker compose -f docker-compose.yaml -f docker-compose.real-registry.yaml ps
curl --fail http://localhost:18081/v1/registries
curl --fail 'http://localhost:18081/registry/default/v0.1/servers?version=latest'
```

The upstream `config-docker.yaml` supplies the real `default` Registry and its
versioned fixture entries. PostgreSQL is provided by the same upstream Compose
stack. Stop it after the session with:

```bash
corepack pnpm@10.33.0 dev:real-registry:down
```

## Run the observable browser baseline

From the Cloud UI repository:

```bash
export REGISTRY_API_BASE_URL=http://localhost:18081
corepack pnpm@10.33.0 test:e2e:real-registry
```

`playwright.real-registry.config.mts` starts only mock OIDC and the standalone
Cloud UI server. It sets `API_BASE_URL` to `REGISTRY_API_BASE_URL` and rejects
the MSW default port `:9090`; it never probes or reuses an existing Cloud UI
server, and an occupied `BASE_URL` port fails before startup. The test verifies mock-OIDC login, rendered
Catalog, navigation to rendered Detail, and direct real Registry catalog/detail
request statuses. It also writes console errors, page errors, failed requests,
and Registry request/status evidence to the Playwright report attachment.

If another local Registry is already running, set `REGISTRY_API_BASE_URL` to
that service and set `REGISTRY_NAME` only when it intentionally uses a registry
other than `default`.

## Rule for future Runtime UI work

Before implementing each Runtime capability in this Fork, inspect
`stacklok/toolhive-studio@v0.39.4` for an equivalent or closely related
implementation and record the result in the PR. In particular, use Studio as an
implementation/API/UX reference for MCP Server management, Logs, Customize
Tools, Secrets, Client Integration, Groups, and Network Isolation. Studio is a
reference only and is not a V1 Fork target.
