# Testing guidelines

## Commands

~~~bash
pnpm run test                                         # offline suites: tests/*.test.ts
pnpm run check                                        # typecheck, lint, offline suites, build
pnpm pack --out contract-package.tgz && pnpm run test:smoke   # packed tarball, both transports
pnpm run test:live                                    # explicit live contract, needs .env
~~~

`pnpm run test` refuses to run when `.env` exists. Credentials belong only in the explicit live commands.

## Layout: one suite per transport

| File | What it covers |
|---|---|
| `tests/mcp.test.ts` | MCP handler and OpenRouter client, called in-process. No transport. |
| `tests/stdio-transport.test.ts` | Real `src/server.ts` and `src/cli.ts serve` over stdio. |
| `tests/http-transport.test.ts` | Real `src/server.ts` over loopback HTTP: `node:http`, the hono adapter, Host/Origin checks, routing, shutdown. |
| `tests/packaged-smoke.ts` | The packed tarball (`dist/`), both entry points, both transports. |
| `tests/support/` | Shared helpers. Not a suite. |

In-process tests call `handler.fetch()` directly. They do not go through `src/server.ts`. A transport is covered only when a test starts its real entry point as a child process.

## Every transport suite must check

1. **Startup output.** The listening line goes to stderr. Stdout stays empty, or carries only MCP messages for stdio.
2. **Modern handshake.** A client pinned to `2026-07-28` connects, and `tools/list` returns the exact tool names.
3. **Legacy rejection.** A client in `legacy` mode fails to connect.
4. **Transport boundaries.**
   - HTTP: listens only on `127.0.0.1` (checked in `/proc/net/tcp` and `/proc/net/tcp6` on Linux, skipped elsewhere), 404 outside `/mcp`, 403 for a foreign Host, 403 for a foreign Origin, 200 for loopback origins, no `Mcp-Session-Id`.
   - Stdio: malformed JSON returns JSON-RPC errors and does not corrupt stdout.
5. **Shutdown.** SIGTERM (HTTP) or EOF (stdio) exits with code 0 and frees the port or process.

The packaged smoke test repeats checks 2, 4 and 5 against `dist/` for each transport.

## Network rules

- `tests/offline-guard.mjs` is loaded into every test process and child process through `NODE_OPTIONS`.
- It allows path-based IPC, plus TCP and `fetch` to the literal addresses `127.0.0.1` and `::1` only.
- It blocks DNS names (including `localhost`), private ranges, public hosts and all TLS. A blocked call exits the process with code 1.
- HTTP tests must bind to a free `127.0.0.1` port (`startHttpServer` in `tests/support/http-server.ts`), never a fixed port.
- Use `rawRequest` from the same helper when a test must set the `Host` header. `fetch` cannot set it.
- No test may call paid OpenRouter endpoints. Chat and comparison tests use the fake API in `tests/mcp.test.ts`.

## When to run what

| Change | Run |
|---|---|
| `src/mcp.ts`, `src/openrouter.ts` | `pnpm run check` |
| `src/server.ts`, `src/cli.ts` | `pnpm run check` and the packaged smoke test |
| `@modelcontextprotocol/*`, `hono`, `@hono/node-server`, `zod` (including lockfile-only bumps) | `pnpm run check` and the packaged smoke test |

## Adding a transport

1. Add `tests/<name>-transport.test.ts` with the five checks above.
2. Add a packaged check for each entry point to `tests/packaged-smoke.ts`.
3. Add the file to the layout table in this document.

## Proving a new test works

Break the code it protects, run the suite, and confirm the test fails. Then revert. For example, removing `validateHost` from `src/server.ts` must fail "rejects a non-loopback Host header".
