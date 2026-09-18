import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const timeout = 5_000;
const temporary = mkdtempSync(path.resolve(".contract-"));
after(() => rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
const unpack = spawnSync("tar", ["-xzf", "contract-package.tgz", "-C", temporary], {
  encoding: "utf8", timeout,
});
assert.equal(unpack.status, 0, unpack.stderr);
const packaged = path.join(temporary, "package");
const manifest = JSON.parse(readFileSync(path.join(packaged, "package.json"), "utf8")) as {
  version: string; bin: Record<string, string>;
};
assert.equal(existsSync(path.join(packaged, "src")), false);
const server = path.join(packaged, manifest.bin["openrouter-mcp-server"]!);
const cli = path.join(packaged, manifest.bin["openrouter-mcp"]!);

function run(entry: string, args: string[], input?: string) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: packaged, env: process.env, encoding: "utf8", timeout, input,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const [name, entry, args] of [
  ["server", server, ["--transport", "stdio"]],
  ["CLI serve", cli, ["serve", "--transport", "stdio"]],
] as const) {
  test(`packaged ${name}: modern handshake, discovery, invalid tool input, and close`, { timeout: 10_000 }, async () => {
    const client = new Client({ name: "packaged-contract", version: "1.0.0" }, {
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    });
    const transport = new StdioClientTransport({
      command: process.execPath, args: [entry, ...args], cwd: packaged,
      env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" }, stderr: "pipe",
    });
    let errors = "";
    transport.stderr?.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
    let pid: number | null = null;
    try {
      await client.connect(transport);
      pid = transport.pid;
      assert.equal(client.getProtocolEra(), "modern");
      const tools = await client.listTools();
      assert.equal(tools.tools.length, 13);
      assert.ok(tools.tools.some((tool) => tool.name === "query_analytics"));
      const invalid = await client.callTool({ name: "chat_with_model", arguments: {} });
      assert.equal(invalid.isError, true);
    } finally {
      await client.close();
    }
    assert.ok(pid);
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.doesNotMatch(errors, /Offline test attempted network access/);
    assert.match(errors, /MCP 2026-07-28 only/);
  });

  test(`packaged ${name}: rejects legacy initialization`, { timeout: 10_000 }, async () => {
    const client = new Client({ name: "legacy-contract", version: "1.0.0" }, {
      versionNegotiation: { mode: "legacy" },
    });
    const transport = new StdioClientTransport({
      command: process.execPath, args: [entry, ...args], cwd: packaged,
      env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" }, stderr: "pipe",
    });
    try {
      await assert.rejects(client.connect(transport), /legacy|protocol|2026-07-28/i);
    } finally {
      await client.close();
    }
  });

  test(`packaged ${name}: malformed JSON does not corrupt stdout and EOF exits`, () => {
    const result = run(entry, [...args], "{broken-json\n");
    assert.equal(result.status, 0, result.stderr);
    for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
      const response = JSON.parse(line) as { jsonrpc: string; error?: { code: number } };
      assert.equal(response.jsonrpc, "2.0");
      assert.ok(response.error);
    }
    assert.match(result.stderr, /MCP 2026-07-28 only/);
  });
}

test("packaged CLI schema, version, and help exit successfully", () => {
  const schema = run(cli, ["schema"]);
  assert.equal(schema.status, 0, schema.stderr);
  const result = JSON.parse(schema.stdout) as { ok: boolean; data: { mcp_protocol: string; exit_codes: unknown } };
  assert.equal(result.ok, true);
  assert.equal(result.data.mcp_protocol, "2026-07-28");
  assert.deepEqual(result.data.exit_codes, { success: 0, operation_failed: 1, usage_error: 2 });
  const version = run(cli, ["--version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), manifest.version);
  const help = run(cli, ["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: openrouter-mcp/);
});

test("packaged CLI malformed arguments return structured usage errors and exit two", () => {
  for (const args of [["unknown"], ["models", "list", "--limit", "invalid"]]) {
    const result = run(cli, [...args, "--json"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    const error = JSON.parse(result.stderr) as { ok: boolean; error: { code: string } };
    assert.equal(error.ok, false);
    assert.equal(error.error.code, "usage_error");
  }
});

test("packaged server invalid transport exits one", () => {
  const result = run(server, ["--transport", "invalid"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /MCP transport must be either stdio or http/);
});

test("offline guard blocks fetch and socket requests in child processes", () => {
  for (const code of ["fetch('https://openrouter.ai/api/v1/models')", "import('node:net').then(n => n.connect(443, 'openrouter.ai'))"]) {
    const result = run("--eval", [code]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Offline test attempted network access/);
  }
});
