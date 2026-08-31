import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  OpenRouterClient,
  openRouterModelSchema,
  type OpenRouterApi,
  type OpenRouterModel,
} from "./openrouter.js";

export const SERVER_NAME = "openrouter-mcp-server";
export const SERVER_VERSION = "2.0.0";

const pricingValueSchema = z.union([z.string(), z.number(), z.null()]);
const pricingSchema = z.record(z.string(), pricingValueSchema);
const usageSchema = z.record(z.string(), z.unknown()).nullable();

const modelSummarySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  context_length: z.number().int().nonnegative().optional(),
  pricing: pricingSchema.optional(),
});

const listModelsInputSchema = z
  .object({
    q: z.string().trim().min(1).optional().describe("Optional text query passed to OpenRouter."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum models to return, from 1 to 100."),
    offset: z.number().int().min(0).default(0).describe("Zero-based offset into the matching models."),
  })
  .strict();

const listModelsOutputSchema = z.object({
  models: z.array(modelSummarySchema),
  total_available: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  next_offset: z.number().int().nonnegative().nullable(),
});

const chatInputSchema = z
  .object({
    model: z.string().trim().min(1).describe("Exact OpenRouter model ID."),
    message: z.string().min(1).describe("User message to send to the model."),
    max_completion_tokens: z
      .number()
      .int()
      .min(1)
      .max(131_072)
      .optional()
      .describe("Maximum generated tokens. Preferred over the deprecated max_tokens alias."),
    max_tokens: z
      .number()
      .int()
      .min(1)
      .max(131_072)
      .optional()
      .describe("Deprecated compatibility alias for max_completion_tokens."),
    temperature: z.number().min(0).max(2).default(0.7),
    system_prompt: z.string().min(1).optional(),
  })
  .strict();

const chatOutputSchema = z.object({
  model: z.string(),
  response: z.string(),
  usage: usageSchema,
});

const compareInputSchema = z
  .object({
    models: z
      .array(z.string().trim().min(1))
      .min(2)
      .max(8)
      .describe("Two to eight exact OpenRouter model IDs."),
    message: z.string().min(1),
    max_completion_tokens: z.number().int().min(1).max(131_072).optional(),
    max_tokens: z
      .number()
      .int()
      .min(1)
      .max(131_072)
      .optional()
      .describe("Deprecated compatibility alias for max_completion_tokens."),
  })
  .strict();

const comparisonResultSchema = z.object({
  model: z.string(),
  success: z.boolean(),
  response: z.string().optional(),
  usage: usageSchema.optional(),
  error: z.string().optional(),
});

const compareOutputSchema = z.object({
  results: z.array(comparisonResultSchema),
});

const getModelInfoInputSchema = z
  .object({
    model: z.string().trim().min(1).describe("Exact OpenRouter model ID."),
  })
  .strict();

const getModelInfoOutputSchema = z.object({
  model: openRouterModelSchema,
});

export function createOpenRouterMcpServer(api: OpenRouterApi = OpenRouterClient.fromEnvironment()): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerResources(server, api);
  registerTools(server, api);
  return server;
}

export function createOpenRouterMcpHandler(api: OpenRouterApi = OpenRouterClient.fromEnvironment()) {
  return createMcpHandler(() => createOpenRouterMcpServer(api));
}

function registerResources(server: McpServer, api: OpenRouterApi): void {
  server.registerResource(
    "available-models",
    "openrouter://models",
    {
      title: "Available OpenRouter models",
      description: "Current OpenRouter model metadata, including context limits and pricing.",
      mimeType: "application/json",
      cacheHint: { ttlMs: 60_000, cacheScope: "private" },
    },
    async (uri, ctx) => {
      const models = await api.listModels({}, ctx.mcpReq.signal);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ data: models }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "model-pricing",
    "openrouter://pricing",
    {
      title: "OpenRouter model pricing",
      description: "Current pricing fields for available OpenRouter models.",
      mimeType: "application/json",
      cacheHint: { ttlMs: 60_000, cacheScope: "private" },
    },
    async (uri, ctx) => {
      const models = await api.listModels({}, ctx.mcpReq.signal);
      const pricing = models.map((model) => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
      }));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ data: pricing }, null, 2),
          },
        ],
      };
    },
  );

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
      description: "Search and page through currently available OpenRouter models.",
      inputSchema: listModelsInputSchema,
      outputSchema: listModelsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ q, limit, offset }, ctx) => {
      const models = await api.listModels({ q }, ctx.mcpReq.signal);
      const page = models.slice(offset, offset + limit).map(summarizeModel);
      const nextOffset = offset + page.length < models.length ? offset + page.length : null;
      const output = {
        models: page,
        total_available: models.length,
        returned: page.length,
        offset,
        next_offset: nextOffset,
      };
      return toolResult(output);
    },
  );

  server.registerTool(
    "chat_with_model",
    {
      title: "Chat with an OpenRouter model",
      description: "Generate one model response through OpenRouter. This can consume paid API credits.",
      inputSchema: chatInputSchema,
      outputSchema: chatOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input, ctx) => {
      const result = await api.createChatCompletion(
        {
          model: input.model,
          message: input.message,
          maxCompletionTokens: input.max_completion_tokens ?? input.max_tokens ?? 1_000,
          temperature: input.temperature,
          systemPrompt: input.system_prompt,
        },
        ctx.mcpReq.signal,
      );
      const output = {
        model: input.model,
        response: normalizeContent(result.content),
        usage: result.usage ?? null,
      };
      return toolResult(output);
    },
  );

  server.registerTool(
    "compare_models",
    {
      title: "Compare OpenRouter models",
      description: "Generate the same prompt with two to eight models. Each model call can consume paid API credits.",
      inputSchema: compareInputSchema,
      outputSchema: compareOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input, ctx) => {
      const maxCompletionTokens = input.max_completion_tokens ?? input.max_tokens ?? 500;
      const results = await Promise.all(
        input.models.map(async (model) => {
          try {
            const result = await api.createChatCompletion(
              {
                model,
                message: input.message,
                maxCompletionTokens,
                temperature: 0.7,
              },
              ctx.mcpReq.signal,
            );
            return {
              model,
              success: true,
              response: normalizeContent(result.content),
              usage: result.usage ?? null,
            };
          } catch (error) {
            if (ctx.mcpReq.signal.aborted) {
              throw error;
            }
            return {
              model,
              success: false,
              error: toErrorMessage(error),
            };
          }
        }),
      );
      return toolResult({ results });
    },
  );

  server.registerTool(
    "get_model_info",
    {
      title: "Get OpenRouter model information",
      description: "Return current metadata for one exact OpenRouter model ID.",
      inputSchema: getModelInfoInputSchema,
      outputSchema: getModelInfoOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ model: modelId }, ctx) => {
      const matches = await api.listModels({ q: modelId }, ctx.mcpReq.signal);
      const model = matches.find((candidate) => candidate.id === modelId);
      if (!model) {
        throw new Error("OpenRouter model not found: " + modelId);
      }
      return toolResult({ model });
    },
  );
}

function summarizeModel(model: OpenRouterModel): z.infer<typeof modelSummarySchema> {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    context_length: model.context_length,
    pricing: model.pricing,
  };
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

function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  const serialized = JSON.stringify(content);
  return serialized ?? String(content);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
