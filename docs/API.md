# OpenRouter MCP API

The server exposes four tools and three fixed resources. MCP `2026-07-28` clients call them directly. The server rejects legacy `initialize` clients.

## list_models

Search and page through model metadata.

Input:

~~~json
{
  "q": "optional text query",
  "limit": 25,
  "offset": 0
}
~~~

- `q` is optional. The server passes it to OpenRouter's model endpoint.
- `limit` defaults to 25 and accepts values from 1 through 100.
- `offset` defaults to 0.

The response's `structuredContent` contains `models`, `total_available`, `returned`, `offset`, and `next_offset`.

## get_model_info

Read the current metadata for one exact model ID.

~~~json
{
  "model": "provider/model-id"
}
~~~

The handler returns an MCP tool error when the ID does not exist.

## chat_with_model

Generate one response. This call can spend OpenRouter API credits.

~~~json
{
  "model": "provider/model-id",
  "message": "Explain the tradeoff.",
  "max_completion_tokens": 1000,
  "temperature": 0.7,
  "system_prompt": "Optional instruction"
}
~~~

- `max_completion_tokens` defaults to 1000.
- `max_tokens` is a deprecated compatibility alias.
- `temperature` defaults to 0.7 and accepts values from 0 through 2.

The response's `structuredContent` contains `model`, `response`, and `usage`.

## compare_models

Generate the same prompt with two to eight model IDs. The server makes one OpenRouter request per model, so one tool call can spend credits several times.

~~~json
{
  "models": ["provider/model-a", "provider/model-b"],
  "message": "Compare these options.",
  "max_completion_tokens": 500
}
~~~

The result contains one success or error record per model. Cancelling the MCP call aborts every in-flight request.

## Resources

### openrouter://models

OpenRouter's current model metadata. The resource declares a private 60-second cache hint.

### openrouter://pricing

Model ID, name, and pricing fields, including token-, time-, and cache-specific pricing overrides. The resource declares a private 60-second cache hint.

### openrouter://usage

Usage and limits from OpenRouter's current-key endpoint. The resource declares a private five-second cache hint.

## Errors

- Zod validates tool input before the handler runs.
- The SDK returns validation and upstream exceptions with `isError` set.
- Resource failures are protocol errors.
- `OpenRouterClient` truncates upstream error messages to 1,000 characters.
- The server never includes API keys in tool results or errors.
- Each upstream request has a timeout and receives the MCP cancellation signal.
