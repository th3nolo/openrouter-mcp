# OpenRouter MCP server

This server gives Claude four OpenRouter tools. Claude can list models, inspect one model, generate a response, or compare models. Three resources expose model metadata, pricing, and API-key usage.

Version 2.0 targets MCP `2026-07-28` only. Current Claude clients can send stateless requests directly. The server rejects clients that begin with the legacy `initialize` handshake.

## What changed in 2.0

- Modern HTTP requests do not use `initialize`, `notifications/initialized`, `Mcp-Session-Id`, or a GET event stream. Legacy openings are rejected.
- `server/discover` reports server capabilities. Every request carries protocol, client, and capability metadata.
- `serveStdio` pins each accepted stdio connection to MCP `2026-07-28` and rejects legacy mode.
- Each tool has a strict Zod input schema, effect annotations, and structured output.
- The server passes MCP cancellation to every in-flight OpenRouter request.
- OpenRouter attribution sends `X-OpenRouter-Title`.
- `chat_with_model` sends `max_completion_tokens`. It still accepts `max_tokens` as a deprecated alias.
- `openrouter://usage` calls OpenRouter's current-key endpoint instead of returning placeholder data.
- `list_models` limits each result page with `limit` and `offset`.

See [docs/MCP-2026-07-28.md](docs/MCP-2026-07-28.md) for the wire-level changes.

## Requirements

- Node.js 24 LTS
- pnpm 12.0.0, exactly as pinned in `package.json`
- An OpenRouter API key for chat, model comparison, and key-usage data

Model discovery can work without a key. OpenRouter may still apply anonymous limits.

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
~~~

Keep `.env` out of Git.

## Use with Claude over stdio

`stdio` is the default. Use it for local Claude integrations.

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
| list_models | Search and page through current model metadata | Read-only OpenRouter request |
| get_model_info | Read one exact model record | Read-only OpenRouter request |
| chat_with_model | Generate one response | Can consume API credits |
| compare_models | Generate with two to eight models | Can consume API credits per model |

Each tool returns a text block and `structuredContent`. Zod rejects bad input before the handler runs. The SDK converts upstream failures into MCP tool errors.

## Resources

| URI | Data |
| --- | --- |
| openrouter://models | Current model metadata |
| openrouter://pricing | Current pricing fields |
| openrouter://usage | Usage and limits for the configured API key |

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| OPENROUTER_API_KEY | none | OpenRouter API key |
| OPENROUTER_BASE_URL | https://openrouter.ai/api/v1 | OpenRouter API base URL |
| OPENROUTER_SITE_URL | none | Optional HTTP-Referer app attribution |
| OPENROUTER_APP_NAME | OpenRouter MCP Server | X-OpenRouter-Title attribution |
| OPENROUTER_TIMEOUT_MS | 60000 | Per-request timeout |
| MCP_TRANSPORT | stdio | stdio or http |
| MCP_HTTP_PORT | 3000 | Local HTTP port |

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

The tests send a `2026-07-28` request without `initialize` and exercise strict legacy rejection, structured results, tool errors, and cancellation. They also start the real stdio entry point and inspect the OpenRouter request headers.

## Sources

- [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [Official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP quickstart](https://code.claude.com/docs/en/mcp-quickstart)
- [OpenRouter API documentation](https://openrouter.ai/docs/api/reference/overview)

## License

MIT
