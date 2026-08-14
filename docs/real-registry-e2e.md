# Real Registry development and E2E baseline

This development path runs the Cloud UI with the repository's mock OIDC provider
and an unmodified upstream Registry Server `v1.5.1` backed by PostgreSQL. It is
separate from `pnpm dev`, which intentionally starts MSW for fast UI-only work.

## Start the upstream services

The Registry checkout must be the sibling baseline repository at
`../toolhive-registry-server` and be checked out at `v1.5.1`. Start its existing
development stack without modifying its source:

```bash
cd ../toolhive-registry-server
git describe --tags --exact-match # expected: v1.5.1
docker compose up --build -d
curl --fail http://localhost:8080/v1/registries
```

The upstream `config-docker.yaml` supplies the real `default` Registry and its
versioned fixture entries. PostgreSQL is provided by the same upstream Compose
stack. Stop it after the session with `docker compose down`.

## Run the observable browser baseline

From the Cloud UI repository:

```bash
export REGISTRY_API_BASE_URL=http://localhost:8080
corepack pnpm@10.33.0 test:e2e:real-registry
```

`playwright.real-registry.config.mts` starts only mock OIDC and the standalone
Cloud UI server. It sets `API_BASE_URL` to `REGISTRY_API_BASE_URL` and rejects
the MSW default port `:9090`. The test verifies mock-OIDC login, rendered
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
