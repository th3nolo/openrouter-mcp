# Stateless MCP 2026-07-28 overhaul

Status: implementation and local verification note for the 3.0.0 release reviewed on 2026-08-31 in America/Caracas (2026-09-01 UTC).

This note separates four kinds of claims:

- **Upstream fact**: stated by an official MCP, Anthropic, OpenRouter, Node.js, npm, or pnpm source.
- **Implementation decision**: behavior selected by this repository. It may be stricter than the upstream protocol.
- **Local verification**: observed in this checkout on the date above.
- **Remaining limitation**: not proved locally, intentionally unsupported, or dependent on external state.

## Executive summary

MCP 2026-07-28 changes the normal server interaction from a connection-level initialization lifecycle to self-contained requests. Each modern request carries its protocol version, client identity, and capabilities. HTTP remains one POST endpoint, with either a JSON response or request-scoped server-sent events. The old long-lived GET event stream and session identifier are not part of the modern core. See the [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/) and [transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).

The current workspace implements that protocol as a strict boundary. It rejects the SDK's legacy fallback on both HTTP and stdio. It also disables the compatibility shim for missing tool input. This is a repository policy, not a protocol requirement.

The OpenRouter integration now has two thin adapters over one operations layer:

```text
MCP tools and resource ─┐
                       ├─> bounded operations ─> OpenRouter HTTP client ─> OpenRouter APIs
direct CLI commands ───┘
```

The MCP surface has 13 fixed tools and one fixed resource, `openrouter://usage`. The CLI exposes the same 13 operations plus `serve`. No server-side conversation, job, or pagination session is needed between requests.

Local source checks, type checks, lint, unit and integration-style tests, builds, built-entry handshakes, and package dry runs pass. Anonymous live discovery passed for the model catalog, one exact model endpoint, and the provider list. Valid inference-key and management-key behavior was not proved because the available authenticated paths returned 401 or were not configured.

## 1. What MCP 2026-07-28 changed

### Stateless request metadata

**Upstream fact.** The 2026-07-28 core removes the required `initialize` / `initialized` exchange from the normal modern flow. Every request carries protocol version, client information, and client capabilities. `Mcp-Session-Id` is not part of the modern request contract. A server can expose optional `server/discover` metadata. The release calls out explicit handles when application state must survive across requests. See [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/).

**Implementation decision.** This server keeps cross-request state out of the MCP process. A paid chat call returns the OpenRouter generation ID. `get_generation` accepts that explicit ID later. The server does not retain a hidden conversation or generation registry. See [`src/operations.ts`](../src/operations.ts) and [`src/mcp.ts`](../src/mcp.ts).

### Request-response HTTP

**Upstream fact.** Streamable HTTP sends each MCP message to one endpoint with POST. A server can return a single JSON response or use server-sent events for that request. The modern core does not allow server-initiated requests. Cancellation closes the HTTP response stream; stdio uses a cancellation notification. See the [2026-07-28 transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).

**Implementation decision.** The local HTTP transport binds only to `127.0.0.1`, accepts MCP POST requests at `/mcp`, validates Host and Origin, and returns 405 to GET. There is no legacy GET event stream. Stdio remains the default. See [`src/server.ts`](../src/server.ts).

### Discovery and cache hints

**Upstream fact.** The protocol defines `ttlMs` and `cacheScope` hints for discovery and resource results. `public` means the response is not user-specific. `private` means it can contain user-specific data. The TTL is a reuse hint, not a correctness guarantee. See [MCP caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching).

**Implementation decision.** `server/discover`, `tools/list`, `resources/list`, and `resources/templates/list` receive a public one-hour cache hint. `openrouter://usage` receives a private five-second cache hint because it describes the configured API key. The usage value is still fetched on resource read; the server does not keep its own cache.

### Claude adoption

**Upstream fact.** Anthropic announced a rollout of MCP 2026-07-28 across Claude products. That announcement is evidence of adoption work, not proof that every Claude client version already speaks only the new protocol. See [Bringing MCP 2026-07-28 to Claude](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude) and the [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

**Remaining limitation.** This checkout was exercised with the official MCP 2.0.0 client package. It was not connected end to end to every Claude desktop, web, or Code release.

## 2. Repository chronology and the old behavior

The history has three distinct states. Keeping them separate matters because the strict protocol fallback removal landed before the larger 3.0.0 API and CLI expansion.

### Original implementation — before `1d6d2ad`

- **Protocol and transport:** Connection-oriented legacy SDK over stdio only.
- **OpenRouter surface:** Four tools: `list_models`, `chat_with_model`, `compare_models`, and `get_model_info`; three resources: models, pricing, and usage.
- **Main constraints:** Monolithic server file; Axios; full-catalog lookup; `Promise.all` comparison fan-out; `max_tokens`; placeholder usage data.

### Committed 2.0.0 — `de90005`

- **Protocol and transport:** Stateless 2026-07-28 server over HTTP and stdio. The SDK fallback was already set to `legacy: "reject"`.
- **OpenRouter surface:** Four modern tools and three resources.
- **Main constraints:** The modern protocol core was in place, but the API surface was smaller and compatibility names and resources remained.

### 3.0.0 release workspace

- **Protocol and transport:** The same strict protocol policy, with the compatibility shim disabled and stronger transport checks.
- **OpenRouter surface:** 13 tools, one resource, and a direct CLI over shared operations.
- **Main constraints:** This is a deliberate breaking migration. Authenticated OpenRouter paths still need live credentials.

**Local verification.** `git show` confirms the original four tool names, three resource URIs, Axios-based client, `StdioServerTransport`, `max_tokens`, and unbounded `Promise.all` comparison. The current branch history is `1d6d2ad` for the stateless overhaul, `a8da369` for legacy fallback removal, and `de90005` for pricing parsing. No history was rewritten during this review.

## 3. Strict modern-only policy

**Upstream fact.** The MCP TypeScript 2.0 migration guidance says `createMcpHandler` can serve modern requests while retaining a legacy 2025 fallback by default. `serveStdio` can also support the legacy path. Passing `legacy: "reject"` makes either boundary modern-only. Setting `inputRequired.legacyShim` to `false` rejects missing input instead of applying the old shim. See the [TypeScript SDK 2026-07-28 migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28).

**Implementation decision.** Both adapters pass `legacy: "reject"`. Tool registration passes `inputRequired: { legacyShim: false }`. There is no automatic downgrade, initialization bridge, or alternate legacy endpoint.

**Migration consequence.** A client that starts with protocol `2025-11-25`, expects `initialize`, uses the old GET stream, or omits modern request metadata will fail. The local verifier reproduced this rejection when it used the MCP client's legacy default. Pinning the client to `2026-07-28` made both built stdio entry points pass.

This strictness reduces ambiguous dual-protocol behavior. It also makes the compatibility break immediate. Operators must upgrade or correctly configure clients before replacing a 2.x deployment.

## 4. Shared operations layer and direct CLI

**Implementation decision.** [`src/operations.ts`](../src/operations.ts) owns filtering, pagination envelopes, bounded comparison scheduling, completed-date selection, and response shaping. [`src/mcp.ts`](../src/mcp.ts) validates MCP inputs and registers the fixed MCP surface. [`src/cli.ts`](../src/cli.ts) parses non-interactive commands and renders JSON or human text. [`src/openrouter.ts`](../src/openrouter.ts) owns HTTP, credentials, transport security, timeouts, and upstream schema validation.

This separation prevents the CLI from calling MCP through a subprocess and prevents the MCP adapter from duplicating business rules. Both adapters call the same operations directly.

The CLI never prompts. It selects JSON when stdout is not a terminal or when `--json` is present. Diagnostics and structured errors go to stderr. Exit codes are 0 for success, 1 for an operation failure, and 2 for invalid usage. `schema --json` describes all 14 commands, their authentication class, risk class, options, output contract, and environment variables.

## 5. Fixed MCP surface

The tool list is fixed and ordered. It is not generated from upstream data.

### Discovery — no credential

- **`list_models`** — Upstream model pagination and filters, with a limit of 1-100 and a non-negative offset.
- **`get_model`** — Exact `author/slug` model lookup.
- **`list_model_endpoints`** — Exact model endpoint list, followed by a local provider filter and a page of 1-100.
- **`list_providers`** — Provider discovery, local filters, and a page of 1-100.

### Rankings — API key

- **`list_model_rankings`** — One day by default and a maximum of 50 rows. The aggregate `other` row is excluded unless requested.
- **`list_app_rankings`** — Popular or trending apps, with a maximum of 100 rows and an offset capped at 100.

### Account — management key

- **`get_credits`** — Purchased, used, and calculated remaining credits.
- **`list_activity`** — Activity filters plus a local page of 1-100.
- **`get_analytics_schema`** — Available analytics metrics, dimensions, filters, and classifiers.
- **`query_analytics`** — Explicit UTC range; 1-50 metrics; at most two dimensions; at most 20 filters; result and group limits capped at 10,000.

### Inference — API key

- **`chat_with_model`** — One paid chat call using `max_completion_tokens`.
- **`compare_models`** — Two to eight unique paid calls, with at most three active at once.

### Generation — API key

- **`get_generation`** — Fetch metadata for one explicit generation ID.

The one resource is `openrouter://usage`. It calls the current-key endpoint and is private, short-lived account data. The 3.0.0 surface removes the bulk `openrouter://models` and `openrouter://pricing` resources. Discovery now uses bounded tools. There are no resource templates.

## 6. OpenRouter API coverage and credential boundaries

OpenRouter documents separate catalog, inference-key, and management-key concerns across its [models guide](https://openrouter.ai/docs/guides/overview/models), [provider endpoint](https://openrouter.ai/docs/api/api-reference/providers/list-providers), [model rankings](https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily), [app rankings](https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings), [credits](https://openrouter.ai/docs/api/api-reference/credits/get-credits), [activity](https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity), [analytics schema](https://openrouter.ai/docs/api/api-reference/beta-analytics/get-analytics-meta), [analytics query](https://openrouter.ai/docs/api/api-reference/beta-analytics/query-analytics), and [generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-generation).

**Implementation decision.** The HTTP client has three explicit authentication modes:

### No credential (`none`)

- **Operations:** Model list, exact model, model endpoints, and providers.
- **Header behavior:** Never sends `Authorization`, even when a key is configured.

### Inference credential (`api`)

- **Operations:** Rankings, chat, comparison, generation metadata, and the usage resource.
- **Header behavior:** Requires `OPENROUTER_API_KEY`.

### Management credential (`management`)

- **Operations:** Credits, activity, analytics schema, and analytics query.
- **Header behavior:** Uses `OPENROUTER_MANAGEMENT_KEY`. It falls back to `OPENROUTER_API_KEY` only so an actual management key can be supplied in either variable.

The fallback does not grant management permissions to an ordinary inference key. OpenRouter still decides the key's scope.

**Local verification.** Anonymous calls succeeded for the catalog, one exact model endpoint, and providers. The current implementation therefore omits credentials from those routes by design.

**Remaining limitation.** Some OpenRouter endpoint reference pages display bearer authentication for catalog endpoints even though anonymous calls worked during this dated check. Anonymous discovery is recorded here as observed behavior, not as a durable upstream guarantee. A future upstream policy change could require credentials and would make these operations fail until this policy is revised.

Rankings data also carries source-attribution requirements in the OpenRouter reference. A downstream UI or report must preserve the required source attribution; returning the data through MCP does not waive it.

## 7. Bounds, failure handling, and transport safety

### Pagination and work limits

**Implementation decision.** `list_models` passes its limit and offset to OpenRouter, so the upstream request is bounded. Endpoints, providers, and activity currently fetch the endpoint's returned array and then apply local filters and a bounded slice. Their response is bounded, but their upstream transfer is not true cursor pagination. This difference is intentional and documented rather than hidden.

Comparison accepts two to eight unique model IDs. A small worker pool caps active requests at three. The operation does not automatically retry a paid call. This avoids accidental duplicate charges and unbounded fan-out.

Model rankings default to the most recent completed UTC day rather than the incomplete current day. App rankings request `limit + 1` when the requested limit is below 100, then omit the extra row and return `next_offset`. At the maximum limit of 100, the upstream cap leaves no look-ahead row.

Analytics requires an explicit UTC start and end. The schema caps metrics, dimensions, ordinary filters, classifier structures, rows, and group rows. These input limits reduce accidental high-cardinality queries. They do not guarantee that an allowed query is cheap or accepted by OpenRouter.

### Schema drift

**Implementation decision.** Zod validates known required response fields. Upstream response wrappers use permissive handling so additive vendor fields are ignored rather than treated as breakage. Known fields with incompatible types still fail validation. This is forward-tolerant for additions, not for semantic changes or removed required fields.

### Cancellation and timeouts

**Implementation decision.** Every upstream call composes the MCP request signal with a local `AbortController`. Client cancellation aborts the OpenRouter fetch. A configurable positive `OPENROUTER_TIMEOUT_MS` defaults to 60,000 ms. Cancellation and timeout errors are distinguished.

### Errors and secrets

**Implementation decision.** Error bodies are collapsed to one line and bounded to the first 1,000 characters plus an ellipsis when truncated. The error includes the HTTP status and an upstream message when present. URLs and bearer credentials are not included. Tests use sentinels to check that configured keys do not appear in surfaced errors.

### HTTPS and local HTTP

**Implementation decision.** `OPENROUTER_BASE_URL` must use HTTPS. Plain HTTP is allowed only for `localhost`, `127.0.0.1`, or `[::1]` test and development targets. Credentials embedded in a URL are rejected. The local MCP HTTP listener also binds only to `127.0.0.1` and validates Host and Origin.

**Remaining limitation.** This is not a remote production HTTP deployment. It does not implement TLS termination, OAuth, reverse-proxy trust, multi-tenant authorization, or public ingress. Those concerns must be designed at a separate deployment boundary.

## 8. Packaging and supply-chain controls

**Implementation decision.** The package requires Node.js 24 or newer and declares `pnpm@12.0.0`. Runtime dependencies are pinned exactly: `@modelcontextprotocol/node@2.0.0`, `@modelcontextprotocol/server@2.0.0`, `dotenv@17.4.2`, and `zod@4.5.1`. The MCP client and all development tools are also exact pins. No `latest` or version range is used.

The workspace policy sets:

- a 4,320-minute minimum release age, equal to 72 hours;
- `trustPolicy: no-downgrade`;
- `blockExoticSubdeps: true`;
- one allowed install-time build, `esbuild@0.28.2`.

The lockfile preserves exact resolutions and integrity data. It also pins the declared pnpm package-manager dependency and its platform executables. Native Node `fetch` avoids adding Axios or an OpenRouter SDK to the new shared client.

**Local verification.** The npm registry identity for `pnpm@12.0.0`, its repository, Node engine, integrity, signatures, and attestations were checked during this task. The release timestamp was 2026-08-26T15:12:06.912Z. At the UTC verification time it was about 127.6 hours old, beyond the 72-hour policy.

The package `files` allowlist contains only `dist`, `docs`, `examples`, `.env.example`, and `README.md`. The final `pnpm@12.0.0 pack --dry-run` listed 18 files: the public configuration example, built JavaScript and declarations, four docs including this note, one example, `package.json`, and `README.md`. Source, tests, local `.env`, Git metadata, and unrelated workspace files were absent.

**Local verification from the preceding package check.** A generated tarball was previously installed into an isolated temporary directory with the already-available pnpm 11 runtime, offline and with scripts disabled. Both Windows command shims, the CLI schema, server help, and the modern protocol surface worked. This turn did not repeat that install because the current task forbids dependency installation.

**Remaining limitation.** An exact-pnpm-12 attempt to add the local Windows tarball to a temporary project did not reach package installation. pnpm parsed absolute, `file:`, and relative tarball forms as registry package names and returned a resolver error. The same exact pnpm version successfully builds and packs this repository. The blocker is recorded as a Windows local-spec parser or invocation compatibility issue, not proof that the tarball is defective. No package was published.

## 9. Migration and expected breakage

This is a major-version migration. The following changes are intentional:

- Protocol clients must use MCP `2026-07-28`; the legacy handshake and fallback are rejected.
- The legacy `get_model_info` name is not kept as an alias. Use `get_model`.
- Inference inputs use `max_completion_tokens`; the `max_tokens` compatibility name is removed.
- `openrouter://models` and `openrouter://pricing` are removed. Use `list_models`, `get_model`, and `list_model_endpoints`.
- Usage is no longer placeholder data. `openrouter://usage` requires a valid inference API key and calls the current-key endpoint.
- Provider, ranking, credit, activity, analytics, and generation metadata operations add new upstream dependencies and credential scopes.
- `OPENROUTER_API_KEY` is for inference-key operations. `OPENROUTER_MANAGEMENT_KEY` is the explicit management boundary.
- HTTP GET is not a subscription channel. Only POST `/mcp` is served.
- The direct `openrouter-mcp` CLI is non-interactive and shares the MCP operations. Existing `openrouter-mcp-server` stdio usage remains available.
- The package requires Node.js 24 or newer.

Clients should discover tools and resources instead of assuming the old lists. Automated consumers should also update snapshots for the new output envelopes, pagination fields, generation handles, and credential-specific errors.

## 10. Validation record

All local commands used the existing checkout and dependency graph. No dependency was added or updated.

### Repository and source review

- **Full release-tree review — Pass**
  - **Proves:** Every changed and newly added source, test, and doc file was read before this note was finalized.
  - **Does not prove:** Correctness of unrelated future edits.
- **Historical `git show` comparison — Pass**
  - **Proves:** The original monolith, 2.0.0 strict transition, and current 3.0.0 changes are distinguishable.
  - **Does not prove:** Remote branch changes after this date.
- **Tracked `git diff --check` plus note whitespace and conflict-marker scan — Pass**
  - **Proves:** No detected whitespace errors or merge markers in the reviewed change set.
  - **Does not prove:** Markdown semantics or external link availability.

### Build, test, and package checks

- **`pnpm@12.0.0 run check` — Pass**
  - **Proves:** Type checks, ESLint, tests, and the build pass with the declared package manager.
  - **Does not prove:** External service credentials or deployment.
- **Test suite — 22 total: 21 pass, 1 live-only skip, 0 fail**
  - **Proves:** The fixed surface, cache hints, strict rejection, operations, bounds, cancellation, security checks, CLI contract, and built entry points.
  - **Does not prove:** OpenRouter account-scoped success.
- **Built CLI `schema --json` — Pass on host**
  - **Proves:** CLI version 3.0.0, protocol 2026-07-28, 14 command descriptions, and the output contract load from `dist`.
  - **Does not prove:** Every command against live OpenRouter.
- **Built server `--help` — Pass on host**
  - **Proves:** The packaged server entry loads and exposes stdio and HTTP options.
  - **Does not prove:** Long-running production operation.
- **Built stdio handshake: `dist/server.js` — Pass on host**
  - **Proves:** The modern protocol, 13 tools, and `openrouter://usage` load from the server binary.
  - **Does not prove:** Legacy compatibility, which is intentionally rejected.
- **Built stdio handshake: `dist/cli.js serve` — Pass on host**
  - **Proves:** The hybrid CLI entry reaches the same modern MCP surface.
  - **Does not prove:** Remote HTTP ingress.
- **`pnpm@12.0.0 pack --dry-run` — Pass, 18 files**
  - **Proves:** This note is included, while the allowlist excludes source, tests, `.env`, and workspace material.
  - **Does not prove:** Installability in every package manager and operating system combination.

### Live contracts

- **Anonymous live contract — Partial pass**
  - **Proves:** Protocol 2026-07-28; 425 catalog models; sampled `ibm-granite/granite-4.2-8b` with one endpoint; 105 providers.
  - **Does not prove:** Stable counts, later availability of that sample, or authenticated behavior.
- **Inference-key live contract — Failed with HTTP 401 `User not found`**
  - **Proves:** The failure is bounded and reported without exposing a key.
  - **Does not prove:** Successful rankings, chat, comparison, usage, or generation metadata.
- **Management-key live contract — Skipped because no management key was configured**
  - **Proves:** The test respects the credential boundary.
  - **Does not prove:** Credits, activity, analytics schema, or analytics query success.

Live counts are a 2026-08-31 America/Caracas snapshot and can change at any time. The live command exits nonzero when an authenticated phase fails, even though the public discovery phase passes.

## 11. Known limits and release boundary

- No valid OpenRouter inference-key flow was proved end to end in this run.
- No management-key flow was exercised.
- No paid chat call was made, so duplicate-charge avoidance is supported by code and tests, not a live billing observation.
- No real Claude product was used for the final handshake.
- No public HTTP service, TLS endpoint, OAuth flow, container, or deployment was created.
- Anonymous discovery behavior can change upstream despite the dated live success.
- Provider, endpoint, and activity response pages are locally bounded after an upstream array fetch; they are not all true upstream cursor pages.
- App-ranking pagination cannot infer another page when the requested limit is the upstream maximum of 100 because no look-ahead row is available.
- Cache TTLs are hints. A client can refetch earlier, and account data can change within five seconds.
- Additive OpenRouter response fields are tolerated, but removed or incompatible required fields still cause validation errors.
- Exact-pnpm-12 local tarball installation on Windows remains blocked at local package-spec resolution; exact-pnpm-12 build and pack checks pass.
- This note records local release verification. It does not claim npm publication or production deployment.

The release boundary is therefore clear: the repository is locally buildable, testable, and packable as a strict stateless MCP and direct CLI implementation. Authenticated OpenRouter success, real Claude-client compatibility, cross-platform tarball installation with the declared pnpm version, and production deployment remain separate gates.
