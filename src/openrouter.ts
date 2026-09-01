import * as z from "zod/v4";

const priceSchema = z.string();

const pricingOverrideSchema = z.object({
  audio: priceSchema.optional(),
  completion: priceSchema.optional(),
  input_audio_cache: priceSchema.optional(),
  input_cache_read: priceSchema.optional(),
  input_cache_write: priceSchema.optional(),
  input_cache_write_1h: priceSchema.optional(),
  min_prompt_tokens: z.number().int().nonnegative().optional(),
  prompt: priceSchema.optional(),
  utc_days: z.array(z.string()).optional(),
  utc_end: z.number().int().nonnegative().optional(),
  utc_start: z.number().int().nonnegative().optional(),
});

/**
 * Stable MCP pricing shape. Zod strips unknown upstream properties so additive
 * OpenRouter changes do not leak into, or break, our public tool contract.
 */
export const openRouterPricingSchema = z.object({
  audio: priceSchema.optional(),
  audio_output: priceSchema.optional(),
  completion: priceSchema.optional(),
  discount: z.number().optional(),
  image: priceSchema.optional(),
  image_output: priceSchema.optional(),
  input_audio_cache: priceSchema.optional(),
  input_cache_read: priceSchema.optional(),
  input_cache_write: priceSchema.optional(),
  input_cache_write_1h: priceSchema.optional(),
  internal_reasoning: priceSchema.optional(),
  overrides: z.array(pricingOverrideSchema).optional(),
  prompt: priceSchema.optional(),
  request: priceSchema.optional(),
  web_search: priceSchema.optional(),
});

export const openRouterArchitectureSchema = z.object({
  input_modalities: z.array(z.string()).optional(),
  instruct_type: z.string().nullable().optional(),
  modality: z.string().nullable().optional(),
  output_modalities: z.array(z.string()).optional(),
  tokenizer: z.string().nullable().optional(),
});

const artificialAnalysisSchema = z.object({
  agentic_index: z.number().nullable().optional(),
  coding_index: z.number().nullable().optional(),
  intelligence_index: z.number().nullable().optional(),
});

const designArenaScoreSchema = z.object({
  arena: z.string(),
  category: z.string(),
  elo: z.number(),
  rank: z.number().int().nonnegative(),
  win_rate: z.number(),
});

export const openRouterBenchmarksSchema = z.object({
  artificial_analysis: artificialAnalysisSchema.nullable().optional(),
  design_arena: z.array(designArenaScoreSchema).optional(),
});

export const openRouterReasoningSchema = z.object({
  default_effort: z.string().nullable().optional(),
  default_enabled: z.boolean().optional(),
  mandatory: z.boolean().optional(),
  supported_efforts: z.array(z.string()).optional(),
});

const topProviderSchema = z.object({
  context_length: z.number().int().nonnegative().nullable().optional(),
  is_moderated: z.boolean().optional(),
  max_completion_tokens: z.number().int().nonnegative().nullable().optional(),
});

const modelLinksSchema = z.object({
  details: z.string().optional(),
});

/** Stable model contract returned by MCP tools. Unknown vendor fields are stripped. */
export const openRouterModelSchema = z.object({
  architecture: openRouterArchitectureSchema.optional(),
  benchmarks: openRouterBenchmarksSchema.optional(),
  canonical_slug: z.string().optional(),
  context_length: z.number().int().nonnegative().optional(),
  created: z.number().int().nonnegative().optional(),
  default_parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().optional(),
  expiration_date: z.string().nullable().optional(),
  hugging_face_id: z.string().nullable().optional(),
  id: z.string(),
  knowledge_cutoff: z.string().nullable().optional(),
  links: modelLinksSchema.optional(),
  name: z.string().optional(),
  pricing: openRouterPricingSchema.optional(),
  reasoning: openRouterReasoningSchema.optional(),
  supported_parameters: z.array(z.string()).optional(),
  top_provider: topProviderSchema.optional(),
});

const percentileSchema = z.object({
  p50: z.number().optional(),
  p75: z.number().optional(),
  p90: z.number().optional(),
  p99: z.number().optional(),
});

export const openRouterEndpointSchema = z.object({
  context_length: z.number().int().nonnegative().nullable().optional(),
  latency_last_30m: percentileSchema.nullable().optional(),
  max_completion_tokens: z.number().int().nonnegative().nullable().optional(),
  max_prompt_tokens: z.number().int().nonnegative().nullable().optional(),
  model_id: z.string().optional(),
  model_name: z.string().optional(),
  name: z.string(),
  pricing: openRouterPricingSchema.optional(),
  provider_name: z.string().optional(),
  quantization: z.string().nullable().optional(),
  status: z.number().int().optional(),
  supported_parameters: z.array(z.string()).optional(),
  supports_implicit_caching: z.boolean().optional(),
  supports_tool_choice: z.record(z.string(), z.boolean()).optional(),
  supports_voice_cloning: z.boolean().optional(),
  tag: z.string().optional(),
  throughput_last_30m: percentileSchema.nullable().optional(),
  uptime_last_1d: z.number().nullable().optional(),
  uptime_last_30m: z.number().nullable().optional(),
  uptime_last_5m: z.number().nullable().optional(),
});

export const openRouterModelEndpointsSchema = z.object({
  architecture: openRouterArchitectureSchema.optional(),
  created: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  endpoints: z.array(openRouterEndpointSchema),
  id: z.string(),
  name: z.string().optional(),
});

export const openRouterGenerationSchema = z.object({
  cancelled: z.boolean().optional(),
  created_at: z.string().optional(),
  data_region: z.string().nullable().optional(),
  finish_reason: z.string().nullable().optional(),
  generation_time: z.number().nullable().optional(),
  id: z.string(),
  is_byok: z.boolean().optional(),
  latency: z.number().nullable().optional(),
  model: z.string().optional(),
  native_finish_reason: z.string().nullable().optional(),
  native_tokens_cached: z.number().int().nonnegative().nullable().optional(),
  native_tokens_completion: z.number().int().nonnegative().nullable().optional(),
  native_tokens_prompt: z.number().int().nonnegative().nullable().optional(),
  native_tokens_reasoning: z.number().int().nonnegative().nullable().optional(),
  provider_name: z.string().nullable().optional(),
  request_id: z.string().nullable().optional(),
  router: z.string().nullable().optional(),
  service_tier: z.string().nullable().optional(),
  streamed: z.boolean().optional(),
  tokens_completion: z.number().int().nonnegative().nullable().optional(),
  tokens_prompt: z.number().int().nonnegative().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  upstream_inference_cost: z.number().nullable().optional(),
});

export const openRouterProviderSchema = z.object({
  datacenters: z.array(z.string()).nullable().optional(),
  headquarters: z.string().nullable().optional(),
  name: z.string(),
  privacy_policy_url: z.string().nullable(),
  slug: z.string(),
  status_page_url: z.string().nullable().optional(),
  terms_of_service_url: z.string().nullable().optional(),
});

export const openRouterCreditsSchema = z.object({
  total_credits: z.number().nonnegative(),
  total_usage: z.number().nonnegative(),
});

export const openRouterActivityItemSchema = z.object({
  api_key_hash: z.string().optional(),
  byok_usage_inference: z.number().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  date: z.string(),
  endpoint_id: z.string(),
  model: z.string(),
  model_permaslug: z.string(),
  prompt_tokens: z.number().int().nonnegative(),
  provider_name: z.string(),
  reasoning_tokens: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  usage: z.number().nonnegative(),
  user_id: z.string().optional(),
  workspace_id: z.string().optional(),
});

export const openRouterRankingsMetaSchema = z.object({
  as_of: z.string(),
  end_date: z.string(),
  start_date: z.string(),
  version: z.literal("v1"),
});

export const openRouterModelRankingItemSchema = z.object({
  date: z.string(),
  model_permaslug: z.string(),
  total_tokens: z.string().regex(/^\d+$/),
});

export const openRouterAppRankingItemSchema = z.object({
  app_id: z.number().int().nonnegative(),
  app_name: z.string(),
  rank: z.number().int().positive(),
  total_requests: z.number().int().nonnegative(),
  total_tokens: z.string().regex(/^\d+$/),
});

const analyticsScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const analyticsFilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.array(z.union([z.string(), z.number()])).min(1).max(100),
]);
const utcTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/,
    "Timestamp must be ISO 8601 UTC with seconds.",
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), "Timestamp must be a valid UTC date and time.");

export const openRouterAnalyticsMetaSchema = z.object({
  dimensions: z.array(z.object({ display_label: z.string(), name: z.string() })),
  granularities: z.array(z.object({ display_label: z.string(), name: z.string() })),
  metrics: z.array(z.object({
    display_format: z.string(),
    display_label: z.string(),
    is_rate: z.boolean(),
    name: z.string(),
  })),
  operators: z.array(z.object({ name: z.string(), value_type: z.string() })),
});

export const openRouterAnalyticsRowSchema = z.record(z.string(), analyticsScalarSchema);
export const openRouterAnalyticsQueryMetadataSchema = z.object({
  query_time_ms: z.number().nonnegative(),
  row_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
});
export const openRouterAnalyticsQueryResultSchema = z.object({
  cached_at: z.number().nonnegative().optional(),
  metadata: openRouterAnalyticsQueryMetadataSchema,
  rows: z.array(openRouterAnalyticsRowSchema),
  warnings: z.array(z.string()).optional(),
});

const analyticsFilterSchema = z
  .object({
    field: z.string().trim().min(1).max(128),
    include_unset: z.boolean().optional(),
    operator: z.enum(["eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte"]),
    value: analyticsFilterValueSchema,
  })
  .strict()
  .superRefine((filter, context) => {
    const expectsArray = filter.operator === "in" || filter.operator === "not_in";
    if (expectsArray !== Array.isArray(filter.value)) {
      context.addIssue({
        code: "custom",
        message: expectsArray ? "in and not_in require an array value." : "This operator requires a scalar value.",
        path: ["value"],
      });
    }
  });

const classifierFilterSchema = z
  .object({
    field: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
    operator: z.enum(["eq", "neq", "in", "not_in"]),
    value: analyticsFilterValueSchema,
  })
  .strict()
  .superRefine((filter, context) => {
    const expectsArray = filter.operator === "in" || filter.operator === "not_in";
    if (expectsArray !== Array.isArray(filter.value)) {
      context.addIssue({
        code: "custom",
        message: expectsArray ? "in and not_in require an array value." : "eq and neq require a scalar value.",
        path: ["value"],
      });
    }
  });

export const openRouterAnalyticsQuerySchema = z
  .object({
    classifier_dimensions: z
      .object({
        classifier_id: z.uuid(),
        dimension_names: z
          .array(z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/))
          .min(1)
          .max(10)
          .optional(),
        include_nulls: z.boolean().optional(),
      })
      .strict()
      .optional(),
    classifier_filters: z
      .object({
        classifier_id: z.uuid(),
        filters: z.array(classifierFilterSchema).min(1).max(10),
      })
      .strict()
      .optional(),
    dimensions: z.array(z.string().trim().min(1).max(128)).max(2).optional(),
    filters: z.array(analyticsFilterSchema).max(20).optional(),
    granularity: z.enum(["minute", "hour", "day", "week", "month"]).optional(),
    group_limit: z.number().int().min(1).max(10_000).optional(),
    limit: z.number().int().min(1).max(10_000).default(1_000),
    metrics: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
    order_by: z
      .object({ direction: z.enum(["asc", "desc"]), field: z.string().trim().min(1).max(128) })
      .strict()
      .optional(),
    time_range: z
      .object({ end: utcTimestampSchema, start: utcTimestampSchema })
      .strict()
      .refine((value) => Date.parse(value.start) < Date.parse(value.end), {
        message: "time_range.start must be before time_range.end.",
        path: ["end"],
      }),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.classifier_dimensions &&
      query.classifier_filters &&
      query.classifier_dimensions.classifier_id !== query.classifier_filters.classifier_id
    ) {
      context.addIssue({
        code: "custom",
        message: "classifier_dimensions and classifier_filters must use the same classifier_id.",
        path: ["classifier_filters", "classifier_id"],
      });
    }
  });

const paginationLinksSchema = z
  .object({
    next: z.string().nullable().optional(),
    prev: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
  })
  .passthrough();

const modelsResponseSchema = z
  .object({
    data: z.array(openRouterModelSchema),
    links: paginationLinksSchema,
    total_count: z.number().int().nonnegative(),
  })
  .passthrough();

const modelResponseSchema = z.object({ data: openRouterModelSchema }).passthrough();
const endpointsResponseSchema = z.object({ data: openRouterModelEndpointsSchema }).passthrough();
const generationResponseSchema = z.object({ data: openRouterGenerationSchema }).passthrough();
const providersResponseSchema = z.object({ data: z.array(openRouterProviderSchema) }).passthrough();
const creditsResponseSchema = z.object({ data: openRouterCreditsSchema }).passthrough();
const activityResponseSchema = z.object({ data: z.array(openRouterActivityItemSchema) }).passthrough();
const modelRankingsResponseSchema = z
  .object({
    data: z.array(openRouterModelRankingItemSchema),
    meta: openRouterRankingsMetaSchema,
  })
  .passthrough();
const appRankingsResponseSchema = z
  .object({
    data: z.array(openRouterAppRankingItemSchema),
    meta: openRouterRankingsMetaSchema,
  })
  .passthrough();
const analyticsMetaResponseSchema = z.object({ data: openRouterAnalyticsMetaSchema }).passthrough();
const analyticsQueryResponseSchema = z
  .object({
    data: z.object({
      cachedAt: z.number().nonnegative().optional(),
      data: z.array(openRouterAnalyticsRowSchema),
      metadata: openRouterAnalyticsQueryMetadataSchema,
      warnings: z.array(z.string()).optional(),
    }),
  })
  .passthrough();

const keyResponseSchema = z
  .object({
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const chatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.unknown(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    id: z.string(),
    model: z.string().optional(),
    usage: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type OpenRouterPricing = z.infer<typeof openRouterPricingSchema>;
export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;
export type OpenRouterEndpoint = z.infer<typeof openRouterEndpointSchema>;
export type OpenRouterModelEndpoints = z.infer<typeof openRouterModelEndpointsSchema>;
export type OpenRouterGeneration = z.infer<typeof openRouterGenerationSchema>;
export type OpenRouterProvider = z.infer<typeof openRouterProviderSchema>;
export type OpenRouterCredits = z.infer<typeof openRouterCreditsSchema>;
export type OpenRouterActivityItem = z.infer<typeof openRouterActivityItemSchema>;
export type OpenRouterRankingsMeta = z.infer<typeof openRouterRankingsMetaSchema>;
export type OpenRouterModelRankingItem = z.infer<typeof openRouterModelRankingItemSchema>;
export type OpenRouterAppRankingItem = z.infer<typeof openRouterAppRankingItemSchema>;
export type OpenRouterAnalyticsMeta = z.infer<typeof openRouterAnalyticsMetaSchema>;
export type OpenRouterAnalyticsQuery = z.infer<typeof openRouterAnalyticsQuerySchema>;
export type OpenRouterAnalyticsQueryResult = z.infer<typeof openRouterAnalyticsQueryResultSchema>;

export const MODEL_CATEGORIES = [
  "programming",
  "roleplay",
  "marketing",
  "marketing/seo",
  "technology",
  "science",
  "translation",
  "legal",
  "finance",
  "health",
  "trivia",
  "academia",
] as const;

export const MODEL_SORTS = [
  "most-popular",
  "newest",
  "top-weekly",
  "pricing-low-to-high",
  "pricing-high-to-low",
  "context-high-to-low",
  "throughput-high-to-low",
  "latency-low-to-high",
  "intelligence-high-to-low",
  "coding-high-to-low",
  "agentic-high-to-low",
  "design-arena-elo-high-to-low",
] as const;

export const INPUT_MODALITIES = ["text", "image", "audio", "file"] as const;
export const OUTPUT_MODALITIES = [
  "text",
  "image",
  "embeddings",
  "audio",
  "video",
  "rerank",
  "speech",
  "transcription",
] as const;

export const APP_RANKING_CATEGORIES = ["coding", "creative", "productivity", "entertainment"] as const;
export const APP_RANKING_SUBCATEGORIES = [
  "cli-agent",
  "ide-extension",
  "cloud-agent",
  "programming-app",
  "native-app-builder",
  "creative-writing",
  "video-gen",
  "image-gen",
  "audio-gen",
  "roleplay",
  "game",
  "writing-assistant",
  "general-chat",
  "personal-agent",
  "legal",
] as const;

export interface ListModelsOptions {
  architecture?: string;
  category?: (typeof MODEL_CATEGORIES)[number];
  distillable?: boolean;
  inputModalities?: Array<(typeof INPUT_MODALITIES)[number]>;
  limit?: number;
  maxAgenticIndex?: number;
  maxAgeDays?: number;
  maxCodingIndex?: number;
  maxIntelligenceIndex?: number;
  maxOutputPrice?: number;
  maxPromptPrice?: number;
  maxToolSuccessRate?: number;
  minAgenticIndex?: number;
  minAgeDays?: number;
  minCodingIndex?: number;
  minContextLength?: number;
  minIntelligenceIndex?: number;
  minOutputPrice?: number;
  minPromptPrice?: number;
  minToolSuccessRate?: number;
  modelAuthors?: string[];
  offset?: number;
  outputModalities?: Array<(typeof OUTPUT_MODALITIES)[number]> | "all";
  providers?: string[];
  q?: string;
  region?: "eu" | "us";
  sort?: (typeof MODEL_SORTS)[number];
  supportedParameters?: string[];
  zdr?: boolean;
}

export interface ListModelsResult {
  links: {
    next?: string | null;
    previous?: string | null;
  };
  models: OpenRouterModel[];
  totalCount: number;
}

export interface ChatCompletionRequest {
  maxCompletionTokens: number;
  message: string;
  model: string;
  systemPrompt?: string;
  temperature: number;
}

export interface ChatCompletionResult {
  content: unknown;
  generationId: string;
  resolvedModel?: string;
  usage?: Record<string, unknown>;
}

export interface ActivityOptions {
  apiKeyHash?: string;
  date?: string;
  groupBy?: "workspace";
  userId?: string;
  workspaceId?: string;
}

export interface ModelRankingsOptions {
  contextBucket?: "1K" | "10K" | "100K" | "1M" | "10M";
  endDate?: string;
  modality?: "text" | "image" | "image_output" | "audio" | "tool_calling";
  period?: "day" | "week" | "month";
  startDate?: string;
}

export interface AppRankingsOptions {
  category?: (typeof APP_RANKING_CATEGORIES)[number];
  endDate?: string;
  limit?: number;
  offset?: number;
  sort?: "popular" | "trending";
  startDate?: string;
  subcategory?: (typeof APP_RANKING_SUBCATEGORIES)[number];
}

export interface RankingsResult<T> {
  data: T[];
  meta: OpenRouterRankingsMeta;
}

export interface OpenRouterApi {
  createChatCompletion(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResult>;
  getAnalyticsMeta(signal?: AbortSignal): Promise<OpenRouterAnalyticsMeta>;
  getActivity(options?: ActivityOptions, signal?: AbortSignal): Promise<OpenRouterActivityItem[]>;
  getAppRankings(options?: AppRankingsOptions, signal?: AbortSignal): Promise<RankingsResult<OpenRouterAppRankingItem>>;
  getCredits(signal?: AbortSignal): Promise<OpenRouterCredits>;
  getCurrentKey(signal?: AbortSignal): Promise<Record<string, unknown>>;
  getGeneration(generationId: string, signal?: AbortSignal): Promise<OpenRouterGeneration>;
  getModelRankings(options?: ModelRankingsOptions, signal?: AbortSignal): Promise<RankingsResult<OpenRouterModelRankingItem>>;
  getModel(modelId: string, signal?: AbortSignal): Promise<OpenRouterModel>;
  getModelEndpoints(modelId: string, signal?: AbortSignal): Promise<OpenRouterModelEndpoints>;
  listModels(options?: ListModelsOptions, signal?: AbortSignal): Promise<ListModelsResult>;
  listProviders(signal?: AbortSignal): Promise<OpenRouterProvider[]>;
  queryAnalytics(request: OpenRouterAnalyticsQuery, signal?: AbortSignal): Promise<OpenRouterAnalyticsQueryResult>;
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  appName?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  managementApiKey?: string;
  siteUrl?: string;
  timeoutMs?: number;
}

type AuthenticationMode = "none" | "api" | "management";

export class OpenRouterHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super("OpenRouter API returned HTTP " + status + ": " + message);
    this.name = "OpenRouterHttpError";
    this.status = status;
  }
}

export class OpenRouterClient implements OpenRouterApi {
  private readonly apiKey?: string;
  private readonly appName?: string;
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly managementApiKey?: string;
  private readonly siteUrl?: string;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterClientOptions = {}) {
    this.apiKey = cleanOptional(options.apiKey);
    this.appName = cleanOptional(options.appName) ?? "OpenRouter MCP Server";
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "https://openrouter.ai/api/v1");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.managementApiKey = cleanOptional(options.managementApiKey) ?? this.apiKey;
    this.siteUrl = cleanOptional(options.siteUrl);
    this.timeoutMs = options.timeoutMs ?? 60_000;

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error("OpenRouter timeout must be a positive integer.");
    }
  }

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): OpenRouterClient {
    return new OpenRouterClient({
      apiKey: environment.OPENROUTER_API_KEY,
      appName: environment.OPENROUTER_APP_NAME,
      baseUrl: environment.OPENROUTER_BASE_URL,
      managementApiKey: environment.OPENROUTER_MANAGEMENT_KEY,
      siteUrl: environment.OPENROUTER_SITE_URL,
      timeoutMs: parseTimeout(environment.OPENROUTER_TIMEOUT_MS),
    });
  }

  async listModels(options: ListModelsOptions = {}, signal?: AbortSignal): Promise<ListModelsResult> {
    const url = new URL("models", this.baseUrl);
    setQuery(url, "offset", options.offset ?? 0);
    setQuery(url, "limit", options.limit ?? 25);
    setQuery(url, "q", cleanOptional(options.q));
    setQuery(url, "category", options.category);
    setQuery(url, "supported_parameters", joinQuery(options.supportedParameters));
    setQuery(
      url,
      "output_modalities",
      options.outputModalities === "all" ? "all" : joinQuery(options.outputModalities),
    );
    setQuery(url, "sort", options.sort);
    setQuery(url, "input_modalities", joinQuery(options.inputModalities));
    setQuery(url, "context", options.minContextLength);
    setQuery(url, "min_price", options.minPromptPrice);
    setQuery(url, "max_price", options.maxPromptPrice);
    setQuery(url, "arch", cleanOptional(options.architecture));
    setQuery(url, "model_authors", joinQuery(options.modelAuthors));
    setQuery(url, "providers", joinQuery(options.providers));
    setQuery(url, "distillable", options.distillable);
    setQuery(url, "zdr", options.zdr);
    setQuery(url, "region", options.region);
    setQuery(url, "min_output_price", options.minOutputPrice);
    setQuery(url, "max_output_price", options.maxOutputPrice);
    setQuery(url, "min_age_days", options.minAgeDays);
    setQuery(url, "max_age_days", options.maxAgeDays);
    setQuery(url, "min_intelligence_index", options.minIntelligenceIndex);
    setQuery(url, "max_intelligence_index", options.maxIntelligenceIndex);
    setQuery(url, "min_coding_index", options.minCodingIndex);
    setQuery(url, "max_coding_index", options.maxCodingIndex);
    setQuery(url, "min_agentic_index", options.minAgenticIndex);
    setQuery(url, "max_agentic_index", options.maxAgenticIndex);
    setQuery(url, "min_tool_success_rate", options.minToolSuccessRate);
    setQuery(url, "max_tool_success_rate", options.maxToolSuccessRate);

    const payload = await this.request(url, { method: "GET" }, signal, "none");
    const response = modelsResponseSchema.parse(payload);
    return {
      models: response.data,
      totalCount: response.total_count,
      links: {
        next: response.links.next,
        previous: response.links.previous ?? response.links.prev,
      },
    };
  }

  async getModel(modelId: string, signal?: AbortSignal): Promise<OpenRouterModel> {
    const [author, slug] = parseModelId(modelId);
    const url = new URL("model/" + encodeURIComponent(author) + "/" + encodeURIComponent(slug), this.baseUrl);
    const payload = await this.request(url, { method: "GET" }, signal, "none");
    return modelResponseSchema.parse(payload).data;
  }

  async getModelEndpoints(modelId: string, signal?: AbortSignal): Promise<OpenRouterModelEndpoints> {
    const [author, slug] = parseModelId(modelId);
    const url = new URL(
      "models/" + encodeURIComponent(author) + "/" + encodeURIComponent(slug) + "/endpoints",
      this.baseUrl,
    );
    const payload = await this.request(url, { method: "GET" }, signal, "none");
    return endpointsResponseSchema.parse(payload).data;
  }

  async listProviders(signal?: AbortSignal): Promise<OpenRouterProvider[]> {
    const payload = await this.request(new URL("providers", this.baseUrl), { method: "GET" }, signal, "none");
    return providersResponseSchema.parse(payload).data;
  }

  async getCredits(signal?: AbortSignal): Promise<OpenRouterCredits> {
    const payload = await this.request(new URL("credits", this.baseUrl), { method: "GET" }, signal, "management");
    return creditsResponseSchema.parse(payload).data;
  }

  async getActivity(
    options: ActivityOptions = {},
    signal?: AbortSignal,
  ): Promise<OpenRouterActivityItem[]> {
    const url = new URL("activity", this.baseUrl);
    setQuery(url, "api_key_hash", cleanOptional(options.apiKeyHash));
    setQuery(url, "date", cleanOptional(options.date));
    setQuery(url, "group_by", options.groupBy);
    setQuery(url, "user_id", cleanOptional(options.userId));
    setQuery(url, "workspace_id", cleanOptional(options.workspaceId));
    const payload = await this.request(url, { method: "GET" }, signal, "management");
    return activityResponseSchema.parse(payload).data;
  }

  async getAnalyticsMeta(signal?: AbortSignal): Promise<OpenRouterAnalyticsMeta> {
    const payload = await this.request(
      new URL("analytics/meta", this.baseUrl),
      { method: "GET" },
      signal,
      "management",
    );
    return analyticsMetaResponseSchema.parse(payload).data;
  }

  async queryAnalytics(
    request: OpenRouterAnalyticsQuery,
    signal?: AbortSignal,
  ): Promise<OpenRouterAnalyticsQueryResult> {
    const validated = openRouterAnalyticsQuerySchema.parse(request);
    const payload = await this.request(
      new URL("analytics/query", this.baseUrl),
      { method: "POST", body: JSON.stringify(validated) },
      signal,
      "management",
    );
    const response = analyticsQueryResponseSchema.parse(payload).data;
    return openRouterAnalyticsQueryResultSchema.parse({
      cached_at: response.cachedAt,
      metadata: response.metadata,
      rows: response.data,
      warnings: response.warnings,
    });
  }

  async getModelRankings(
    options: ModelRankingsOptions = {},
    signal?: AbortSignal,
  ): Promise<RankingsResult<OpenRouterModelRankingItem>> {
    const url = new URL("datasets/rankings-daily", this.baseUrl);
    setQuery(url, "context_bucket", options.contextBucket);
    setQuery(url, "end_date", cleanOptional(options.endDate));
    setQuery(url, "modality", options.modality);
    setQuery(url, "period", options.period);
    setQuery(url, "start_date", cleanOptional(options.startDate));
    const payload = await this.request(url, { method: "GET" }, signal, "api");
    return modelRankingsResponseSchema.parse(payload);
  }

  async getAppRankings(
    options: AppRankingsOptions = {},
    signal?: AbortSignal,
  ): Promise<RankingsResult<OpenRouterAppRankingItem>> {
    const url = new URL("datasets/app-rankings", this.baseUrl);
    setQuery(url, "category", options.category);
    setQuery(url, "end_date", cleanOptional(options.endDate));
    setQuery(url, "limit", options.limit);
    setQuery(url, "offset", options.offset);
    setQuery(url, "sort", options.sort);
    setQuery(url, "start_date", cleanOptional(options.startDate));
    setQuery(url, "subcategory", options.subcategory);
    const payload = await this.request(url, { method: "GET" }, signal, "api");
    return appRankingsResponseSchema.parse(payload);
  }

  async getGeneration(generationId: string, signal?: AbortSignal): Promise<OpenRouterGeneration> {
    const url = new URL("generation", this.baseUrl);
    url.searchParams.set("id", generationId);
    const payload = await this.request(url, { method: "GET" }, signal, "api");
    return generationResponseSchema.parse(payload).data;
  }

  async getCurrentKey(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const payload = await this.request(new URL("key", this.baseUrl), { method: "GET" }, signal, "api");
    return keyResponseSchema.parse(payload).data;
  }

  async createChatCompletion(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResult> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.message });

    const payload = await this.request(
      new URL("chat/completions", this.baseUrl),
      {
        method: "POST",
        body: JSON.stringify({
          model: request.model,
          messages,
          max_completion_tokens: request.maxCompletionTokens,
          temperature: request.temperature,
        }),
      },
      signal,
      "api",
    );
    const completion = chatCompletionResponseSchema.parse(payload);
    const firstChoice = completion.choices[0];
    if (!firstChoice) {
      throw new Error("OpenRouter API returned no completion choice.");
    }

    return {
      content: firstChoice.message.content,
      generationId: completion.id,
      resolvedModel: completion.model,
      usage: completion.usage,
    };
  }

  private async request(
    url: URL,
    init: RequestInit,
    upstreamSignal: AbortSignal | undefined,
    authentication: AuthenticationMode,
  ): Promise<unknown> {
    const credential = this.credentialFor(authentication);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const cancel = (): void => controller.abort(upstreamSignal?.reason);

    if (upstreamSignal?.aborted) {
      cancel();
    } else {
      upstreamSignal?.addEventListener("abort", cancel, { once: true });
    }

    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (credential) {
      headers.set("Authorization", "Bearer " + credential);
    }
    if (this.siteUrl) {
      headers.set("HTTP-Referer", this.siteUrl);
    }
    if (this.appName) {
      headers.set("X-OpenRouter-Title", this.appName);
    }

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = parseJson(text);

      if (!response.ok) {
        throw new OpenRouterHttpError(response.status, extractErrorMessage(payload, text));
      }
      if (payload === undefined) {
        throw new Error("OpenRouter API returned an empty response.");
      }

      return payload;
    } catch (error) {
      if (upstreamSignal?.aborted) {
        throw upstreamSignal.reason instanceof Error
          ? upstreamSignal.reason
          : new Error("OpenRouter request was cancelled.");
      }
      if (timedOut) {
        throw new Error("OpenRouter request timed out after " + this.timeoutMs + " ms.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", cancel);
    }
  }

  private credentialFor(authentication: AuthenticationMode): string | undefined {
    if (authentication === "none") {
      return undefined;
    }
    if (authentication === "api") {
      if (!this.apiKey) {
        throw new Error("OPENROUTER_API_KEY is required for this operation.");
      }
      return this.apiKey;
    }
    if (!this.managementApiKey) {
      throw new Error(
        "OPENROUTER_MANAGEMENT_KEY is required for this operation (OPENROUTER_API_KEY is accepted when it is a management key).",
      );
    }
    return this.managementApiKey;
  }
}

function setQuery(url: URL, name: string, value: string | number | boolean | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, String(value));
  }
}

function joinQuery(values: readonly string[] | undefined): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return values.join(",");
}

function parseModelId(modelId: string): [author: string, slug: string] {
  const separator = modelId.indexOf("/");
  if (separator <= 0 || separator === modelId.length - 1 || modelId.indexOf("/", separator + 1) !== -1) {
    throw new Error("OpenRouter model ID must use the author/slug format.");
  }
  return [modelId.slice(0, separator), modelId.slice(separator + 1)];
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizeBaseUrl(value: string): URL {
  const normalized = value.endsWith("/") ? value : value + "/";
  const url = new URL(normalized);
  if (url.username || url.password) {
    throw new Error("OPENROUTER_BASE_URL must not contain credentials.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new Error("OPENROUTER_BASE_URL must use HTTPS; HTTP is allowed only for loopback development.");
  }
  return url;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function parseTimeout(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("OPENROUTER_TIMEOUT_MS must be a positive integer.");
  }
  return parsed;
}

function parseJson(text: string): unknown {
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const error = payload.error;
    if (isRecord(error) && typeof error.message === "string") {
      return truncate(error.message);
    }
    if (typeof error === "string") {
      return truncate(error);
    }
    if (typeof payload.message === "string") {
      return truncate(payload.message);
    }
  }
  return truncate(fallback || "Unknown OpenRouter error");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length > 1_000 ? singleLine.slice(0, 1_000) + "..." : singleLine;
}
