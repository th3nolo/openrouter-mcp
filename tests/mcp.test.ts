import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { createOpenRouterMcpHandler } from "../src/mcp.js";
import {
  OpenRouterClient,
  OpenRouterHttpError,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ListModelsOptions,
  type OpenRouterApi,
  type OpenRouterModel,
} from "../src/openrouter.js";

class FakeOpenRouterApi implements OpenRouterApi {
  readonly models: OpenRouterModel[] = [
    {
      id: "example/alpha",
      name: "Alpha",
      context_length: 32_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
    {
      id: "example/beta",
      name: "Beta",
      context_length: 64_000,
      pricing: { prompt: "0.000003", completion: "0.000004" },
    },
  ];

  listModelsHook?: (options: ListModelsOptions, signal?: AbortSignal) => Promise<OpenRouterModel[]>;
  chatError?: Error;

  async listModels(options: ListModelsOptions, signal?: AbortSignal): Promise<OpenRouterModel[]> {
    if (this.listModelsHook) {
      return this.listModelsHook(options, signal);
    }
    signal?.throwIfAborted();
    const query = options.q?.toLowerCase();
    return query ? this.models.filter((model) => model.id.toLowerCase().includes(query)) : this.models;
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
    if (this.chatError) {
      throw this.chatError;
    }
    return {
      content: "response from " + request.model,
      usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
    };
  }
}

async function connectHttp(api: OpenRouterApi, mode: "auto" | "legacy" = "auto") {
  const handler = createOpenRouterMcpHandler(api);
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client(
    { name: "openrouter-mcp-test", version: "1.0.0" },
    { versionNegotiation: { mode } },
  );
  await client.connect(transport);
  return { client, handler };
}

test("serves MCP 2026-07-28 directly with structured, annotated tools", async (context) => {
  const api = new FakeOpenRouterApi();
  const { client, handler } = await connectHttp(api);
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  assert.equal(client.getProtocolEra(), "modern");
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  assert.deepEqual(names, ["list_models", "chat_with_model", "compare_models", "get_model_info"]);

  const listTool = listed.tools.find((tool) => tool.name === "list_models");
  assert.equal(listTool?.annotations?.readOnlyHint, true);
  assert.ok(listTool?.outputSchema);

  const result = await client.callTool({
    name: "list_models",
    arguments: { limit: 1, offset: 0 },
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    models: [
      {
        id: "example/alpha",
        name: "Alpha",
        context_length: 32_000,
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
    ],
    total_available: 2,
    returned: 1,
    offset: 0,
    next_offset: 1,
  });

  const invalid = await client.callTool({
    name: "list_models",
    arguments: { limit: 0 },
  });
  assert.equal(invalid.isError, true);
});

test("accepts a conformant modern tools/list request without initialize or session state", async () => {
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
      result: { tools: Array<{ name: string }> };
    };
    assert.equal(body.id, 7);
    assert.ok(body.result.tools.some((tool) => tool.name === "list_models"));
    assert.equal(response.headers.has("Mcp-Session-Id"), false);
  } finally {
    await handler.close();
  }
});

test("retains the legacy initialization path for older Claude clients", async (context) => {
  const { client, handler } = await connectHttp(new FakeOpenRouterApi(), "legacy");
  context.after(async () => {
    await client.close();
    await handler.close();
  });

  assert.equal(client.getProtocolEra(), "legacy");
  const listed = await client.listTools();
  assert.ok(listed.tools.some((tool) => tool.name === "chat_with_model"));
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

test("forwards MCP cancellation to the in-flight OpenRouter operation", async (context) => {
  const api = new FakeOpenRouterApi();
  let observedSignal: AbortSignal | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  api.listModelsHook = async (_options, signal) => {
    observedSignal = signal;
    markStarted?.();
    return new Promise<OpenRouterModel[]>((_resolve, reject) => {
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
    { versionNegotiation: { mode: "auto" } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      path.resolve("src/server.ts"),
      "--transport",
      "stdio",
    ],
    cwd: process.cwd(),
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "modern");
    const listed = await client.listTools();
    assert.ok(listed.tools.some((tool) => tool.name === "get_model_info"));
  } finally {
    await client.close();
  }
});

test("uses current OpenRouter headers and max_completion_tokens", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
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
