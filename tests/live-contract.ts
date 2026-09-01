import assert from "node:assert/strict";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { config as loadEnvironment } from "dotenv";

import { createOpenRouterMcpHandler } from "../src/mcp.js";
import { OpenRouterClient, type OpenRouterApi } from "../src/openrouter.js";

loadEnvironment({ quiet: true });

const publicSession = await connectMcp(new OpenRouterClient());
const listed = await publicSession.client.listTools();
assert.equal(listed.ttlMs, 3_600_000);
assert.equal(listed.cacheScope, "public");

const listResult = await publicSession.client.callTool({
  name: "list_models",
  arguments: { limit: 2, offset: 0, sort: "newest" },
});
assertToolSuccess(listResult, "list_models");
const page = listResult.structuredContent as {
  models: Array<{ id: string }>;
  total_count: number;
};
assert.equal(page.models.length, 2);
assert.ok(page.total_count >= page.models.length);

const first = page.models[0];
assert.ok(first);
const modelResult = await publicSession.client.callTool({
  name: "get_model",
  arguments: { model: first.id },
});
assertToolSuccess(modelResult, "get_model");
const model = modelResult.structuredContent as { model: { id: string } };
assert.equal(model.model.id, first.id);

const endpointsResult = await publicSession.client.callTool({
  name: "list_model_endpoints",
  arguments: { model: first.id, limit: 100 },
});
assertToolSuccess(endpointsResult, "list_model_endpoints");
const endpoints = endpointsResult.structuredContent as {
  endpoints: unknown[];
  model: { id: string };
};
assert.equal(endpoints.model.id, first.id);

const providersResult = await publicSession.client.callTool({
  name: "list_providers",
  arguments: { limit: 100, offset: 0 },
});
assertToolSuccess(providersResult, "list_providers");
const providers = providersResult.structuredContent as {
  providers: unknown[];
  total_count: number;
};
assert.ok(providers.providers.length > 0);
assert.ok(providers.total_count >= providers.providers.length);
await publicSession.client.close();
await publicSession.handler.close();

const report: Record<string, unknown> = {
  catalog: "pass",
  mcp_protocol: "2026-07-28",
  total_models: page.total_count,
  sampled_model: first.id,
  sampled_endpoints: endpoints.endpoints.length,
  provider_count: providers.total_count,
  rankings: "skipped: OPENROUTER_API_KEY is not configured",
  free_inference: "skipped: OPENROUTER_API_KEY is not configured",
  management: "skipped: OPENROUTER_MANAGEMENT_KEY is not configured",
};

if (process.env.OPENROUTER_API_KEY?.trim()) {
  const authenticatedSession = await connectMcp(OpenRouterClient.fromEnvironment());
  try {
    const modelRankingsResult = await authenticatedSession.client.callTool({
      name: "list_model_rankings",
      arguments: { limit: 3 },
    });
    assertToolSuccess(modelRankingsResult, "list_model_rankings");
    const modelRankings = modelRankingsResult.structuredContent as { rankings: unknown[] };

    const appRankingsResult = await authenticatedSession.client.callTool({
      name: "list_app_rankings",
      arguments: { limit: 3, offset: 0, sort: "popular" },
    });
    assertToolSuccess(appRankingsResult, "list_app_rankings");
    const appRankings = appRankingsResult.structuredContent as { apps: unknown[] };

    report.rankings = "pass";
    report.sampled_model_rankings = modelRankings.rankings.length;
    report.sampled_app_rankings = appRankings.apps.length;
  } catch (error) {
    report.rankings = "fail";
    report.rankings_error = { message: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
  }

  try {
    const completionResult = await authenticatedSession.client.callTool({
      name: "chat_with_model",
      arguments: {
        model: "openrouter/free",
        message: "Reply with OK.",
        max_completion_tokens: 4,
        temperature: 0,
      },
    });
    assertToolSuccess(completionResult, "chat_with_model");
    const completion = completionResult.structuredContent as {
      generation_id: string;
      resolved_model: string | null;
    };
    assert.ok(completion.generation_id);
    await new Promise<void>((resolve) => setTimeout(resolve, 750));
    const generationResult = await authenticatedSession.client.callTool({
      name: "get_generation",
      arguments: { generation_id: completion.generation_id },
    });
    assertToolSuccess(generationResult, "get_generation");
    const generation = generationResult.structuredContent as {
      generation: {
        id: string;
        model?: string;
        provider_name?: string | null;
        total_cost?: number | null;
      };
    };
    assert.equal(generation.generation.id, completion.generation_id);
    report.free_inference = "pass";
    report.resolved_model = completion.resolved_model ?? generation.generation.model ?? null;
    report.provider = generation.generation.provider_name ?? null;
    report.total_cost = generation.generation.total_cost ?? null;
  } catch (error) {
    report.free_inference = "fail";
    report.inference_error = { message: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
  } finally {
    await authenticatedSession.client.close();
    await authenticatedSession.handler.close();
  }
}

if (process.env.OPENROUTER_MANAGEMENT_KEY?.trim()) {
  const managementSession = await connectMcp(OpenRouterClient.fromEnvironment());
  try {
    const creditsResult = await managementSession.client.callTool({
      name: "get_credits",
      arguments: {},
    });
    assertToolSuccess(creditsResult, "get_credits");

    const activityResult = await managementSession.client.callTool({
      name: "list_activity",
      arguments: { limit: 2, offset: 0 },
    });
    assertToolSuccess(activityResult, "list_activity");
    const activity = activityResult.structuredContent as { activity: unknown[] };

    const analyticsSchemaResult = await managementSession.client.callTool({
      name: "get_analytics_schema",
      arguments: {},
    });
    assertToolSuccess(analyticsSchemaResult, "get_analytics_schema");
    const analyticsSchema = analyticsSchemaResult.structuredContent as {
      schema: { dimensions: unknown[]; metrics: unknown[] };
    };

    const analyticsResult = await managementSession.client.callTool({
      name: "query_analytics",
      arguments: {
        metrics: ["request_count"],
        time_range: { start: utcBoundary(7), end: utcBoundary(0) },
        limit: 2,
      },
    });
    assertToolSuccess(analyticsResult, "query_analytics");
    const analytics = analyticsResult.structuredContent as {
      metadata: { row_count: number; truncated: boolean };
    };

    report.management = "pass";
    report.sampled_activity = activity.activity.length;
    report.analytics_dimensions = analyticsSchema.schema.dimensions.length;
    report.analytics_metrics = analyticsSchema.schema.metrics.length;
    report.analytics_rows = analytics.metadata.row_count;
    report.analytics_truncated = analytics.metadata.truncated;
  } catch (error) {
    report.management = "fail";
    report.management_error = { message: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
  } finally {
    await managementSession.client.close();
    await managementSession.handler.close();
  }
}

process.stdout.write(JSON.stringify(report, null, 2) + "\n");

async function connectMcp(api: OpenRouterApi) {
  const handler = createOpenRouterMcpHandler(api);
  const transport = new StreamableHTTPClientTransport(new URL("http://live-contract.local/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client(
    { name: "openrouter-live-contract", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(transport);
  return { client, handler };
}

function assertToolSuccess(
  result: { content: unknown[]; isError?: boolean; structuredContent?: unknown },
  toolName: string,
): asserts result is { content: unknown[]; structuredContent: Record<string, unknown> } {
  if (result.isError || result.structuredContent === undefined) {
    throw new Error(toolName + " failed: " + JSON.stringify(result.content));
  }
}

function utcBoundary(daysAgo: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo)).toISOString();
}
