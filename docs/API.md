# OpenRouter MCP API

Version 3.0 exposes thirteen tools and one fixed resource. MCP `2026-07-28` clients call them directly. The server rejects legacy `initialize` clients.

All tools use strict input schemas and return both a JSON text block and matching `structuredContent`.

Public model and provider discovery send no authorization header. Rankings, inference, generation metadata, and `openrouter://usage` use `OPENROUTER_API_KEY`. Credits, activity, and analytics use `OPENROUTER_MANAGEMENT_KEY`; an actual management key may instead be supplied through `OPENROUTER_API_KEY`.

## `list_models`

Search, filter, sort, and page OpenRouter's live model catalog. Pagination runs at OpenRouter; the MCP server does not fetch the complete catalog and slice it locally.

~~~json
{
  "q": "claude",
  "sort": "coding-high-to-low",
  "providers": ["Anthropic", "Amazon Bedrock"],
  "supported_parameters": ["tools", "structured_outputs"],
  "min_context_length": 128000,
  "max_prompt_price": 5,
  "limit": 25,
  "offset": 0
}
~~~

### Discovery fields

| Field | Constraint | Meaning |
| --- | --- | --- |
| `q` | 1–200 characters | Model name or slug search |
| `category` | OpenRouter category enum | Use-case category |
| `architecture` | 1–100 characters | Architecture or family, such as Claude or Llama |
| `model_authors` | 1–20 strings | Organizations that created the model |
| `providers` | 1–20 strings | Hosting providers that must serve the model |
| `supported_parameters` | 1–20 strings | Required inference parameters |
| `input_modalities` | text, image, audio, file | Required input types |
| `output_modalities` | modality array or `all` | Required output types; `all` disables OpenRouter's text default |
| `distillable` | boolean | Include or exclude distillable models |
| `zdr` | `true` only | Require a zero-data-retention endpoint |
| `region` | `eu` or `us` | Require an endpoint in the selected region |

### Numeric filters

| Range | Fields |
| --- | --- |
| Context tokens | `min_context_length` |
| Prompt price in USD per million tokens | `min_prompt_price`, `max_prompt_price` |
| Output price in USD per million tokens | `min_output_price`, `max_output_price` |
| Model age in days | `min_age_days`, `max_age_days` |
| Artificial Analysis intelligence | `min_intelligence_index`, `max_intelligence_index` |
| Artificial Analysis coding | `min_coding_index`, `max_coding_index` |
| Artificial Analysis agentic | `min_agentic_index`, `max_agentic_index` |
| Tool success fraction from 0 through 1 | `min_tool_success_rate`, `max_tool_success_rate` |

Each minimum must be less than or equal to its matching maximum.

### Sorting and pagination

`sort` accepts:

- `most-popular`
- `newest`
- `top-weekly`
- `pricing-low-to-high`
- `pricing-high-to-low`
- `context-high-to-low`
- `throughput-high-to-low`
- `latency-low-to-high`
- `intelligence-high-to-low`
- `coding-high-to-low`
- `agentic-high-to-low`
- `design-arena-elo-high-to-low`

`limit` defaults to 25 and accepts 1 through 100. `offset` defaults to 0.

The result contains `models`, `total_count`, `returned`, `offset`, `has_more`, and `next_offset`. Each model is a compact selection record. Use `get_model` for its description, supported parameters, reasoning settings, and full benchmark data.

## `get_model`

Read current metadata for one exact `author/slug`. OpenRouter variants such as `:free` and known aliases are passed to the direct model endpoint.

~~~json
{
  "model": "provider/model-id:free"
}
~~~

The result contains one normalized `model`. Unknown fields added by OpenRouter are stripped. Missing or malformed documented fields still fail validation.

`get_model_info` was removed in 3.0. There is no compatibility alias.

## `list_model_endpoints`

List the providers serving one model.

~~~json
{
  "model": "provider/model-id",
  "provider": "Bedrock",
  "limit": 25,
  "offset": 0
}
~~~

`provider` is an optional case-insensitive match against provider name, endpoint tag, or endpoint name. The result is locally bounded and contains `endpoints`, `total_count`, `returned`, `offset`, `has_more`, and `next_offset`.

Endpoint records can include:

- prompt, completion, cache, image, audio, request, and override pricing;
- context and completion limits;
- supported inference parameters and tool-choice modes;
- quantization and endpoint tag;
- five-minute, 30-minute, and one-day uptime;
- recent latency and throughput percentiles.

## `list_providers`

List OpenRouter providers and filter the bounded result locally.

~~~json
{
  "q": "cloud",
  "headquarters": "US",
  "datacenter": "DE",
  "limit": 50,
  "offset": 0
}
~~~

Country filters use two-letter codes. Provider records contain name, slug, headquarters, datacenter countries, privacy-policy URL, terms URL, and status-page URL when OpenRouter supplies them. The result contains `providers`, `total_count`, `returned`, `offset`, `has_more`, and `next_offset`.

## `list_model_rankings`

Read a bounded model-usage ranking for one completed UTC day. A regular OpenRouter API key is required.

~~~json
{
  "date": "2026-08-30",
  "modality": "tool_calling",
  "context_bucket": "100K",
  "include_other": false,
  "limit": 20
}
~~~

`date` defaults to the last completed UTC day. `modality` accepts `text`, `image`, `image_output`, `audio`, or `tool_calling`; `context_bucket` accepts `1K`, `10K`, `100K`, `1M`, or `10M`. The server requests a one-day window, excludes OpenRouter's aggregated `other` row by default, limits the result to 50 rows, assigns ranks after filtering, and includes source attribution plus upstream `meta` timestamps.

## `list_app_rankings`

Read the public app marketplace through OpenRouter's Data API. A regular OpenRouter API key is required.

~~~json
{
  "category": "coding",
  "subcategory": "cli-agent",
  "sort": "trending",
  "start_date": "2026-08-01",
  "end_date": "2026-08-30",
  "limit": 25,
  "offset": 0
}
~~~

`sort` accepts `popular` or `trending`. Pages contain at most 100 rows; `offset` is capped at 100. The result includes app rank, request count, token count, source attribution, upstream metadata, and bounded pagination fields.

## `get_credits`

Return `total_credits`, `total_usage`, and locally computed `remaining_credits`. This read-only call requires a management key.

~~~json
{}
~~~

## `list_activity`

Read endpoint-level account usage for one of OpenRouter's last 30 completed UTC days. This read-only call requires a management key.

~~~json
{
  "date": "2026-08-30",
  "api_key_hash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "group_by": "workspace",
  "limit": 50,
  "offset": 0
}
~~~

`date` defaults to the last completed UTC day. Optional filters are `api_key_hash`, `user_id`, and `workspace_id`. `group_by: "workspace"` makes OpenRouter split rows per workspace instead of aggregating across workspaces. The server applies bounded local pagination and returns model, endpoint, provider, request, token, BYOK, and usage totals.

## `get_analytics_schema`

Discover the current contract for the aggregates behind OpenRouter's Activity Explore browser view. This call requires a management key.

~~~json
{}
~~~

The result lists current metrics, dimensions, filter operators, and time granularities with display labels. Agents should call this tool before `query_analytics` because OpenRouter can add analytics fields without a server release.

## `query_analytics`

Run a bounded read-only analytics query with the same aggregate data used by Activity Explore. This call requires a management key.

~~~json
{
  "metrics": ["total_usage", "request_count", "tokens_total"],
  "dimensions": ["model"],
  "granularity": "day",
  "filters": [
    { "field": "provider", "operator": "eq", "value": "Anthropic" }
  ],
  "order_by": { "field": "total_usage", "direction": "desc" },
  "time_range": {
    "start": "2026-08-01T00:00:00Z",
    "end": "2026-08-31T00:00:00Z"
  },
  "limit": 1000
}
~~~

The wrapper requires an explicit UTC `time_range`; timestamps must include seconds. Queries accept one through 50 current metric names, up to two dimensions, up to 20 filters, optional minute/hour/day/week/month granularity, and at most 10,000 rows. `group_limit` can independently cap rows per dimension combination.

Standard filters accept `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, and `lte`. Set operators require an array value; other operators require a scalar. Optional `classifier_dimensions` and `classifier_filters` expose classifier tags with one matching classifier UUID, up to ten dimension names, and up to ten equality or set filters.

The result contains dynamic `rows` keyed by the requested fields, `metadata.query_time_ms`, `metadata.row_count`, `metadata.truncated`, and optional cache and warning fields. Count and token metrics may be strings. Callers must treat a result with `metadata.truncated: true` as partial.

## `chat_with_model`

Generate one response. This call can consume OpenRouter API credits and is not retried automatically.

~~~json
{
  "model": "provider/model-id",
  "message": "Explain the tradeoff.",
  "max_completion_tokens": 1000,
  "temperature": 0.7,
  "system_prompt": "Optional instruction"
}
~~~

`max_completion_tokens` defaults to 1000. `temperature` defaults to 0.7 and accepts 0 through 2.

The result contains:

- `generation_id`: explicit handle for `get_generation`;
- `requested_model`: the model supplied by the caller;
- `resolved_model`: the model reported by OpenRouter after routing, or `null`;
- `response`;
- `usage`.

The deprecated `max_tokens` alias was removed in 3.0.

## `compare_models`

Generate the same prompt with two through eight unique model IDs. One tool call can consume credits once per model.

~~~json
{
  "models": ["provider/model-a", "provider/model-b"],
  "message": "Compare these options.",
  "max_completion_tokens": 500
}
~~~

At most three upstream calls run at once. Calls are not retried. Each success record contains its own `generation_id`, requested model, resolved model, response, and usage. One provider failure becomes an error record without discarding successful results. Cancelling the MCP call aborts every active request.

## `get_generation`

Resolve an explicit generation handle. The server does not keep request history or session state.

~~~json
{
  "generation_id": "gen-1234567890"
}
~~~

The result can include the exact model, provider, prompt and completion tokens, native token counts, latency, generation time, finish reason, routing tier, region, and total cost reported by OpenRouter.

## Resource

### `openrouter://usage`

Usage and limits from OpenRouter's current-key endpoint. The resource declares a private five-second cache hint.

`openrouter://models` and `openrouter://pricing` were removed in 3.0. Use bounded model tools instead.

## Caching

The server returns a public one-hour cache hint for:

- `server/discover`;
- `tools/list`;
- `resources/list`;
- `resources/templates/list`.

The tool and resource definitions do not vary by API key. Account data remains private.

## Errors and cancellation

- Zod validates tool input before the handler runs.
- The SDK returns validation and upstream exceptions with `isError` set.
- Resource failures are protocol errors.
- OpenRouter error messages are flattened to one line and limited to 1,000 characters.
- API keys are never included in results or errors.
- Every upstream request has a timeout and receives the MCP cancellation signal.
- Non-loopback OpenRouter base URLs must use HTTPS.
