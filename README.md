# OpenRouter MCP server

This project connects agents to OpenRouter through two front doors: an agent-first command-line interface and a strict stateless MCP server. Both use the same operation layer and stable response shapes. The MCP server exposes thirteen focused tools and one API-key usage resource.

Version 3.0 targets MCP `2026-07-28` only. Each HTTP POST is independent. The server does not accept `initialize`, create `Mcp-Session-Id` sessions, expose a GET event stream, or run a legacy fallback.

Design notes and the reasoning behind the stateless `2026-07-28` surface are in the engineering note [Building a strict stateless MCP 2026-07-28 server for OpenRouter](https://th3nolo.com/articles/openrouter-stateless-mcp-2026-07-28). More notes and case studies: [th3nolo.com](https://th3nolo.com). Author: Manuel Parra.

## What changed in 3.0

- `list_models` sends pagination, filters, and sorting to OpenRouter instead of downloading the full catalog.
- `get_model` calls OpenRouter's direct model endpoint. It replaces `get_model_info`; there is no alias.
- `list_model_endpoints` returns provider price, context, uptime, latency, throughput, and supported parameters.
- `list_providers` exposes provider geography, policy links, and service-status metadata without a browser.
- `list_model_rankings` and `list_app_rankings` expose bounded versions of OpenRouter's public rankings pages.
- `get_credits` and `list_activity` expose account data with a separate management-key boundary.
- `get_analytics_schema` and `query_analytics` expose the current Activity Explore analytics contract with explicit time ranges and bounded results.
- `chat_with_model` and `compare_models` return a `generation_id` and the resolved model.
- `get_generation` uses that ID to fetch exact provider, token, latency, and cost metadata.
- The `openrouter-mcp` CLI exposes the same operations directly, emits JSON automatically when piped, and never prompts.
- Browser inspection informed the surface contract, but no browser, cookie, HAR file, or browser session is required at runtime.
- `openrouter://models` and `openrouter://pricing` were removed. Their unbounded catalog payloads are not retained as fallbacks.
- Unknown fields added by OpenRouter are stripped at the API boundary. The MCP output schemas remain stable.
- Static discovery responses declare a one-hour public cache hint. API-key usage remains private with a five-second hint.
- Model comparisons run at most three OpenRouter calls at once. Paid calls are never retried automatically.
- Custom OpenRouter base URLs must use HTTPS. Plain HTTP is accepted only for loopback development.

See [docs/API.md](docs/API.md) for the complete tool contract, [docs/CLI.md](docs/CLI.md) for direct CLI use, and [docs/MCP-2026-07-28.md](docs/MCP-2026-07-28.md) for wire-level behavior.

## Requirements

- Node.js 24 LTS
- pnpm 12.0.0, exactly as pinned in `package.json`
- An OpenRouter API key for rankings, inference, generation metadata, and key-usage data
- An OpenRouter management key for credit totals, account activity, and analytics

OpenRouter currently serves public model and provider discovery without a key. That anonymous behavior may be rate-limited or changed upstream.

## Install

~~~bash
git clone https://github.com/th3nolo/openrouter-mcp.git
cd openrouter-mcp
pnpm install
pnpm run check
~~~

`pnpm-workspace.yaml` waits 72 hours before resolving a release. It also blocks exotic transitive sources and trust downgrades. Only `esbuild@0.28.2` may run a dependency lifecycle script.

On Windows, `pnpm@12.0.0` does not carry an Authenticode signature. Windows may label it "Unknown publisher." Install it with a method from [pnpm's installation guide](https://pnpm.io/installation), and do not weaken Defender or PowerShell execution policy to suppress the warning.

Copy `.env.example` to `.env`, then set:

~~~dotenv
OPENROUTER_API_KEY=your_openrouter_api_key_here
# Optional; required only for get_credits and list_activity
OPENROUTER_MANAGEMENT_KEY=your_openrouter_management_key_here
~~~

Keep `.env` out of Git.

## Use the CLI

Build once, then call the same operations without starting an MCP client:

~~~bash
pnpm run build
node dist/cli.js schema
node dist/cli.js models list --q claude --limit 5
node dist/cli.js providers list --datacenter DE
node dist/cli.js rankings models --limit 10
node dist/cli.js account credits
node dist/cli.js analytics schema
~~~

Interactive terminals receive compact text or tables. Redirected output is JSON automatically; `--json` makes that behavior explicit. Diagnostics use `stderr`, usage failures exit with status 2, operation failures exit with status 1, and commands never prompt. Run the strict stateless server through the same binary with `node dist/cli.js serve --transport stdio`.

## Use with Claude over stdio

`stdio` is the default transport for local Claude integrations.

~~~bash
pnpm run build
claude mcp add --transport stdio --scope user \
  --env OPENROUTER_API_KEY=your_openrouter_api_key_here \
  openrouter -- node /absolute/path/to/openrouter-mcp/dist/server.js
~~~

The equivalent Claude Desktop configuration is in [examples/claude-config.json](examples/claude-config.json).

## Use with Claude over local HTTP

Start the loopback-only server:

~~~bash
pnpm run build
OPENROUTER_API_KEY=your_openrouter_api_key_here pnpm run start:http
~~~

On PowerShell:

~~~powershell
$env:OPENROUTER_API_KEY = "your_openrouter_api_key_here"
pnpm run start:http
~~~

Then register its URL:

~~~bash
claude mcp add --transport http --scope user openrouter http://127.0.0.1:3000/mcp
~~~

HTTP mode listens only on `127.0.0.1` and validates the `Host` and `Origin` headers. It does not implement a bearer-token shortcut.

Do not expose this listener directly to the internet. Put an HTTPS gateway that implements the MCP OAuth 2.1 resource-server flow in front of it.

## Tools

| Tool | Purpose | External effect |
| --- | --- | --- |
| `list_models` | Search, filter, sort, and page the live model catalog | Read-only OpenRouter request |
| `get_model` | Read one exact model, variant, or alias | Read-only OpenRouter request |
| `list_model_endpoints` | Compare the providers serving one model | Read-only OpenRouter request |
| `list_providers` | Filter providers by name, headquarters, or datacenter | Read-only public request |
| `list_model_rankings` | Read one completed UTC day of model rankings | Read-only API-key request |
| `list_app_rankings` | Read popular or trending public apps | Read-only API-key request |
| `get_credits` | Read purchased, used, and remaining credits | Read-only management request |
| `list_activity` | Read endpoint-level daily account activity | Read-only management request |
| `get_analytics_schema` | Discover current analytics metrics, dimensions, operators, and granularities | Read-only management request |
| `query_analytics` | Query bounded Activity Explore aggregates over an explicit time range | Read-only management request |
| `chat_with_model` | Generate one response and return its generation ID | Can consume API credits |
| `compare_models` | Generate with two to eight models, three calls at a time | Can consume API credits per model |
| `get_generation` | Read provider, tokens, latency, and cost for one generation ID | Read-only authenticated request |

Each tool returns a text block and `structuredContent`. Zod rejects invalid input before the handler runs. The SDK converts upstream failures into MCP tool errors.

## Resource

| URI | Data | Cache hint |
| --- | --- | --- |
| `openrouter://usage` | Usage and limits for the configured API key | Private, five seconds |

Model and pricing catalogs are tools rather than resources so every response can be filtered and bounded.

## Verify the live API

~~~bash
pnpm run test:live
~~~

The command always checks live model pagination, direct model lookup, model endpoints, and provider discovery. If `OPENROUTER_API_KEY` is configured, it also checks both ranking datasets, sends one short request through `openrouter/free`, and resolves the returned generation metadata. If `OPENROUTER_MANAGEMENT_KEY` is configured, it checks credits, bounded activity, analytics schema discovery, and a small seven-day analytics query. The report never prints a credential or generation ID.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | none | OpenRouter key for rankings, inference, generation metadata, and `openrouter://usage` |
| `OPENROUTER_MANAGEMENT_KEY` | `OPENROUTER_API_KEY` | OpenRouter management key for credits, account activity, and analytics |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | HTTPS OpenRouter API base URL; HTTP is loopback-only |
| `OPENROUTER_SITE_URL` | none | Optional `HTTP-Referer` app attribution |
| `OPENROUTER_APP_NAME` | `OpenRouter MCP Server` | `X-OpenRouter-Title` attribution |
| `OPENROUTER_TIMEOUT_MS` | `60000` | Per-request timeout |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HTTP_PORT` | `3000` | Local HTTP port |

Command-line `--transport` and `--port` values override their environment variables.

## Development

~~~bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build

# Complete release gate
pnpm run check
~~~

The deterministic tests cover modern HTTP without `initialize`, strict legacy rejection, real stdio negotiation, CLI schema output, cache hints, credential separation, upstream and local pagination, direct API routes, generation handles, comparison concurrency, cancellation, schema drift, bounded errors, and HTTPS enforcement. The live contract test is separate because it depends on current network and OpenRouter availability.

## Sources

- [OpenRouter MCP server](https://openrouter.ai/docs/guides/overview/mcp-server)
- [OpenRouter models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)
- [OpenRouter model endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model)
- [OpenRouter generation metadata API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)
- [OpenRouter TypeScript SDK endpoint functions](https://github.com/OpenRouterTeam/typescript-sdk/tree/main/src/funcs)
- [OpenRouter Analytics API](https://openrouter.ai/docs/api/api-reference/analytics/query-analytics-data)
- [OpenRouter analytics schema](https://openrouter.ai/docs/api/api-reference/analytics/get-available-analytics-metrics-and-dimensions)
- [Railly Hugo: reverse engineering and agent-built CLIs](https://www.youtube.com/watch?v=jbkxdxJfQ60)
- [Surface Recon skill](https://github.com/crafter-station/skills/blob/main/skills/surface-recon/SKILL.md)
- [CLI Build skill](https://github.com/crafter-station/skills/blob/main/skills/cli-build/SKILL.md)
- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [Official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP quickstart](https://code.claude.com/docs/en/mcp-quickstart)

## License

MIT
