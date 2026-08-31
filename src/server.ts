#!/usr/bin/env node

import { createServer } from "node:http";

import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { config as loadEnvironment } from "dotenv";

import { createOpenRouterMcpHandler, createOpenRouterMcpServer } from "./mcp.js";
import { OpenRouterClient } from "./openrouter.js";

loadEnvironment({ quiet: true });

type Transport = "http" | "stdio";

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const transport = readTransport();
  const api = OpenRouterClient.fromEnvironment();
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error(
      "OPENROUTER_API_KEY is not set. Model discovery can still work, but chat and key-usage calls will fail.",
    );
  }

  if (transport === "stdio") {
    const handle = serveStdio(() => createOpenRouterMcpServer(api));
    installShutdown(() => handle.close());
    console.error("OpenRouter MCP server listening on stdio (MCP 2026-07-28 with legacy fallback).");
    return;
  }

  const port = readPort();
  const handler = createOpenRouterMcpHandler(api);
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const httpServer = createServer((request, response) => {
    if (!validateHost(request, response) || !validateOrigin(request, response)) {
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/mcp") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    void nodeHandler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    httpServer.once("error", onError);
    httpServer.listen(port, "127.0.0.1", () => {
      httpServer.off("error", onError);
      resolve();
    });
  });

  installShutdown(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    await handler.close();
  });
  console.error(
    "OpenRouter MCP server listening on http://127.0.0.1:" +
      port +
      "/mcp (MCP 2026-07-28 with legacy fallback).",
  );
}

function readTransport(): Transport {
  const requested = readOption("--transport") ?? process.env.MCP_TRANSPORT ?? "stdio";
  if (requested !== "stdio" && requested !== "http") {
    throw new Error("MCP transport must be either stdio or http.");
  }
  return requested;
}

function readPort(): number {
  const requested = readOption("--port") ?? process.env.MCP_HTTP_PORT ?? "3000";
  const port = Number(requested);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MCP HTTP port must be an integer between 1 and 65535.");
  }
  return port;
}

function readOption(name: string): string | undefined {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    const value = process.argv[exactIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(name + " requires a value.");
    }
    return value;
  }

  const prefix = name + "=";
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  return inline?.slice(prefix.length);
}

function installShutdown(close: () => Promise<void>): void {
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await close();
    } catch (error) {
      console.error("Failed to close OpenRouter MCP server:", error);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: openrouter-mcp-server [--transport stdio|http] [--port 3000]",
      "",
      "stdio is the default. HTTP binds only to 127.0.0.1 and serves /mcp.",
      "",
    ].join("\n"),
  );
}

void main().catch((error: unknown) => {
  console.error("OpenRouter MCP server failed:", error);
  process.exitCode = 1;
});
