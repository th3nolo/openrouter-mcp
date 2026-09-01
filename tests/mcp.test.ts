import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { createOpenRouterMcpHandler } from "../src/mcp.js";
import {
  OpenRouterClient,
  OpenRouterHttpError,
  type ActivityOptions,
  type AppRankingsOptions,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ListModelsOptions,
  type ListModelsResult,
  type ModelRankingsOptions,
  type OpenRouterApi,
  type OpenRouterActivityItem,
  type OpenRouterAnalyticsMeta,
  type OpenRouterAnalyticsQuery,
  type OpenRouterAnalyticsQueryResult,
  type OpenRouterAppRankingItem,
  type OpenRouterCredits,
  type OpenRouterGeneration,
  type OpenRouterModel,
  type OpenRouterModelEndpoints,
  type OpenRouterModelRankingItem,
  type OpenRouterProvider,
  type RankingsResult,
} from "../src/openrouter.js";

const pricingWithOverrides: NonNullable<OpenRouterModel["pricing"]> = {
  prompt: "0.000001",
  completion: "0.000002",
  overrides: [
    {
      utc_days: ["saturday", "sunday"],
      prompt: "0.0000005",
      completion: "0.000001",
    },
    {
      min_prompt_tokens: 100_000,
      input_cache_read: "0.0000001",
      input_cache_write: "0.0000002",
    },
  ],
};

class FakeOpenRouterApi implements OpenRouterApi {
  readonly models: OpenRouterModel[] = [
    {
      id: "example/alpha",
      canonical_slug: "example/alpha-20260831",
      name: "Alpha",
      created: 1_788_206_780,
      context_length: 32_000,
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
      benchmarks: {
        artificial_analysis: {
          intelligence_index: 60,
          coding_index: 70,
          agentic_index: 50,
        },
      },
      pricing: pricingWithOverrides,
      top_provider: { max_completion_tokens: 8_000, is_moderated: false },
    },
    {
      id: "example/beta",
      name: "Beta",
      context_length: 64_000,
      pricing: { prompt: "0.000003", completion: "0.000004" },
    },
  ];

  readonly modelEndpoints: OpenRouterModelEndpoints = {
    id: "example/alpha",
    name: "Alpha",
    endpoints: [
      {
        name: "First Cloud | Alpha",
        provider_name: "First Cloud",
        tag: "first/fp16",
        context_length: 32_000,
        pricing: pricingWithOverrides,
        uptime_last_30m: 99.5,
      },
      {
        name: "Second Cloud | Alpha",
        provider_name: "Second Cloud",
        tag: "second/bf16",
        context_length: 32_000,
        pricing: { prompt: "0.000002", completion: "0.000003" },
        uptime_last_30m: 100,
      },
    ],
  };

  readonly providers: OpenRouterProvider[] = [
    {
      name: "First Cloud",
      slug: "first-cloud",
      headquarters: "US",
      datacenters: ["US", "DE"],
      privacy_policy_url: "https://first.example/privacy",
      status_page_url: "https://status.first.example",
      terms_of_service_url: "https://first.example/terms",
    },
    {
      name: "Second Cloud",
      slug: "second-cloud",
      headquarters: "CA",
      datacenters: ["CA"],
      privacy_policy_url: null,
    },
  ];

  readonly activity: OpenRouterActivityItem[] = [
    {
      byok_usage_inference: 0,
      completion_tokens: 20,
      date: "2026-08-30",
      endpoint_id: "endpoint-first",
      model: "example/alpha",
      model_permaslug: "example/alpha-20260831",
      prompt_tokens: 10,
      provider_name: "First Cloud",
      reasoning_tokens: 5,
      requests: 2,
      usage: 0.02,
      workspace_id: "550e8400-e29b-41d4-a716-446655440000",
    },
    {
      byok_usage_inference: 0.01,
      completion_tokens: 40,
      date: "2026-08-30",
      endpoint_id: "endpoint-second",
      model: "example/beta",
      model_permaslug: "example/beta-20260831",
      prompt_tokens: 30,
      provider_name: "Second Cloud",
      reasoning_tokens: 0,
      requests: 1,
      usage: 0.04,
      workspace_id: "550e8400-e29b-41d4-a716-446655440000",
    },
  ];

  readonly rankingsMeta = {
    as_of: "2026-08-31T01:00:00Z",
    start_date: "2026-08-30",
    end_date: "2026-08-30",
    version: "v1" as const,
  };

  readonly analyticsMeta: OpenRouterAnalyticsMeta = {
    dimensions: [{ display_label: "Model", name: "model" }],
    granularities: [{ display_label: "Day", name: "day" }],
    metrics: [{ display_format: "currency", display_label: "Total Usage", is_rate: false, name: "total_usage" }],
    operators: [{ name: "eq", value_type: "scalar" }],
  };

  lastListModelsOptions?: ListModelsOptions;
  listModelsHook?: (options: ListModelsOptions, signal?: AbortSignal) => Promise<ListModelsResult>;
  chatHook?: (request: ChatCompletionRequest, signal?: AbortSignal) => Promise<ChatCompletionResult>;
  chatError?: Error;
  getModelCalls = 0;

  async listProviders(signal?: AbortSignal): Promise<OpenRouterProvider[]> {
    signal?.throwIfAborted();
    return this.providers;
  }

  async getCredits(signal?: AbortSignal): Promise<OpenRouterCredits> {
    signal?.throwIfAborted();
    return { total_credits: 100, total_usage: 25.5 };
  }

  async getActivity(
    _options: ActivityOptions = {},
    signal?: AbortSignal,
  ): Promise<OpenRouterActivityItem[]> {
    signal?.throwIfAborted();
    return this.activity;
  }

  async getAnalyticsMeta(signal?: AbortSignal): Promise<OpenRouterAnalyticsMeta> {
    signal?.throwIfAborted();
    return this.analyticsMeta;
  }

  async queryAnalytics(
    request: OpenRouterAnalyticsQuery,
    signal?: AbortSignal,
  ): Promise<OpenRouterAnalyticsQueryResult> {
    signal?.throwIfAborted();
    return {
      rows: [{ model: "example/alpha", total_usage: 0.02, request_count: "2" }],
      metadata: { query_time_ms: 4, row_count: 1, truncated: request.limit === 1 },
    };
  }

  async getModelRankings(
    _options: ModelRankingsOptions = {},
    signal?: AbortSignal,
  ): Promise<RankingsResult<OpenRouterModelRankingItem>> {
    signal?.throwIfAborted();
    return {
      data: [
        { date: "2026-08-30", model_permaslug: "example/alpha-20260831", total_tokens: "9000" },
        { date: "2026-08-30", model_permaslug: "other", total_tokens: "1000" },
      ],
      meta: this.rankingsMeta,
    };
  }

  async getAppRankings(
    _options: AppRankingsOptions = {},
    signal?: AbortSignal,
  ): Promise<RankingsResult<OpenRouterAppRankingItem>> {
    signal?.throwIfAborted();
    return {
      data: [{ app_id: 1, app_name: "Example CLI", rank: 1, total_requests: 10, total_tokens: "5000" }],
      meta: this.rankingsMeta,
    };
  }

  async listModels(options: ListModelsOptions = {}, signal?: AbortSignal): Promise<ListModelsResult> {
    this.lastListModelsOptions = options;
    if (this.listModelsHook) {
      return this.listModelsHook(options, signal);
    }
    signal?.throwIfAborted();
    const query = options.q?.toLowerCase();
    const matching = query
      ? this.models.filter(
          (model) => model.id.toLowerCase().includes(query) || model.name?.toLowerCase().includes(query),
        )
      : this.models;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 25;
    const models = matching.slice(offset, offset + limit);
    return {
      models,
      totalCount: matching.length,
      links: {
        next: offset + models.length < matching.length ? "/models?offset=" + (offset + models.length) : null,
      },
    };
  }

  async getModel(modelId: string, signal?: AbortSignal): Promise<OpenRouterModel> {
    signal?.throwIfAborted();
    this.getModelCalls += 1;
    const model = this.models.find((candidate) => candidate.id === modelId);
    if (!model) {
      throw new Error("OpenRouter model not found: " + modelId);
    }
    return model;
  }

  async getModelEndpoints(modelId: string, signal?: AbortSignal): Promise<OpenRouterModelEndpoints> {
    signal?.throwIfAborted();
    if (modelId !== this.modelEndpoints.id) {
      throw new Error("OpenRouter model not found: " + modelId);
    }
    return this.modelEndpoints;
  }

  async getGeneration(generationId: string, signal?: AbortSignal): Promise<OpenRouterGeneration> {
    signal?.throwIfAborted();
    return {
      id: generationId,
      model: "example/alpha-resolved",
      provider_name: "First Cloud",
      tokens_prompt: 4,
      tokens_completion: 5,
      total_cost: 0.00001,
      latency: 350,
    };
  }

  async getCurrentKey(signal?: AbortSignal): Promise<Record<string, unknown>> {
    signal?.throwIfAborted();
    return { label: "test-key", usage: 1.25, limit: 10 };
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult> {
    signal?.throwIfAborted();
    if (this.chatHook) {
      return this.chatHook(request, signal);
    }
    if (this.chatError) {
      throw this.chatError;
    }
    return {
      content: "response from " + request.model,
      generationId: "gen-" + request.model.replace("/", "-"),
      resolvedModel: request.model + "-resolved",
      usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
    };
  }
}

async function connectHttp(api: OpenRouterApi) {
  const handler = createOpenRouterMcpHandler(api);
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client(
    { name: "openrouter-mcp-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(transport);
  return { client, handler };
}

function createStdioTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve("src/server.ts"), "--transport", "stdio"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
}

function createCliStdioTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve("src/cli.ts"), "serve", "--transport", "stdio"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
}

test("serves focused MCP 2026-07-28 tools with upstream pagination and cache hints", async (context) => {
  const api = new FakeOpenRouterApi();
  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  assert.equal(client.getProtocolEra(), "modern");
  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    [
      "list_models",
      "get_model",
      "list_model_endpoints",
      "list_providers",
      "list_model_rankings",
      "list_app_rankings",
      "get_credits",
      "list_activity",
      "get_analytics_schema",
      "query_analytics",
      "chat_with_model",
      "compare_models",
      "get_generation",
    ],
  );
  assert.equal(listed.ttlMs, 3_600_000);
  assert.equal(listed.cacheScope, "public");

  const listTool = listed.tools.find((tool) => tool.name === "list_models");
  assert.equal(listTool?.annotations?.readOnlyHint, true);
  assert.ok(listTool?.outputSchema);

  const result = await client.callTool({
    name: "list_models",
    arguments: {
      limit: 1,
      offset: 0,
      providers: ["First Cloud"],
      sort: "newest",
      min_context_length: 16_000,
    },
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    has_more: true,
    models: [
      {
        id: "example/alpha",
        canonical_slug: "example/alpha-20260831",
        name: "Alpha",
        created: 1_788_206_780,
        context_length: 32_000,
        input_modalities: ["text"],
        output_modalities: ["text"],
        pricing: pricingWithOverrides,
        max_completion_tokens: 8_000,
        intelligence_index: 60,
        coding_index: 70,
        agentic_index: 50,
      },
    ],
    next_offset: 1,
    offset: 0,
    returned: 1,
    total_count: 2,
  });
  assert.equal(api.lastListModelsOptions?.limit, 1);
  assert.equal(api.lastListModelsOptions?.offset, 0);
  assert.deepEqual(api.lastListModelsOptions?.providers, ["First Cloud"]);
  assert.equal(api.lastListModelsOptions?.sort, "newest");
  assert.equal(api.lastListModelsOptions?.minContextLength, 16_000);

  const invalidRange = await client.callTool({
    name: "list_models",
    arguments: { min_prompt_price: 10, max_prompt_price: 1 },
  });
  assert.equal(invalidRange.isError, true);
});

test("exposes only the bounded private usage resource", async (context) => {
  const { client, handler } = await connectHttp(new FakeOpenRouterApi());
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const listed = await client.listResources();
  assert.deepEqual(listed.resources.map((resource) => resource.uri), ["openrouter://usage"]);
  assert.equal(listed.ttlMs, 3_600_000);
  assert.equal(listed.cacheScope, "public");

  const usageResult = await client.readResource({ uri: "openrouter://usage" });
  assert.equal(usageResult.ttlMs, 5_000);
  assert.equal(usageResult.cacheScope, "private");
  const usageContent = usageResult.contents[0];
  assert.ok(usageContent && "text" in usageContent);
  assert.deepEqual(JSON.parse(usageContent.text), {
    data: { label: "test-key", usage: 1.25, limit: 10 },
  });

  await assert.rejects(client.readResource({ uri: "openrouter://models" }));
  await assert.rejects(client.readResource({ uri: "openrouter://pricing" }));
});

test("uses direct model, endpoint, and generation handles without server state", async (context) => {
  const api = new FakeOpenRouterApi();
  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const model = await client.callTool({
    name: "get_model",
    arguments: { model: "example/alpha" },
  });
  assert.equal(api.getModelCalls, 1);
  assert.deepEqual(model.structuredContent, { model: api.models[0] });

  const endpoints = await client.callTool({
    name: "list_model_endpoints",
    arguments: { model: "example/alpha", provider: "second", limit: 1 },
  });
  assert.deepEqual(endpoints.structuredContent, {
    endpoints: [api.modelEndpoints.endpoints[1]],
    has_more: false,
    model: { id: "example/alpha", name: "Alpha" },
    next_offset: null,
    offset: 0,
    returned: 1,
    total_count: 1,
  });

  const chat = await client.callTool({
    name: "chat_with_model",
    arguments: { model: "example/alpha", message: "Hello" },
  });
  assert.deepEqual(chat.structuredContent, {
    generation_id: "gen-example-alpha",
    requested_model: "example/alpha",
    resolved_model: "example/alpha-resolved",
    response: "response from example/alpha",
    usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
  });

  const generation = await client.callTool({
    name: "get_generation",
    arguments: { generation_id: "gen-example-alpha" },
  });
  assert.deepEqual(generation.structuredContent, {
    generation: {
      id: "gen-example-alpha",
      model: "example/alpha-resolved",
      provider_name: "First Cloud",
      tokens_prompt: 4,
      tokens_completion: 5,
      total_cost: 0.00001,
      latency: 350,
    },
  });

  const invalidModel = await client.callTool({
    name: "get_model",
    arguments: { model: "missing-slash" },
  });
  assert.equal(invalidModel.isError, true);
  assert.equal(api.getModelCalls, 1);
});

test("exposes former browser surfaces through bounded official API contracts", async (context) => {
  const api = new FakeOpenRouterApi();
  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const providers = await client.callTool({
    name: "list_providers",
    arguments: { datacenter: "de", limit: 10 },
  });
  assert.deepEqual(providers.structuredContent, {
    has_more: false,
    next_offset: null,
    offset: 0,
    providers: [api.providers[0]],
    returned: 1,
    total_count: 1,
  });

  const modelRankings = await client.callTool({
    name: "list_model_rankings",
    arguments: { date: "2026-08-30", limit: 10 },
  });
  const modelRankingOutput = modelRankings.structuredContent as {
    attribution: string;
    rankings: Array<{ model_permaslug: string; rank: number }>;
  };
  assert.match(modelRankingOutput.attribution, /Source: OpenRouter/);
  assert.deepEqual(modelRankingOutput.rankings, [
    { date: "2026-08-30", model_permaslug: "example/alpha-20260831", rank: 1, total_tokens: "9000" },
  ]);

  const appRankings = await client.callTool({
    name: "list_app_rankings",
    arguments: { limit: 1, offset: 0, sort: "trending" },
  });
  assert.deepEqual(appRankings.structuredContent, {
    apps: [{ app_id: 1, app_name: "Example CLI", rank: 1, total_requests: 10, total_tokens: "5000" }],
    attribution: "Source: OpenRouter (openrouter.ai/apps), as of 2026-08-31T01:00:00Z.",
    has_more: false,
    meta: api.rankingsMeta,
    next_offset: null,
    offset: 0,
    returned: 1,
  });

  const credits = await client.callTool({ name: "get_credits", arguments: {} });
  assert.deepEqual(credits.structuredContent, {
    total_credits: 100,
    total_usage: 25.5,
    remaining_credits: 74.5,
  });

  const activity = await client.callTool({
    name: "list_activity",
    arguments: { date: "2026-08-30", group_by: "workspace", limit: 1 },
  });
  assert.deepEqual(activity.structuredContent, {
    activity: [api.activity[0]],
    date: "2026-08-30",
    has_more: true,
    next_offset: 1,
    offset: 0,
    returned: 1,
    total_count: 2,
  });

  const invalidHash = await client.callTool({
    name: "list_activity",
    arguments: { api_key_hash: "not-a-hash" },
  });
  assert.equal(invalidHash.isError, true);

  const analyticsSchema = await client.callTool({ name: "get_analytics_schema", arguments: {} });
  assert.deepEqual(analyticsSchema.structuredContent, { schema: api.analyticsMeta });

  const analytics = await client.callTool({
    name: "query_analytics",
    arguments: {
      metrics: ["total_usage", "request_count"],
      dimensions: ["model"],
      order_by: { field: "total_usage", direction: "desc" },
      time_range: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T00:00:00Z" },
      limit: 10,
    },
  });
  assert.deepEqual(analytics.structuredContent, {
    rows: [{ model: "example/alpha", total_usage: 0.02, request_count: "2" }],
    metadata: { query_time_ms: 4, row_count: 1, truncated: false },
  });

  const invalidAnalytics = await client.callTool({
    name: "query_analytics",
    arguments: {
      metrics: ["total_usage"],
      dimensions: ["model", "provider", "workspace"],
      time_range: { start: "2026-08-31T00:00:00Z", end: "2026-08-01T00:00:00Z" },
    },
  });
  assert.equal(invalidAnalytics.isError, true);
});

test("caps paid comparison concurrency at three and returns per-call generation IDs", async (context) => {
  const api = new FakeOpenRouterApi();
  let active = 0;
  let maximumActive = 0;
  const calls = new Map<string, number>();
  api.chatHook = async (request, signal) => {
    signal?.throwIfAborted();
    calls.set(request.model, (calls.get(request.model) ?? 0) + 1);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      if (request.model.endsWith("/5")) {
        throw new Error("provider rejected model");
      }
      return {
        content: "answer " + request.model,
        generationId: "gen-" + request.model.replace("/", "-"),
        resolvedModel: request.model,
      };
    } finally {
      active -= 1;
    }
  };

  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const models = Array.from({ length: 8 }, (_, index) => "example/" + index);
  const comparison = await client.callTool({
    name: "compare_models",
    arguments: { models, message: "Compare" },
  });
  assert.equal(comparison.isError, undefined);
  assert.ok(maximumActive <= 3);
  assert.deepEqual([...calls.values()], Array.from({ length: 8 }, () => 1));
  const payload = comparison.structuredContent as {
    results: Array<{ error?: string; generation_id?: string; requested_model: string; success: boolean }>;
  };
  assert.equal(payload.results.length, 8);
  assert.deepEqual(payload.results[0], {
    generation_id: "gen-example-0",
    requested_model: "example/0",
    resolved_model: "example/0",
    success: true,
    response: "answer example/0",
    usage: null,
  });
  assert.deepEqual(payload.results[5], {
    requested_model: "example/5",
    success: false,
    error: "provider rejected model",
  });
});

test("accepts a modern tools/list request without initialize or session state", async () => {
  const handler = createOpenRouterMcpHandler(new FakeOpenRouterApi());
  try {
    const response = await handler.fetch(
      new Request("http://test.local/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/list",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/list",
          params: {
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientInfo": {
                name: "stateless-test",
                version: "1.0.0",
              },
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        }),
      }),
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      id: number;
      result: { cacheScope: string; tools: Array<{ name: string }>; ttlMs: number };
    };
    assert.equal(body.id, 7);
    assert.equal(body.result.ttlMs, 3_600_000);
    assert.equal(body.result.cacheScope, "public");
    assert.ok(body.result.tools.some((tool) => tool.name === "list_model_endpoints"));
    assert.equal(response.headers.has("Mcp-Session-Id"), false);
  } finally {
    await handler.close();
  }
});

test("rejects legacy initialization over HTTP", async () => {
  const handler = createOpenRouterMcpHandler(new FakeOpenRouterApi());
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client(
    { name: "openrouter-legacy-http-test", version: "1.0.0" },
    { versionNegotiation: { mode: "legacy" } },
  );

  try {
    await assert.rejects(client.connect(transport));
  } finally {
    await client.close().catch(() => undefined);
    await handler.close();
  }
});

test("converts upstream tool failures into MCP tool errors", async (context) => {
  const api = new FakeOpenRouterApi();
  api.chatError = new Error("upstream unavailable");
  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const result = await client.callTool({
    name: "chat_with_model",
    arguments: { model: "example/alpha", message: "Hello" },
  });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /upstream unavailable/);
});

test("forwards MCP cancellation to the in-flight paginated OpenRouter operation", async (context) => {
  const api = new FakeOpenRouterApi();
  let observedSignal: AbortSignal | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  api.listModelsHook = async (_options, signal) => {
    observedSignal = signal;
    markStarted?.();
    return new Promise<ListModelsResult>((_resolve, reject) => {
      if (!signal) {
        reject(new Error("Expected an MCP cancellation signal."));
        return;
      }
      const abort = (): void => reject(signal.reason ?? new Error("cancelled"));
      if (signal.aborted) {
        abort();
      } else {
        signal.addEventListener("abort", abort, { once: true });
      }
    });
  };

  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  const controller = new AbortController();
  const call = client.callTool(
    { name: "list_models", arguments: { limit: 1 } },
    { signal: controller.signal },
  );
  await started;
  controller.abort(new Error("test cancellation"));
  await call.catch(() => undefined);

  assert.ok(observedSignal);
  assert.equal(observedSignal.aborted, true);
});

test("negotiates the modern protocol over the real stdio entry point", async () => {
  const client = new Client(
    { name: "openrouter-stdio-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  const transport = createStdioTransport();

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "modern");
    const listed = await client.listTools();
    assert.ok(listed.tools.some((tool) => tool.name === "get_generation"));
  } finally {
    await client.close();
  }
});

test("serves the modern stateless protocol through the hybrid CLI entry point", async () => {
  const client = new Client(
    { name: "openrouter-cli-stdio-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  const transport = createCliStdioTransport();

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "modern");
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 13);
    assert.ok(listed.tools.some((tool) => tool.name === "query_analytics"));
  } finally {
    await client.close();
  }
});

test("rejects legacy initialization over the real stdio entry point", { timeout: 5_000 }, async () => {
  const client = new Client(
    { name: "openrouter-legacy-stdio-test", version: "1.0.0" },
    { versionNegotiation: { mode: "legacy" } },
  );
  const transport = createStdioTransport();

  try {
    await assert.rejects(client.connect(transport));
  } finally {
    await client.close().catch(() => undefined);
  }
});

test("uses current OpenRouter headers and returns generation handles", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        id: "gen-live-shape",
        model: "example/alpha-resolved",
        choices: [{ message: { content: "hello" } }],
        usage: { total_tokens: 3 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    apiKey: "test-secret",
    appName: "Test App",
    baseUrl: "https://openrouter.example/api/v1",
    fetch: fetchImpl,
    siteUrl: "https://example.test",
  });

  const result = await client.createChatCompletion({
    model: "example/alpha",
    message: "Hello",
    maxCompletionTokens: 321,
    temperature: 0.2,
  });

  assert.equal(result.content, "hello");
  assert.equal(result.generationId, "gen-live-shape");
  assert.equal(result.resolvedModel, "example/alpha-resolved");
  assert.equal(capturedUrl, "https://openrouter.example/api/v1/chat/completions");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("Authorization"), "Bearer test-secret");
  assert.equal(headers.get("HTTP-Referer"), "https://example.test");
  assert.equal(headers.get("X-OpenRouter-Title"), "Test App");
  assert.equal(headers.has("X-Title"), false);
  const requestBody = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal(requestBody.max_completion_tokens, 321);
  assert.equal("max_tokens" in requestBody, false);
});

test("passes current model filters upstream and strips additive vendor fields", async () => {
  let capturedUrl = "";
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = String(input);
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "example/overridden",
            name: "Overridden pricing model",
            future_model_field: "must not leak",
            pricing: {
              ...pricingWithOverrides,
              future_price_field: "must not leak",
              overrides: pricingWithOverrides.overrides?.map((override) => ({
                ...override,
                future_override_field: "must not leak",
              })),
            },
          },
        ],
        total_count: 150,
        links: { next: "/api/v1/models?offset=11&limit=1", future_link: true },
        future_response_field: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    baseUrl: "https://openrouter.example/api/v1",
    fetch: fetchImpl,
  });

  const page = await client.listModels({
    offset: 10,
    limit: 1,
    q: "alpha",
    category: "programming",
    supportedParameters: ["tools", "structured_outputs"],
    outputModalities: ["text", "image"],
    inputModalities: ["text", "file"],
    sort: "coding-high-to-low",
    minContextLength: 128_000,
    minPromptPrice: 0,
    maxPromptPrice: 2,
    minOutputPrice: 0,
    maxOutputPrice: 5,
    architecture: "Claude",
    modelAuthors: ["anthropic"],
    providers: ["Anthropic", "Bedrock"],
    distillable: false,
    zdr: true,
    region: "us",
    minAgeDays: 1,
    maxAgeDays: 90,
    minIntelligenceIndex: 50,
    maxCodingIndex: 100,
    minAgenticIndex: 40,
    maxToolSuccessRate: 1,
  });

  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get("offset"), "10");
  assert.equal(url.searchParams.get("limit"), "1");
  assert.equal(url.searchParams.get("q"), "alpha");
  assert.equal(url.searchParams.get("supported_parameters"), "tools,structured_outputs");
  assert.equal(url.searchParams.get("output_modalities"), "text,image");
  assert.equal(url.searchParams.get("input_modalities"), "text,file");
  assert.equal(url.searchParams.get("sort"), "coding-high-to-low");
  assert.equal(url.searchParams.get("context"), "128000");
  assert.equal(url.searchParams.get("model_authors"), "anthropic");
  assert.equal(url.searchParams.get("providers"), "Anthropic,Bedrock");
  assert.equal(url.searchParams.get("distillable"), "false");
  assert.equal(url.searchParams.get("zdr"), "true");
  assert.equal(url.searchParams.get("region"), "us");
  assert.equal(url.searchParams.get("min_age_days"), "1");
  assert.equal(url.searchParams.get("max_age_days"), "90");
  assert.equal(url.searchParams.get("min_intelligence_index"), "50");
  assert.equal(url.searchParams.get("max_coding_index"), "100");
  assert.equal(url.searchParams.get("min_agentic_index"), "40");
  assert.equal(url.searchParams.get("max_tool_success_rate"), "1");
  assert.equal(page.totalCount, 150);
  assert.equal(page.models[0]?.id, "example/overridden");
  assert.deepEqual(page.models[0]?.pricing, pricingWithOverrides);
  assert.equal("future_model_field" in (page.models[0] ?? {}), false);
  assert.equal("future_price_field" in (page.models[0]?.pricing ?? {}), false);
  assert.equal("future_override_field" in (page.models[0]?.pricing?.overrides?.[0] ?? {}), false);
});

test("uses direct model, endpoint, and generation API routes", async () => {
  const capturedUrls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    capturedUrls.push(url.href);
    if (url.pathname.includes("/model/")) {
      return Response.json({ data: { id: "example/alpha:free", name: "Alpha Free" } });
    }
    if (url.pathname.endsWith("/endpoints")) {
      return Response.json({
        data: {
          id: "example/alpha:free",
          endpoints: [{ name: "Free Cloud | Alpha", provider_name: "Free Cloud" }],
        },
      });
    }
    return Response.json({
      data: {
        id: url.searchParams.get("id"),
        model: "example/alpha",
        provider_name: "Free Cloud",
        total_cost: 0,
      },
    });
  }) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    apiKey: "test-secret",
    baseUrl: "https://openrouter.example/api/v1",
    fetch: fetchImpl,
  });

  const model = await client.getModel("example/alpha:free");
  const endpoints = await client.getModelEndpoints("example/alpha:free");
  const generation = await client.getGeneration("gen-123");

  assert.equal(model.id, "example/alpha:free");
  assert.equal(endpoints.endpoints[0]?.provider_name, "Free Cloud");
  assert.equal(generation.id, "gen-123");
  assert.match(capturedUrls[0] ?? "", /\/api\/v1\/model\/example\/alpha%3Afree$/);
  assert.match(capturedUrls[1] ?? "", /\/api\/v1\/models\/example\/alpha%3Afree\/endpoints$/);
  assert.match(capturedUrls[2] ?? "", /\/api\/v1\/generation\?id=gen-123$/);
});

test("uses official dashboard-era routes with separated API and management credentials", async () => {
  const calls: Array<{ authorization: string | null; body?: string; method?: string; url: URL }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    calls.push({
      authorization: new Headers(init?.headers).get("Authorization"),
      body: typeof init?.body === "string" ? init.body : undefined,
      method: init?.method,
      url,
    });
    if (url.pathname.endsWith("/providers")) {
      return Response.json({
        data: [{ name: "First Cloud", slug: "first-cloud", privacy_policy_url: null, future: true }],
      });
    }
    if (url.pathname.endsWith("/credits")) {
      return Response.json({ data: { total_credits: 10, total_usage: 3, future: true } });
    }
    if (url.pathname.endsWith("/activity")) {
      return Response.json({
        data: [{
          byok_usage_inference: 0,
          completion_tokens: 2,
          date: "2026-08-30",
          endpoint_id: "endpoint",
          model: "example/alpha",
          model_permaslug: "example/alpha-20260831",
          prompt_tokens: 1,
          provider_name: "First Cloud",
          reasoning_tokens: 0,
          requests: 1,
          usage: 0.01,
          future: true,
        }],
      });
    }
    if (url.pathname.endsWith("/datasets/rankings-daily")) {
      return Response.json({
        data: [{ date: "2026-08-30", model_permaslug: "example/alpha", total_tokens: "3" }],
        meta: { as_of: "2026-08-31T00:00:00Z", start_date: "2026-08-30", end_date: "2026-08-30", version: "v1" },
      });
    }
    if (url.pathname.endsWith("/analytics/meta")) {
      return Response.json({
        data: {
          dimensions: [{ display_label: "Model", name: "model", future: true }],
          granularities: [{ display_label: "Day", name: "day" }],
          metrics: [{ display_format: "currency", display_label: "Usage", is_rate: false, name: "total_usage" }],
          operators: [{ name: "eq", value_type: "scalar" }],
          future: true,
        },
      });
    }
    if (url.pathname.endsWith("/analytics/query")) {
      return Response.json({
        data: {
          cachedAt: 123,
          data: [{ model: "example/alpha", total_usage: 0.01 }],
          metadata: { query_time_ms: 5, row_count: 1, truncated: false, future: true },
          warnings: ["example warning"],
          future: true,
        },
      });
    }
    return Response.json({
      data: [{ app_id: 1, app_name: "Example", rank: 1, total_requests: 2, total_tokens: "3" }],
      meta: { as_of: "2026-08-31T00:00:00Z", start_date: "2026-08-01", end_date: "2026-08-30", version: "v1" },
    });
  }) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    apiKey: "api-secret",
    managementApiKey: "management-secret",
    baseUrl: "https://openrouter.example/api/v1",
    fetch: fetchImpl,
  });

  const providers = await client.listProviders();
  const credits = await client.getCredits();
  const activity = await client.getActivity({ date: "2026-08-30", groupBy: "workspace" });
  const models = await client.getModelRankings({ startDate: "2026-08-30", endDate: "2026-08-30" });
  const apps = await client.getAppRankings({ limit: 10, offset: 5, sort: "trending" });
  const analyticsMeta = await client.getAnalyticsMeta();
  const analytics = await client.queryAnalytics({
    dimensions: ["model"],
    limit: 10,
    metrics: ["total_usage"],
    time_range: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T00:00:00Z" },
  });

  assert.deepEqual(providers, [{ name: "First Cloud", slug: "first-cloud", privacy_policy_url: null }]);
  assert.deepEqual(credits, { total_credits: 10, total_usage: 3 });
  assert.equal("future" in (activity[0] ?? {}), false);
  assert.equal(models.data[0]?.total_tokens, "3");
  assert.equal(apps.data[0]?.app_name, "Example");
  assert.equal("future" in (analyticsMeta.dimensions[0] ?? {}), false);
  assert.deepEqual(analytics, {
    cached_at: 123,
    rows: [{ model: "example/alpha", total_usage: 0.01 }],
    metadata: { query_time_ms: 5, row_count: 1, truncated: false },
    warnings: ["example warning"],
  });
  assert.equal(calls[0]?.authorization, null);
  assert.equal(calls[1]?.authorization, "Bearer management-secret");
  assert.equal(calls[2]?.authorization, "Bearer management-secret");
  assert.equal(calls[3]?.authorization, "Bearer api-secret");
  assert.equal(calls[4]?.authorization, "Bearer api-secret");
  assert.equal(calls[5]?.authorization, "Bearer management-secret");
  assert.equal(calls[6]?.authorization, "Bearer management-secret");
  assert.equal(calls[2]?.url.searchParams.get("group_by"), "workspace");
  assert.equal(calls[3]?.url.pathname, "/api/v1/datasets/rankings-daily");
  assert.equal(calls[4]?.url.searchParams.get("offset"), "5");
  assert.equal(calls[4]?.url.searchParams.get("sort"), "trending");
  assert.equal(calls[5]?.url.pathname, "/api/v1/analytics/meta");
  assert.equal(calls[6]?.url.pathname, "/api/v1/analytics/query");
  assert.equal(calls[6]?.method, "POST");
  assert.deepEqual(JSON.parse(calls[6]?.body ?? "{}"), {
    dimensions: ["model"],
    limit: 10,
    metrics: ["total_usage"],
    time_range: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T00:00:00Z" },
  });
});

test("ships an agent-readable CLI schema with automatic JSON output", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", path.resolve("src/cli.ts"), "schema"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    command: string;
    data: {
      commands: Array<{ command: string; mcp_tool: string | null; options: string[]; usage: string }>;
      exit_codes: { operation_failed: number; success: number; usage_error: number };
      mcp_protocol: string;
      output_contract: { mode: string };
    };
    ok: boolean;
  };
  assert.equal(output.ok, true);
  assert.equal(output.command, "schema");
  assert.equal(output.data.mcp_protocol, "2026-07-28");
  assert.deepEqual(output.data.exit_codes, { success: 0, operation_failed: 1, usage_error: 2 });
  assert.match(output.data.output_contract.mode, /JSON/);
  assert.ok(output.data.commands.some((command) =>
    command.command === "activity list" &&
    command.mcp_tool === "list_activity" &&
    command.usage === "activity list [options]" &&
    command.options.includes("--workspace-id")
  ));
  assert.ok(output.data.commands.some((command) => command.command === "serve" && command.mcp_tool === null));
});

test("returns structured CLI usage errors with exit status two", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      path.resolve("src/cli.ts"),
      "analytics",
      "query",
      "--metrics",
      "total_usage",
      "--start",
      "not-a-timestamp",
      "--end",
      "2026-08-31T00:00:00Z",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  const output = JSON.parse(result.stderr) as { error: { code: string; message: string }; ok: boolean };
  assert.equal(output.ok, false);
  assert.equal(output.error.code, "usage_error");
  assert.match(output.error.message, /ISO 8601 UTC/);
});

test("rejects malformed pricing override containers", async () => {
  const fetchImpl = (async (): Promise<Response> =>
    Response.json({
      data: [
        {
          id: "example/malformed",
          pricing: { prompt: "0", completion: "0", overrides: { prompt: "0" } },
        },
      ],
      total_count: 1,
      links: {},
    })) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    baseUrl: "https://openrouter.example/api/v1",
    fetch: fetchImpl,
  });

  await assert.rejects(client.listModels());
});

test("requires HTTPS for non-loopback OpenRouter base URLs", () => {
  assert.throws(
    () => new OpenRouterClient({ baseUrl: "http://openrouter.example/api/v1" }),
    /must use HTTPS/,
  );
  assert.throws(
    () => new OpenRouterClient({ baseUrl: "https://user:pass@openrouter.example/api/v1" }),
    /must not contain credentials/,
  );
  assert.doesNotThrow(() => new OpenRouterClient({ baseUrl: "http://127.0.0.1:8787/api/v1" }));
  assert.doesNotThrow(() => new OpenRouterClient({ baseUrl: "http://localhost:8787/api/v1" }));
});

test("surfaces bounded OpenRouter HTTP errors without leaking request credentials", async () => {
  const fetchImpl = (async (): Promise<Response> =>
    new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })) as typeof globalThis.fetch;
  const client = new OpenRouterClient({
    apiKey: "credential-that-must-not-appear",
    fetch: fetchImpl,
  });

  await assert.rejects(
    client.getCurrentKey(),
    (error: unknown) =>
      error instanceof OpenRouterHttpError &&
      error.status === 429 &&
      error.message.includes("Rate limited") &&
      !error.message.includes("credential-that-must-not-appear"),
  );
});

test(
  "matches the live public OpenRouter catalog contract",
  { skip: process.env.OPENROUTER_LIVE_TEST !== "1", timeout: 20_000 },
  async () => {
    const client = OpenRouterClient.fromEnvironment();
    const page = await client.listModels({ limit: 2, offset: 0, sort: "newest" });
    assert.equal(page.models.length, 2);
    assert.ok(page.totalCount >= page.models.length);
    const first = page.models[0];
    assert.ok(first);
    const model = await client.getModel(first.id);
    assert.equal(model.id, first.id);
    const endpoints = await client.getModelEndpoints(first.id);
    assert.equal(endpoints.id, first.id);
    assert.ok(Array.isArray(endpoints.endpoints));
  },
);
