import type {
  AppRankingsOptions,
  ListModelsOptions,
  OpenRouterActivityItem,
  OpenRouterApi,
  OpenRouterAppRankingItem,
  OpenRouterAnalyticsMeta,
  OpenRouterAnalyticsQuery,
  OpenRouterAnalyticsQueryResult,
  OpenRouterCredits,
  OpenRouterEndpoint,
  OpenRouterGeneration,
  OpenRouterModel,
  OpenRouterPricing,
  OpenRouterProvider,
  OpenRouterRankingsMeta,
} from "./openrouter.js";

const COMPARE_CONCURRENCY = 3;

export interface ListModelsInput {
  architecture?: string;
  category?: ListModelsOptions["category"];
  distillable?: boolean;
  input_modalities?: ListModelsOptions["inputModalities"];
  limit: number;
  max_agentic_index?: number;
  max_age_days?: number;
  max_coding_index?: number;
  max_intelligence_index?: number;
  max_output_price?: number;
  max_prompt_price?: number;
  max_tool_success_rate?: number;
  min_agentic_index?: number;
  min_age_days?: number;
  min_coding_index?: number;
  min_context_length?: number;
  min_intelligence_index?: number;
  min_output_price?: number;
  min_prompt_price?: number;
  min_tool_success_rate?: number;
  model_authors?: string[];
  offset: number;
  output_modalities?: ListModelsOptions["outputModalities"];
  providers?: string[];
  q?: string;
  region?: ListModelsOptions["region"];
  sort?: ListModelsOptions["sort"];
  supported_parameters?: string[];
  zdr?: true;
}

export interface ModelSummary {
  agentic_index?: number | null;
  canonical_slug?: string;
  coding_index?: number | null;
  context_length?: number;
  created?: number;
  id: string;
  input_modalities?: string[];
  intelligence_index?: number | null;
  max_completion_tokens?: number | null;
  name?: string;
  output_modalities?: string[];
  pricing?: OpenRouterPricing;
}

export interface ListModelsOutput {
  has_more: boolean;
  models: ModelSummary[];
  next_offset: number | null;
  offset: number;
  returned: number;
  total_count: number;
}

export interface ListModelEndpointsInput {
  limit: number;
  model: string;
  offset: number;
  provider?: string;
}

export interface ListModelEndpointsOutput {
  endpoints: OpenRouterEndpoint[];
  has_more: boolean;
  model: { id: string; name?: string };
  next_offset: number | null;
  offset: number;
  returned: number;
  total_count: number;
}

export interface ChatInput {
  max_completion_tokens: number;
  message: string;
  model: string;
  system_prompt?: string;
  temperature: number;
}

export interface ChatOutput {
  generation_id: string;
  requested_model: string;
  resolved_model: string | null;
  response: string;
  usage: Record<string, unknown> | null;
}

export interface CompareInput {
  max_completion_tokens: number;
  message: string;
  models: string[];
}

export interface ComparisonResult {
  error?: string;
  generation_id?: string;
  requested_model: string;
  resolved_model?: string | null;
  response?: string;
  success: boolean;
  usage?: Record<string, unknown> | null;
}

export interface CompareOutput {
  results: ComparisonResult[];
}

export interface ListProvidersInput {
  datacenter?: string;
  headquarters?: string;
  limit: number;
  offset: number;
  q?: string;
}

export interface ListProvidersOutput {
  has_more: boolean;
  next_offset: number | null;
  offset: number;
  providers: OpenRouterProvider[];
  returned: number;
  total_count: number;
}

export interface CreditsOutput extends OpenRouterCredits {
  remaining_credits: number;
}

export interface ListActivityInput {
  api_key_hash?: string;
  date?: string;
  group_by?: "workspace";
  limit: number;
  offset: number;
  user_id?: string;
  workspace_id?: string;
}

export interface ListActivityOutput {
  activity: OpenRouterActivityItem[];
  date: string;
  has_more: boolean;
  next_offset: number | null;
  offset: number;
  returned: number;
  total_count: number;
}

export type AnalyticsQueryInput = OpenRouterAnalyticsQuery;
export type AnalyticsQueryOutput = OpenRouterAnalyticsQueryResult;

export interface ListModelRankingsInput {
  context_bucket?: "1K" | "10K" | "100K" | "1M" | "10M";
  date?: string;
  include_other: boolean;
  limit: number;
  modality?: "text" | "image" | "image_output" | "audio" | "tool_calling";
}

export interface RankedModel {
  date: string;
  model_permaslug: string;
  rank: number;
  total_tokens: string;
}

export interface ListModelRankingsOutput {
  attribution: string;
  date: string;
  rankings: RankedModel[];
  returned: number;
  meta: OpenRouterRankingsMeta;
}

export interface ListAppRankingsInput {
  category?: AppRankingsOptions["category"];
  end_date?: string;
  limit: number;
  offset: number;
  sort: "popular" | "trending";
  start_date?: string;
  subcategory?: AppRankingsOptions["subcategory"];
}

export interface ListAppRankingsOutput {
  apps: OpenRouterAppRankingItem[];
  attribution: string;
  has_more: boolean;
  meta: OpenRouterRankingsMeta;
  next_offset: number | null;
  offset: number;
  returned: number;
}

export async function listModels(
  api: OpenRouterApi,
  input: ListModelsInput,
  signal?: AbortSignal,
): Promise<ListModelsOutput> {
  const options: ListModelsOptions = {
    architecture: input.architecture,
    category: input.category,
    distillable: input.distillable,
    inputModalities: input.input_modalities,
    limit: input.limit,
    maxAgenticIndex: input.max_agentic_index,
    maxAgeDays: input.max_age_days,
    maxCodingIndex: input.max_coding_index,
    maxIntelligenceIndex: input.max_intelligence_index,
    maxOutputPrice: input.max_output_price,
    maxPromptPrice: input.max_prompt_price,
    maxToolSuccessRate: input.max_tool_success_rate,
    minAgenticIndex: input.min_agentic_index,
    minAgeDays: input.min_age_days,
    minCodingIndex: input.min_coding_index,
    minContextLength: input.min_context_length,
    minIntelligenceIndex: input.min_intelligence_index,
    minOutputPrice: input.min_output_price,
    minPromptPrice: input.min_prompt_price,
    minToolSuccessRate: input.min_tool_success_rate,
    modelAuthors: input.model_authors,
    offset: input.offset,
    outputModalities: input.output_modalities,
    providers: input.providers,
    q: input.q,
    region: input.region,
    sort: input.sort,
    supportedParameters: input.supported_parameters,
    zdr: input.zdr,
  };
  const page = await api.listModels(options, signal);
  const models = page.models.map(summarizeModel);
  const hasMore = models.length > 0 && input.offset + models.length < page.totalCount;
  return {
    has_more: hasMore,
    models,
    next_offset: hasMore ? input.offset + models.length : null,
    offset: input.offset,
    returned: models.length,
    total_count: page.totalCount,
  };
}

export async function getModel(
  api: OpenRouterApi,
  model: string,
  signal?: AbortSignal,
): Promise<{ model: OpenRouterModel }> {
  return { model: await api.getModel(model, signal) };
}

export async function listModelEndpoints(
  api: OpenRouterApi,
  input: ListModelEndpointsInput,
  signal?: AbortSignal,
): Promise<ListModelEndpointsOutput> {
  const result = await api.getModelEndpoints(input.model, signal);
  const query = input.provider?.toLowerCase();
  const filtered = query
    ? result.endpoints.filter((endpoint) =>
        [endpoint.provider_name, endpoint.tag, endpoint.name].some((value) => value?.toLowerCase().includes(query)),
      )
    : result.endpoints;
  const endpoints = filtered.slice(input.offset, input.offset + input.limit);
  const hasMore = endpoints.length > 0 && input.offset + endpoints.length < filtered.length;
  return {
    endpoints,
    has_more: hasMore,
    model: { id: result.id, name: result.name },
    next_offset: hasMore ? input.offset + endpoints.length : null,
    offset: input.offset,
    returned: endpoints.length,
    total_count: filtered.length,
  };
}

export async function chatWithModel(
  api: OpenRouterApi,
  input: ChatInput,
  signal?: AbortSignal,
): Promise<ChatOutput> {
  const result = await api.createChatCompletion(
    {
      model: input.model,
      message: input.message,
      maxCompletionTokens: input.max_completion_tokens,
      temperature: input.temperature,
      systemPrompt: input.system_prompt,
    },
    signal,
  );
  return {
    generation_id: result.generationId,
    requested_model: input.model,
    resolved_model: result.resolvedModel ?? null,
    response: normalizeContent(result.content),
    usage: result.usage ?? null,
  };
}

export async function compareModels(
  api: OpenRouterApi,
  input: CompareInput,
  signal?: AbortSignal,
): Promise<CompareOutput> {
  const results = await mapWithConcurrency(input.models, COMPARE_CONCURRENCY, async (model) => {
    try {
      const result = await api.createChatCompletion(
        {
          model,
          message: input.message,
          maxCompletionTokens: input.max_completion_tokens,
          temperature: 0.7,
        },
        signal,
      );
      return {
        generation_id: result.generationId,
        requested_model: model,
        resolved_model: result.resolvedModel ?? null,
        success: true,
        response: normalizeContent(result.content),
        usage: result.usage ?? null,
      };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      return {
        requested_model: model,
        success: false,
        error: toErrorMessage(error),
      };
    }
  });
  return { results };
}

export async function getGeneration(
  api: OpenRouterApi,
  generationId: string,
  signal?: AbortSignal,
): Promise<{ generation: OpenRouterGeneration }> {
  return { generation: await api.getGeneration(generationId, signal) };
}

export async function listProviders(
  api: OpenRouterApi,
  input: ListProvidersInput,
  signal?: AbortSignal,
): Promise<ListProvidersOutput> {
  const providers = await api.listProviders(signal);
  const query = input.q?.toLowerCase();
  const datacenter = input.datacenter?.toUpperCase();
  const headquarters = input.headquarters?.toUpperCase();
  const filtered = providers.filter((provider) => {
    if (query && !provider.name.toLowerCase().includes(query) && !provider.slug.toLowerCase().includes(query)) {
      return false;
    }
    if (datacenter && !provider.datacenters?.includes(datacenter)) {
      return false;
    }
    return !headquarters || provider.headquarters === headquarters;
  });
  const page = filtered.slice(input.offset, input.offset + input.limit);
  const hasMore = page.length > 0 && input.offset + page.length < filtered.length;
  return {
    has_more: hasMore,
    next_offset: hasMore ? input.offset + page.length : null,
    offset: input.offset,
    providers: page,
    returned: page.length,
    total_count: filtered.length,
  };
}

export async function getCredits(api: OpenRouterApi, signal?: AbortSignal): Promise<CreditsOutput> {
  const credits = await api.getCredits(signal);
  return {
    ...credits,
    remaining_credits: Math.max(0, credits.total_credits - credits.total_usage),
  };
}

export async function listActivity(
  api: OpenRouterApi,
  input: ListActivityInput,
  signal?: AbortSignal,
): Promise<ListActivityOutput> {
  const date = input.date ?? mostRecentCompletedUtcDate();
  const activity = await api.getActivity(
    {
      apiKeyHash: input.api_key_hash,
      date,
      groupBy: input.group_by,
      userId: input.user_id,
      workspaceId: input.workspace_id,
    },
    signal,
  );
  const page = activity.slice(input.offset, input.offset + input.limit);
  const hasMore = page.length > 0 && input.offset + page.length < activity.length;
  return {
    activity: page,
    date,
    has_more: hasMore,
    next_offset: hasMore ? input.offset + page.length : null,
    offset: input.offset,
    returned: page.length,
    total_count: activity.length,
  };
}

export async function getAnalyticsSchema(
  api: OpenRouterApi,
  signal?: AbortSignal,
): Promise<{ schema: OpenRouterAnalyticsMeta }> {
  return { schema: await api.getAnalyticsMeta(signal) };
}

export async function queryAnalytics(
  api: OpenRouterApi,
  input: AnalyticsQueryInput,
  signal?: AbortSignal,
): Promise<AnalyticsQueryOutput> {
  return api.queryAnalytics(input, signal);
}

export async function listModelRankings(
  api: OpenRouterApi,
  input: ListModelRankingsInput,
  signal?: AbortSignal,
): Promise<ListModelRankingsOutput> {
  const date = input.date ?? mostRecentCompletedUtcDate();
  const result = await api.getModelRankings(
    {
      contextBucket: input.context_bucket,
      endDate: date,
      modality: input.modality,
      period: "day",
      startDate: date,
    },
    signal,
  );
  const rankings = result.data
    .filter((item) => input.include_other || item.model_permaslug !== "other")
    .slice(0, input.limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    attribution: "Source: OpenRouter (openrouter.ai/rankings), as of " + result.meta.as_of + ".",
    date,
    rankings,
    returned: rankings.length,
    meta: result.meta,
  };
}

export async function listAppRankings(
  api: OpenRouterApi,
  input: ListAppRankingsInput,
  signal?: AbortSignal,
): Promise<ListAppRankingsOutput> {
  const result = await api.getAppRankings(
    {
      category: input.category,
      endDate: input.end_date,
      limit: Math.min(100, input.limit + 1),
      offset: input.offset,
      sort: input.sort,
      startDate: input.start_date,
      subcategory: input.subcategory,
    },
    signal,
  );
  const apps = result.data.slice(0, input.limit);
  const hasMore = result.data.length > input.limit;
  return {
    apps,
    attribution: "Source: OpenRouter (openrouter.ai/apps), as of " + result.meta.as_of + ".",
    has_more: hasMore,
    meta: result.meta,
    next_offset: hasMore ? input.offset + apps.length : null,
    offset: input.offset,
    returned: apps.length,
  };
}

export function mostRecentCompletedUtcDate(now: Date = new Date()): string {
  const completed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return completed.toISOString().slice(0, 10);
}

function summarizeModel(model: OpenRouterModel): ModelSummary {
  return {
    id: model.id,
    name: model.name,
    canonical_slug: model.canonical_slug,
    created: model.created,
    context_length: model.context_length,
    input_modalities: model.architecture?.input_modalities,
    output_modalities: model.architecture?.output_modalities,
    pricing: model.pricing,
    max_completion_tokens: model.top_provider?.max_completion_tokens,
    intelligence_index: model.benchmarks?.artificial_analysis?.intelligence_index,
    coding_index: model.benchmarks?.artificial_analysis?.coding_index,
    agentic_index: model.benchmarks?.artificial_analysis?.agentic_index,
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await operation(item);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content) ?? String(content);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
