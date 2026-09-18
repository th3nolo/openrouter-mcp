import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterClient } from "../src/openrouter.js";

test(
  "matches the live public OpenRouter catalog contract",
  { timeout: 20_000 },
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
