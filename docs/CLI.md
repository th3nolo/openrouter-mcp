# OpenRouter CLI

The `openrouter-mcp` binary is a direct, non-interactive front door to the same operations used by the MCP server. It does not start a browser or preserve a session.

## Output contract

When output is redirected or piped, every operation writes one JSON object to `stdout`:

~~~json
{
  "ok": true,
  "command": "providers.list",
  "data": {},
  "next_steps": ["models list --providers <provider>"]
}
~~~

Use `--json` to request the same contract in an interactive terminal. Human-readable tables are the interactive default. Diagnostics and errors go to `stderr`.

| Exit status | Meaning |
| --- | --- |
| `0` | Success |
| `1` | OpenRouter, network, or runtime operation failed |
| `2` | Invalid command, option, or value |

The CLI never prompts. Credentials are read only from environment variables or `.env`.

## Agent-readable schema

~~~bash
openrouter-mcp schema
~~~

The versioned result describes every command's usage, options, MCP equivalent, credential class, risk class, output behavior, and exit statuses. This is the most stable entry point for an agent that needs to discover the CLI contract.

## Commands

| CLI command | MCP equivalent | Credential |
| --- | --- | --- |
| `models list [options]` | `list_models` | None |
| `models get <author/slug>` | `get_model` | None |
| `models endpoints <author/slug> [options]` | `list_model_endpoints` | None |
| `providers list [options]` | `list_providers` | None |
| `rankings models [options]` | `list_model_rankings` | API key |
| `rankings apps [options]` | `list_app_rankings` | API key |
| `account credits` | `get_credits` | Management key |
| `activity list [options]` | `list_activity` | Management key |
| `analytics schema` | `get_analytics_schema` | Management key |
| `analytics query [options]` | `query_analytics` | Management key |
| `chat send [options]` | `chat_with_model` | API key; can consume credits |
| `chat compare [options]` | `compare_models` | API key; can consume credits per model |
| `generations get <generation-id>` | `get_generation` | API key |
| `serve [options]` | Starts the MCP server | Depends on called tools |

Run `openrouter-mcp --help` for the short command map. Run `openrouter-mcp schema --json` for the complete machine-readable option inventory.

## Examples

~~~bash
# Filter the live catalog
openrouter-mcp models list --q claude --min-context-length 128000 --limit 10

# Find providers with a German datacenter
openrouter-mcp providers list --datacenter DE

# Read the last completed UTC day's model ranking
openrouter-mcp rankings models --modality tool_calling --limit 20

# Read trending coding apps in a bounded page
openrouter-mcp rankings apps --category coding --sort trending --limit 25 --offset 0

# Read one day's endpoint-level activity
openrouter-mcp activity list --date 2026-08-30 --limit 50

# Discover the current analytics vocabulary before building a query
openrouter-mcp analytics schema

# Query the aggregates behind Activity Explore
openrouter-mcp analytics query \
  --metrics total_usage,request_count,tokens_total \
  --dimensions model \
  --start 2026-08-01T00:00:00Z \
  --end 2026-08-31T00:00:00Z \
  --order-by total_usage \
  --order-direction desc \
  --limit 20

# Make one inference call
openrouter-mcp chat send \
  --model openrouter/free \
  --message "Reply with OK." \
  --max-completion-tokens 4 \
  --temperature 0

# Run strict stateless MCP over stdio
openrouter-mcp serve --transport stdio
~~~

PowerShell uses the same command and option names. Use backticks instead of backslashes when splitting one command across lines.

## Authentication boundaries

`OPENROUTER_API_KEY` authorizes rankings, inference, generation metadata, and the `openrouter://usage` resource. `OPENROUTER_MANAGEMENT_KEY` authorizes credit totals, activity, and analytics. If the management variable is absent, the client falls back to `OPENROUTER_API_KEY` so an actual management key can be supplied through either name; an ordinary API key does not gain management permissions.

Public model and provider discovery send no authorization header, even when a key is configured.

## Why the browser is not part of the runtime

The browser-oriented workflow was used as reconnaissance: identify valuable UI surfaces, trace them to stable upstream contracts, and then expose only bounded operations that have an official API. The shipped CLI and MCP server call OpenRouter directly. They do not depend on DOM selectors, private cookies, a persistent browser profile, or replayed browser traffic.
