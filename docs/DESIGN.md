# Design decisions

This document records the decisions in the current code and the reason for each one. Other documents own the details:

- [`docs/API.md`](API.md): the tool and resource contract.
- [`docs/MCP-2026-07-28.md`](MCP-2026-07-28.md): the wire-level protocol behavior.
- [`docs/CLI.md`](CLI.md): direct CLI use.
- [`docs/TESTING.md`](TESTING.md): test layout and rules.
- `package.json` and `pnpm-lock.yaml`: the exact dependency versions.

## Structure

```text
MCP tools and resource ─┐
                        ├─> src/operations.ts ─> src/openrouter.ts ─> OpenRouter APIs
direct CLI commands ────┘
```

- `src/operations.ts` owns filtering, pagination envelopes, bounded comparison scheduling, completed-date selection and response shaping.
- `src/mcp.ts` validates MCP inputs and registers the fixed surface: 13 tools and one resource, `openrouter://usage`.
- `src/cli.ts` parses non-interactive commands and renders JSON or text. It exposes the same 13 operations plus `serve`.
- `src/openrouter.ts` owns HTTP, credentials, transport security, timeouts and upstream schema validation.
- `src/server.ts` starts the stdio or loopback HTTP transport.

Both adapters call the operations layer directly. The CLI does not call MCP through a subprocess, and the MCP adapter does not repeat business rules.

## No server-side state

MCP 2026-07-28 requests are self-contained: each one carries its protocol version, client information and client capabilities. The server keeps no state between requests. There is no conversation, job, pagination or generation registry.

When a value must survive between requests, the server returns an explicit handle. For example, `chat_with_model` returns the OpenRouter generation ID, and `get_generation` takes that ID in a later request.

## Modern protocol only

- `createMcpHandler` and `serveStdio` both get `legacy: "reject"`. The SDK default would keep a 2025 fallback.
- Tool registration passes `inputRequired: { legacyShim: false }`, so missing tool input is rejected instead of filled in.
- There is no downgrade, no `initialize` bridge and no alternate legacy endpoint.

**Why:** one protocol means one behavior to test. Two protocols at once give ambiguous results.

**Cost:** a client that sends `2025-11-25`, expects `initialize`, uses the old GET stream or omits the modern request metadata fails to connect. Clients must pin `2026-07-28`.

## Transports

- **Stdio** is the default. Stdout carries only MCP messages, and all logs go to stderr.
- **HTTP** binds only to `127.0.0.1` and serves only `POST /mcp`. The listening line reports the address the socket actually bound to. `GET /mcp` returns 405, and any other path returns 404. The Host and Origin headers must be loopback values, otherwise the server returns 403. Responses carry no `Mcp-Session-Id`.

The HTTP transport is for local use. It has no TLS, OAuth, reverse-proxy trust, multi-tenant authorization or public ingress. A remote deployment needs those at a separate boundary.

## Cache hints

- `server/discover`, `tools/list`, `resources/list` and `resources/templates/list` return a public one-hour hint (`ttlMs: 3600000`, `cacheScope: "public"`).
- `openrouter://usage` returns a private five-second hint, because it describes the configured key.

The server keeps no cache of its own. Every usage read calls OpenRouter.

## Credentials

`src/openrouter.ts` has three authentication modes:

| Mode | Operations | Header |
|---|---|---|
| `none` | model list, exact model, model endpoints, providers | never sends `Authorization`, even when a key is set |
| `api` | rankings, chat, comparison, generation metadata, usage resource | requires `OPENROUTER_API_KEY` |
| `management` | credits, activity, analytics schema, analytics query | uses `OPENROUTER_MANAGEMENT_KEY`, falling back to `OPENROUTER_API_KEY` |

The fallback exists so a real management key can be put in either variable. It does not give an inference key management rights: OpenRouter decides the key's scope.

Discovery works without a key today. That is observed OpenRouter behavior, not a documented guarantee. If OpenRouter starts requiring a key, the `none` operations fail until this mode changes.

Rankings data has source-attribution rules in the OpenRouter reference. A UI or report that shows it must keep the attribution.

## Limits

- **Pagination.** `list_models` sends its limit and offset to OpenRouter. Endpoints, providers and activity fetch the full upstream array, then filter and return a page of 1 to 100. The response is bounded, but the upstream transfer is not.
- **Comparison.** `compare_models` takes 2 to 8 unique models and runs at most 3 calls at once. It never retries a paid call, so a failure cannot cause a duplicate charge.
- **Rankings.** Model rankings default to the last completed UTC day, not the current partial day. App rankings request `limit + 1` to detect a next page. At the upstream maximum of 100 there is no extra row, so `next_offset` cannot be detected.
- **Analytics.** `query_analytics` requires an explicit UTC range and allows 1 to 50 metrics, at most 2 dimensions and at most 20 filters, with row and group limits of 10,000. These caps stop accidental large queries. They do not make every allowed query cheap.

## Failure handling

- **Schema drift.** Zod validates the known required fields. Extra upstream fields are ignored. A missing required field or a field with a different type fails validation.
- **Cancellation and timeouts.** Every upstream call combines the MCP request signal with a local `AbortController`. `OPENROUTER_TIMEOUT_MS` sets the timeout, which defaults to 60,000 ms. Cancellation and timeout produce different errors.
- **Errors.** Upstream error bodies are reduced to one line of at most 1,000 characters. Errors carry the HTTP status and the upstream message, never the URL or a credential. Tests check this with sentinel keys.
- **Base URL.** `OPENROUTER_BASE_URL` must use HTTPS. Plain HTTP is allowed only for `localhost`, `127.0.0.1` and `[::1]`. A URL with embedded credentials is rejected.

## Dependencies

- Every dependency is pinned to an exact version. There are no ranges and no `latest`.
- The project uses pnpm only. `devEngines.packageManager` makes `npm install`, `npm ci` and `npm run` fail.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (72 hours), `trustPolicy: no-downgrade` and `blockExoticSubdeps: true`. Only `esbuild@0.28.2` may run an install script.
- The OpenRouter client uses native Node `fetch`. There is no Axios or OpenRouter SDK.
- The package requires Node.js 24 or newer.
- The published `files` list is `dist`, `docs`, `examples`, `.env.example` and `README.md`. Source, tests and `.env` are not packed.

## Upgrading from 2.x

3.0.0 is a breaking release:

- Clients must use MCP `2026-07-28`. The legacy handshake and fallback are rejected.
- `get_model_info` is removed with no alias. Use `get_model`.
- Inference inputs use `max_completion_tokens`. `max_tokens` is removed.
- `openrouter://models` and `openrouter://pricing` are removed. Use `list_models`, `get_model` and `list_model_endpoints`.
- `openrouter://usage` returns real data. It needs a valid inference key and calls the current-key endpoint.
- Provider, ranking, credit, activity, analytics and generation operations are new. Each one needs the credential listed in the table above.
- HTTP GET is not a subscription channel. Only `POST /mcp` is served.
- The `openrouter-mcp` CLI is new. The `openrouter-mcp-server` stdio entry point still works.
- Node.js 24 or newer is required.

Clients should discover tools and resources at runtime instead of assuming the old lists.

## Known limits

- No test proves a successful inference-key or management-key flow. The live contract (`pnpm run test:live`) needs real keys and is not part of CI.
- No paid chat call runs in tests. The no-retry rule for paid calls is covered by code and offline tests only.
- The server is tested with the official MCP client package, not with every Claude desktop, web or Code release.
- The package is not published to npm. The name `openrouter-mcp-server` on npm belongs to a different project.
