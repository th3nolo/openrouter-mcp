import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { createServer } from "node:net";

export interface RunningHttpServer {
  port: number;
  url: URL;
  process: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  stop: () => Promise<number | null>;
}

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export const modernToolsListBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 7,
  method: "tools/list",
  params: {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "http-transport-test", version: "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  },
});

export const modernToolsListHeaders = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
  "MCP-Protocol-Version": "2026-07-28",
  "Mcp-Method": "tools/list",
};

// Starts a real entry point on a free 127.0.0.1 port and waits for its listening line on stderr.
export async function startHttpServer(entryArgs: string[], cwd: string): Promise<RunningHttpServer> {
  const port = await findFreePort();
  const child = spawn(process.execPath, [...entryArgs, "--transport", "http", "--port", String(port)], {
    cwd,
    env: { NODE_OPTIONS: process.env.NODE_OPTIONS ?? "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

  const listening = "listening on http://127.0.0.1:" + port + "/mcp";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("HTTP server did not start within 10 s. stderr: " + stderr)), 10_000);
    const onData = (): void => {
      if (stderr.includes(listening)) {
        clearTimeout(timer);
        child.stderr.off("data", onData);
        child.off("exit", onExit);
        resolve();
      }
    };
    const onExit = (code: number | null): void => {
      clearTimeout(timer);
      reject(new Error("HTTP server exited with code " + code + " before listening. stderr: " + stderr));
    };
    child.stderr.on("data", onData);
    child.once("exit", onExit);
  });

  return {
    port,
    url: new URL("http://127.0.0.1:" + port + "/mcp"),
    process: child,
    stdout: () => stdout,
    stderr: () => stderr,
    stop: async () => {
      if (child.exitCode !== null) {
        return child.exitCode;
      }
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      const [code] = (await exited) as [number | null];
      return code;
    },
  };
}

// Uses node:http instead of fetch so tests can send any Host header.
export function rawRequest(
  port: number,
  options: { method?: string; path?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      { host: "127.0.0.1", port, method: options.method ?? "GET", path: options.path ?? "/mcp", headers: options.headers },
      (incoming) => {
        let body = "";
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk: string) => { body += chunk; });
        incoming.on("end", () => resolve({ status: incoming.statusCode ?? 0, headers: incoming.headers, body }));
      },
    );
    outgoing.on("error", reject);
    outgoing.end(options.body);
  });
}

async function findFreePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  probe.close();
  await once(probe, "close");
  if (address === null || typeof address === "string") {
    throw new Error("Could not read the probe port.");
  }
  return address.port;
}
