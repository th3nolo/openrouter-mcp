import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

function createStdioTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve("src/server.ts"), "--transport", "stdio"],
    cwd: process.cwd(),
    stderr: "pipe",
    env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" },
  });
}

function createCliStdioTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve("src/cli.ts"), "serve", "--transport", "stdio"],
    cwd: process.cwd(),
    stderr: "pipe",
    env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" },
  });
}

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
