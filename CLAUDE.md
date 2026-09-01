# CLAUDE.md

## Commands

Use the project-pinned `pnpm@12.0.0`. Change dependencies only when the task requires it.

~~~bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run check
~~~

`pnpm start` runs the default stdio server. `pnpm run start:http` runs the loopback HTTP server.

## Code map

- `src/openrouter.ts` builds OpenRouter requests, validates responses, applies timeouts, and forwards cancellation.
- `src/mcp.ts` registers tools and resources, then creates the strict MCP `2026-07-28` handler.
- `src/server.ts` starts the stdio or loopback HTTP transport.
- `tests/mcp.test.ts` covers modern stateless HTTP, legacy rejection, stdio negotiation, failures, cancellation, and OpenRouter request shape.

The server implements only MCP `2026-07-28` with `@modelcontextprotocol/server@2.0.0`. Pass `{ legacy: "reject" }` to both `createMcpHandler` and `serveStdio`. Do not restore the SDK's default legacy fallback.

## Safety boundaries

- `stdout` belongs to MCP while stdio is active. Log only to `stderr`.
- Keep HTTP bound to `127.0.0.1` and retain `Host` and `Origin` validation.
- Do not claim static bearer-token checking is MCP OAuth.
- Pass `ctx.mcpReq.signal` to every upstream call.
- Chat and comparison can consume paid OpenRouter credits; their annotations must not describe them as read-only or idempotent.
- Never include OpenRouter credentials in output or errors.
- Do not add live paid API calls to tests.

See `docs/MCP-2026-07-28.md` for the exact protocol changes.
