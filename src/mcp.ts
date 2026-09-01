import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  APP_RANKING_CATEGORIES,
  APP_RANKING_SUBCATEGORIES,
  INPUT_MODALITIES,
  MODEL_CATEGORIES,
  MODEL_SORTS,
  OUTPUT_MODALITIES,
  OpenRouterClient,
  openRouterActivityItemSchema,
  openRouterAnalyticsMetaSchema,
  openRouterAnalyticsQueryResultSchema,
  openRouterAnalyticsQuerySchema,
  openRouterAppRankingItemSchema,
  openRouterCreditsSchema,
  openRouterEndpointSchema,
  openRouterGenerationSchema,
  openRouterModelSchema,
  openRouterModelRankingItemSchema,
  openRouterPricingSchema,
  openRouterProviderSchema,
  openRouterRankingsMetaSchema,
  type OpenRouterApi,
} from "./openrouter.js";
import {
  chatWithModel,
  compareModels,
  getAnalyticsSchema,
  getCredits,
  getGeneration,
  getModel,
  listActivity,
  listAppRankings,
  listModelEndpoints,
  listModelRankings,
  listModels,
  listProviders,
  queryAnalytics,
} from "./operations.js";

export const SERVER_NAME = "openrouter-mcp-server";
export const SERVER_VERSION = "3.0.0";

const STATIC_DISCOVERY_CACHE_MS = 3_600_000;
const usageSchema = z.record(z.string(), z.unknown()).nullable();

const modelIdSchema = z
  .string()
  .trim()
  .regex(/^[^\s/]+\/[^\s/]+$/, "Model must use the exact author/slug format.");

const stringFilterListSchema = z
  .array(z.string().trim().min(1).max(100))
  .min(1)
  .max(20);

const modelSummarySchema = z.object({
  agentic_index: z.number().nullable().optional(),
  canonical_slug: z.string().optional(),
  coding_index: z.number().nullable().optional(),
  context_length: z.number().int().nonnegative().optional(),
  created: z.number().int().nonnegative().optional(),
  id: z.string(),
  input_modalities: z.array(z.string()).optional(),
  intelligence_index: z.number().nullable().optional(),
  max_completion_tokens: z.number().int().nonnegative().nullable().optional(),
  name: z.string().optional(),
  output_modalities: z.array(z.string()).optional(),
  pricing: openRouterPricingSchema.optional(),
});

const listModelsInputSchema = z
  .object({
    architecture: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("Architecture or model family, such as GPT, Claude, Gemini, or Llama."),
    category: z.enum(MODEL_CATEGORIES).optional().describe("OpenRouter use-case category."),
    distillable: z.boolean().optional().describe("Include or exclude models that support distillation."),
    input_modalities: z
      .array(z.enum(INPUT_MODALITIES))
      .min(1)
      .max(INPUT_MODALITIES.length)
      .optional()
      .describe("Required input modalities."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum models to return, from 1 to 100."),
    max_agentic_index: z.number().nonnegative().optional(),
    max_age_days: z.number().int().nonnegative().optional(),
    max_coding_index: z.number().nonnegative().optional(),
    max_intelligence_index: z.number().nonnegative().optional(),
    max_output_price: z.number().nonnegative().optional().describe("Maximum output price in USD per million tokens."),
    max_prompt_price: z.number().nonnegative().optional().describe("Maximum prompt price in USD per million tokens."),
    max_tool_success_rate: z.number().min(0).max(1).optional(),
    min_agentic_index: z.number().nonnegative().optional(),
    min_age_days: z.number().int().nonnegative().optional(),
    min_coding_index: z.number().nonnegative().optional(),
    min_context_length: z.number().int().min(1).optional().describe("Minimum context length in tokens."),
    min_intelligence_index: z.number().nonnegative().optional(),
    min_output_price: z.number().nonnegative().optional().describe("Minimum output price in USD per million tokens."),
    min_prompt_price: z.number().nonnegative().optional().describe("Minimum prompt price in USD per million tokens."),
    min_tool_success_rate: z.number().min(0).max(1).optional(),
    model_authors: stringFilterListSchema.optional().describe("Model authors, such as openai or anthropic."),
    offset: z.number().int().min(0).default(0).describe("Number of matching models to skip upstream."),
    output_modalities: z
      .union([
        z.literal("all"),
        z.array(z.enum(OUTPUT_MODALITIES)).min(1).max(OUTPUT_MODALITIES.length),
      ])
      .optional()
      .describe("Required output modalities, or 'all' to disable OpenRouter's text default."),
    providers: stringFilterListSchema.optional().describe("Hosting providers to require."),
    q: z.string().trim().min(1).max(200).optional().describe("Free-text model name or slug search."),
    region: z.enum(["eu", "us"]).optional().describe("Require endpoints in this data region."),
    sort: z.enum(MODEL_SORTS).optional().describe("Server-side OpenRouter result ordering."),
    supported_parameters: stringFilterListSchema.optional().describe("Required inference parameters."),
    zdr: z.literal(true).optional().describe("Require at least one zero-data-retention endpoint."),
  })
  .strict()
  .refine((value) => validRange(value.min_prompt_price, value.max_prompt_price), {
    message: "min_prompt_price must not exceed max_prompt_price.",
    path: ["max_prompt_price"],
  })
  .refine((value) => validRange(value.min_output_price, value.max_output_price), {
    message: "min_output_price must not exceed max_output_price.",
    path: ["max_output_price"],
  })
  .refine((value) => validRange(value.min_age_days, value.max_age_days), {
    message: "min_age_days must not exceed max_age_days.",
    path: ["max_age_days"],
  })
  .refine((value) => validRange(value.min_intelligence_index, value.max_intelligence_index), {
    message: "min_intelligence_index must not exceed max_intelligence_index.",
    path: ["max_intelligence_index"],
  })
  .refine((value) => validRange(value.min_coding_index, value.max_coding_index), {
    message: "min_coding_index must not exceed max_coding_index.",
    path: ["max_coding_index"],
  })
  .refine((value) => validRange(value.min_agentic_index, value.max_agentic_index), {
    message: "min_agentic_index must not exceed max_agentic_index.",
    path: ["max_agentic_index"],
  })
  .refine((value) => validRange(value.min_tool_success_rate, value.max_tool_success_rate), {
    message: "min_tool_success_rate must not exceed max_tool_success_rate.",
    path: ["max_tool_success_rate"],
  });

const listModelsOutputSchema = z.object({
  has_more: z.boolean(),
  models: z.array(modelSummarySchema),
  next_offset: z.number().int().nonnegative().nullable(),
  offset: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
});

const getModelInputSchema = z
  .object({
    model: modelIdSchema.describe("Exact OpenRouter model ID, including optional variant suffix."),
  })
  .strict();

const getModelOutputSchema = z.object({
  model: openRouterModelSchema,
});

const listModelEndpointsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    model: modelIdSchema.describe("Exact OpenRouter model ID."),
    offset: z.number().int().min(0).default(0),
    provider: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("Optional case-insensitive provider name or endpoint tag filter."),
  })
  .strict();

const listModelEndpointsOutputSchema = z.object({
  endpoints: z.array(openRouterEndpointSchema),
  has_more: z.boolean(),
  model: z.object({
    id: z.string(),
    name: z.string().optional(),
  }),
  next_offset: z.number().int().nonnegative().nullable(),
  offset: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
});

const chatInputSchema = z
  .object({
    max_completion_tokens: z
      .number()
      .int()
      .min(1)
      .max(131_072)
      .default(1_000)
      .describe("Maximum generated tokens."),
    message: z.string().min(1).max(1_000_000).describe("User message to send to the model."),
    model: modelIdSchema.describe("Exact OpenRouter model ID."),
    system_prompt: z.string().min(1).max(100_000).optional(),
    temperature: z.number().min(0).max(2).default(0.7),
  })
  .strict();

const chatOutputSchema = z.object({
  generation_id: z.string(),
  requested_model: z.string(),
  resolved_model: z.string().nullable(),
  response: z.string(),
  usage: usageSchema,
});

const compareInputSchema = z
  .object({
    max_completion_tokens: z.number().int().min(1).max(131_072).default(500),
    message: z.string().min(1).max(1_000_000),
    models: z
      .array(modelIdSchema)
      .min(2)
      .max(8)
      .refine((models) => new Set(models).size === models.length, "Model IDs must be unique."),
  })
  .strict();

const comparisonResultSchema = z.object({
  error: z.string().optional(),
  generation_id: z.string().optional(),
  requested_model: z.string(),
  resolved_model: z.string().nullable().optional(),
  response: z.string().optional(),
  success: z.boolean(),
  usage: usageSchema.optional(),
});

const compareOutputSchema = z.object({
  results: z.array(comparisonResultSchema),
});

const getGenerationInputSchema = z
  .object({
    generation_id: z.string().trim().min(1).max(200).describe("Generation ID returned by a paid OpenRouter call."),
  })
  .strict();

const getGenerationOutputSchema = z.object({
  generation: openRouterGenerationSchema,
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD in UTC.");

const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Country code must contain exactly two letters.")
  .transform((value) => value.toUpperCase());

const listProvidersInputSchema = z
  .object({
    datacenter: countryCodeSchema.optional().describe("Require a provider datacenter in this country."),
    headquarters: countryCodeSchema.optional().describe("Require provider headquarters in this country."),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
    q: z.string().trim().min(1).max(100).optional().describe("Provider name or slug search."),
  })
  .strict();

const listProvidersOutputSchema = z.object({
  has_more: z.boolean(),
  next_offset: z.number().int().nonnegative().nullable(),
  offset: z.number().int().nonnegative(),
  providers: z.array(openRouterProviderSchema),
  returned: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
});

const getCreditsInputSchema = z.object({}).strict();
const getCreditsOutputSchema = openRouterCreditsSchema.extend({
  remaining_credits: z.number().nonnegative(),
});

const listActivityInputSchema = z
  .object({
    api_key_hash: z
      .string()
      .trim()
      .regex(/^[A-Fa-f0-9]{64}$/, "API key hash must be a 64-character SHA-256 hexadecimal string.")
      .optional(),
    date: isoDateSchema.optional().describe("UTC activity date; defaults to the last completed UTC day."),
    group_by: z.literal("workspace").optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
    user_id: z.string().trim().min(1).max(200).optional(),
    workspace_id: z.uuid().optional(),
  })
  .strict();

const listActivityOutputSchema = z.object({
  activity: z.array(openRouterActivityItemSchema),
  date: isoDateSchema,
  has_more: z.boolean(),
  next_offset: z.number().int().nonnegative().nullable(),
  offset: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
});

const getAnalyticsSchemaInputSchema = z.object({}).strict();
const getAnalyticsSchemaOutputSchema = z.object({ schema: openRouterAnalyticsMetaSchema });

const listModelRankingsInputSchema = z
  .object({
    context_bucket: z.enum(["1K", "10K", "100K", "1M", "10M"]).optional(),
    date: isoDateSchema.optional().describe("UTC ranking date; defaults to the last completed UTC day."),
    include_other: z.boolean().default(false).describe("Include OpenRouter's aggregated long-tail row."),
    limit: z.number().int().min(1).max(50).default(20),
    modality: z.enum(["text", "image", "image_output", "audio", "tool_calling"]).optional(),
  })
  .strict();

const listModelRankingsOutputSchema = z.object({
  attribution: z.string(),
  date: isoDateSchema,
  meta: openRouterRankingsMetaSchema,
  rankings: z.array(openRouterModelRankingItemSchema.extend({ rank: z.number().int().positive() })),
  returned: z.number().int().nonnegative(),
});

const listAppRankingsInputSchema = z
  .object({
    category: z.enum(APP_RANKING_CATEGORIES).optional(),
    end_date: isoDateSchema.optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(100).default(0),
    sort: z.enum(["popular", "trending"]).default("popular"),
    start_date: isoDateSchema.optional(),
    subcategory: z.enum(APP_RANKING_SUBCATEGORIES).optional(),
  })
  .strict()
  .refine((value) => !value.start_date || !value.end_date || value.start_date <= value.end_date, {
    message: "start_date must not be after end_date.",
    path: ["end_date"],
  });

const listAppRankingsOutputSchema = z.object({
  apps: z.array(openRouterAppRankingItemSchema),
  attribution: z.string(),
  has_more: z.boolean(),
  meta: openRouterRankingsMetaSchema,
  next_offset: z.number().int().nonnegative().nullable(),
  offset: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
});

export function createOpenRouterMcpServer(api: OpenRouterApi = OpenRouterClient.fromEnvironment()): McpServer {
  const publicDiscoveryCache = {
    cacheScope: "public" as const,
    ttlMs: STATIC_DISCOVERY_CACHE_MS,
  };
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      cacheHints: {
        "resources/list": publicDiscoveryCache,
        "resources/templates/list": publicDiscoveryCache,
        "server/discover": publicDiscoveryCache,
        "tools/list": publicDiscoveryCache,
      },
      inputRequired: {
        legacyShim: false,
      },
      instructions:
        "Use list_models, get_model, list_model_endpoints, list_providers, and list_model_rankings for live selection data. " +
        "Use list_app_rankings for the public app marketplace. Account tools require a management key. Call " +
        "get_analytics_schema before query_analytics because OpenRouter adds metrics and dimensions over time. " +
        "chat_with_model and compare_models can spend credits. Preserve generation_id values and use get_generation " +
        "for exact provider, token, latency, and cost metadata.",
    },
  );

  registerResources(server, api);
  registerTools(server, api);
  return server;
}

export function createOpenRouterMcpHandler(api: OpenRouterApi = OpenRouterClient.fromEnvironment()) {
  return createMcpHandler(() => createOpenRouterMcpServer(api), { legacy: "reject" });
}

function registerResources(server: McpServer, api: OpenRouterApi): void {
  server.registerResource(
    "key-usage",
    "openrouter://usage",
    {
      title: "OpenRouter key usage",
      description: "Usage and limits for the currently configured OpenRouter API key.",
      mimeType: "application/json",
      cacheHint: { ttlMs: 5_000, cacheScope: "private" },
    },
    async (uri, ctx) => {
      const usage = await api.getCurrentKey(ctx.mcpReq.signal);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ data: usage }, null, 2),
          },
        ],
      };
    },
  );
}

function registerTools(server: McpServer, api: OpenRouterApi): void {
  server.registerTool(
    "list_models",
    {
      title: "List OpenRouter models",
      description:
        "Search, filter, sort, and page OpenRouter's live model catalog. Returns compact selection metadata; use get_model for full details.",
      inputSchema: listModelsInputSchema,
      outputSchema: listModelsOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => {
      return toolResult(await listModels(api, input, ctx.mcpReq.signal));
    },
  );

  server.registerTool(
    "get_model",
    {
      title: "Get an OpenRouter model",
      description: "Return current full metadata for one exact OpenRouter author/slug, variant, or alias.",
      inputSchema: getModelInputSchema,
      outputSchema: getModelOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async ({ model: modelId }, ctx) => {
      return toolResult(await getModel(api, modelId, ctx.mcpReq.signal));
    },
  );

  server.registerTool(
    "list_model_endpoints",
    {
      title: "List OpenRouter model endpoints",
      description:
        "List the providers serving one model, including price, context, uptime, latency, throughput, and supported parameters.",
      inputSchema: listModelEndpointsInputSchema,
      outputSchema: listModelEndpointsOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => {
      return toolResult(await listModelEndpoints(api, input, ctx.mcpReq.signal));
    },
  );

  server.registerTool(
    "list_providers",
    {
      title: "List OpenRouter providers",
      description:
        "List and filter OpenRouter providers with headquarters, datacenter, privacy-policy, terms, and status-page metadata.",
      inputSchema: listProvidersInputSchema,
      outputSchema: listProvidersOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => toolResult(await listProviders(api, input, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "list_model_rankings",
    {
      title: "List OpenRouter model rankings",
      description:
        "Return the bounded public model-usage ranking for one completed UTC day, matching the OpenRouter rankings browser view.",
      inputSchema: listModelRankingsInputSchema,
      outputSchema: listModelRankingsOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => toolResult(await listModelRankings(api, input, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "list_app_rankings",
    {
      title: "List OpenRouter app rankings",
      description:
        "Return popular or trending public OpenRouter apps for a bounded date window, matching the browser marketplace.",
      inputSchema: listAppRankingsInputSchema,
      outputSchema: listAppRankingsOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => toolResult(await listAppRankings(api, input, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "get_credits",
    {
      title: "Get OpenRouter credits",
      description:
        "Return purchased, used, and remaining OpenRouter credits. Requires OPENROUTER_MANAGEMENT_KEY or a management key in OPENROUTER_API_KEY.",
      inputSchema: getCreditsInputSchema,
      outputSchema: getCreditsOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (_input, ctx) => toolResult(await getCredits(api, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "list_activity",
    {
      title: "List OpenRouter account activity",
      description:
        "List bounded endpoint-level usage for one UTC day with optional key, user, or workspace filters. Requires a management key.",
      inputSchema: listActivityInputSchema,
      outputSchema: listActivityOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => toolResult(await listActivity(api, input, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "get_analytics_schema",
    {
      title: "Get OpenRouter analytics schema",
      description:
        "Discover the current metrics, dimensions, filter operators, and time granularities accepted by query_analytics. Requires a management key.",
      inputSchema: getAnalyticsSchemaInputSchema,
      outputSchema: getAnalyticsSchemaOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async (_input, ctx) => toolResult(await getAnalyticsSchema(api, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "query_analytics",
    {
      title: "Query OpenRouter analytics",
      description:
        "Run a bounded, explicit-time-range analytics query over the same aggregates used by OpenRouter's Activity Explore browser view. Requires a management key; call get_analytics_schema first and check metadata.truncated before drawing conclusions.",
      inputSchema: openRouterAnalyticsQuerySchema,
      outputSchema: openRouterAnalyticsQueryResultSchema,
      annotations: readOnlyAnnotations(),
    },
    async (input, ctx) => toolResult(await queryAnalytics(api, input, ctx.mcpReq.signal)),
  );

  server.registerTool(
    "chat_with_model",
    {
      title: "Chat with an OpenRouter model",
      description:
        "Generate one response through OpenRouter. This can consume API credits and is not retried automatically.",
      inputSchema: chatInputSchema,
      outputSchema: chatOutputSchema,
      annotations: paidCallAnnotations(),
    },
    async (input, ctx) => {
      return toolResult(await chatWithModel(api, input, ctx.mcpReq.signal));
    },
  );

  server.registerTool(
    "compare_models",
    {
      title: "Compare OpenRouter models",
      description:
        "Generate the same prompt with two to eight models. Each model call can consume credits; at most three run concurrently and none are retried automatically.",
      inputSchema: compareInputSchema,
      outputSchema: compareOutputSchema,
      annotations: paidCallAnnotations(),
    },
    async (input, ctx) => {
      return toolResult(await compareModels(api, input, ctx.mcpReq.signal));
    },
  );

  server.registerTool(
    "get_generation",
    {
      title: "Get OpenRouter generation metadata",
      description:
        "Resolve a generation ID into exact model, provider, token, latency, and cost metadata without server-side session state.",
      inputSchema: getGenerationInputSchema,
      outputSchema: getGenerationOutputSchema,
      annotations: readOnlyAnnotations(),
    },
    async ({ generation_id: generationId }, ctx) => {
      return toolResult(await getGeneration(api, generationId, ctx.mcpReq.signal));
    },
  );
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as const;
}

function paidCallAnnotations() {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } as const;
}

function validRange(minimum: number | undefined, maximum: number | undefined): boolean {
  return minimum === undefined || maximum === undefined || minimum <= maximum;
}

function toolResult<T>(output: T): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}
