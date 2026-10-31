import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import {
  listeningAddresses,
  modernToolsListBody,
  modernToolsListHeaders,
  rawRequest,
  startHttpServer,
  type RunningHttpServer,
} from "./support/http-server.js";

const serverEntry = ["--import", "tsx", path.resolve("src/server.ts")];
const expectedTools = [
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
];

let server: RunningHttpServer;
before(async () => {
  server = await startHttpServer(serverEntry, process.cwd());
});
after(async () => {
  await server.stop();
});

test("logs the bound loopback address to stderr and keeps stdout empty", () => {
  assert.ok(
    server.stderr().includes("listening on http://127.0.0.1:" + server.port + "/mcp (MCP 2026-07-28 only)"),
    server.stderr(),
  );
  assert.equal(server.stdout(), "");
});

test("listens only on 127.0.0.1 according to the kernel socket table", (context) => {
  const addresses = listeningAddresses(server.port);
  if (addresses === undefined) {
    context.skip("needs /proc/net/tcp (Linux)");
    return;
  }
  assert.deepEqual(addresses, ["127.0.0.1"]);
});

test("serves every tool over the real HTTP entry point with the pinned modern protocol", async () => {
  const client = new Client(
    { name: "openrouter-http-transport-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  try {
    await client.connect(new StreamableHTTPClientTransport(server.url));
    assert.equal(client.getProtocolEra(), "modern");
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), expectedTools);
  } finally {
    await client.close();
  }
});

test("answers tools/list without a session over the real HTTP entry point", async () => {
  const response = await rawRequest(server.port, {
    method: "POST",
    headers: modernToolsListHeaders,
    body: modernToolsListBody,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["mcp-session-id"], undefined);
  const body = JSON.parse(response.body) as { id: number; result: { tools: Array<{ name: string }> } };
  assert.equal(body.id, 7);
  assert.equal(body.result.tools.length, expectedTools.length);
});

test("rejects legacy initialization over the real HTTP entry point", async () => {
  const client = new Client(
    { name: "openrouter-legacy-http-transport-test", version: "1.0.0" },
    { versionNegotiation: { mode: "legacy" } },
  );
  try {
    await assert.rejects(client.connect(new StreamableHTTPClientTransport(server.url)), /2026-07-28/);
  } finally {
    await client.close().catch(() => undefined);
  }
});

test("returns 404 for paths other than /mcp", async () => {
  for (const requestPath of ["/", "/other", "/mcp/extra"]) {
    const response = await rawRequest(server.port, { path: requestPath });
    assert.equal(response.status, 404, requestPath);
    assert.equal(response.body, "Not found");
  }
});

test("rejects a non-loopback Host header", async () => {
  const response = await rawRequest(server.port, {
    method: "POST",
    headers: { ...modernToolsListHeaders, Host: "evil.example" },
    body: modernToolsListBody,
  });
  assert.equal(response.status, 403);
});

test("rejects a non-loopback Origin header and accepts loopback origins", async () => {
  const rejected = await rawRequest(server.port, {
    method: "POST",
    headers: { ...modernToolsListHeaders, Origin: "https://evil.example" },
    body: modernToolsListBody,
  });
  assert.equal(rejected.status, 403);

  for (const origin of ["http://127.0.0.1:" + server.port, "http://localhost:" + server.port]) {
    const accepted = await rawRequest(server.port, {
      method: "POST",
      headers: { ...modernToolsListHeaders, Origin: origin },
      body: modernToolsListBody,
    });
    assert.equal(accepted.status, 200, origin);
  }
});

test("closes on SIGTERM with exit code zero and releases the port", async () => {
  const stopping = await startHttpServer(serverEntry, process.cwd());
  assert.equal(await stopping.stop(), 0);
  await assert.rejects(rawRequest(stopping.port), { code: "ECONNREFUSED" });
});
