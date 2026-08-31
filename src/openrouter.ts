import * as z from "zod/v4";

const pricingValueSchema = z.union([z.string(), z.number(), z.null()]);

export const openRouterModelSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    context_length: z.number().int().nonnegative().optional(),
    pricing: z.record(z.string(), pricingValueSchema).optional(),
  })
  .passthrough();

const modelsResponseSchema = z
  .object({
    data: z.array(openRouterModelSchema),
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
    usage: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;

export interface ListModelsOptions {
  q?: string;
}

export interface ChatCompletionRequest {
  model: string;
  message: string;
  maxCompletionTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface ChatCompletionResult {
  content: unknown;
  usage?: Record<string, unknown>;
}

export interface OpenRouterApi {
  listModels(options: ListModelsOptions, signal?: AbortSignal): Promise<OpenRouterModel[]>;
  getCurrentKey(signal?: AbortSignal): Promise<Record<string, unknown>>;
  createChatCompletion(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResult>;
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  appName?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  siteUrl?: string;
  timeoutMs?: number;
}

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
  private readonly siteUrl?: string;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterClientOptions = {}) {
    this.apiKey = cleanOptional(options.apiKey);
    this.appName = cleanOptional(options.appName) ?? "OpenRouter MCP Server";
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "https://openrouter.ai/api/v1");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
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
      siteUrl: environment.OPENROUTER_SITE_URL,
      timeoutMs: parseTimeout(environment.OPENROUTER_TIMEOUT_MS),
    });
  }

  async listModels(options: ListModelsOptions = {}, signal?: AbortSignal): Promise<OpenRouterModel[]> {
    const url = new URL("models", this.baseUrl);
    const query = cleanOptional(options.q);
    if (query) {
      url.searchParams.set("q", query);
    }

    const payload = await this.request(url, { method: "GET" }, signal, false);
    return modelsResponseSchema.parse(payload).data;
  }

  async getCurrentKey(signal?: AbortSignal): Promise<Record<string, unknown>> {
    this.assertApiKey();
    const payload = await this.request(new URL("key", this.baseUrl), { method: "GET" }, signal, true);
    return keyResponseSchema.parse(payload).data;
  }

  async createChatCompletion(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResult> {
    this.assertApiKey();
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
      true,
    );
    const completion = chatCompletionResponseSchema.parse(payload);
    const firstChoice = completion.choices[0];
    if (!firstChoice) {
      throw new Error("OpenRouter API returned no completion choice.");
    }

    return {
      content: firstChoice.message.content,
      usage: completion.usage,
    };
  }

  private assertApiKey(): void {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is required for this operation.");
    }
  }

  private async request(
    url: URL,
    init: RequestInit,
    upstreamSignal: AbortSignal | undefined,
    requiresApiKey: boolean,
  ): Promise<unknown> {
    if (requiresApiKey) {
      this.assertApiKey();
    }

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
    if (this.apiKey) {
      headers.set("Authorization", "Bearer " + this.apiKey);
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
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizeBaseUrl(value: string): URL {
  const normalized = value.endsWith("/") ? value : value + "/";
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OPENROUTER_BASE_URL must use http or https.");
  }
  return url;
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
