import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

if (existsSync(".env")) {
  throw new Error("Offline tests require a checkout without .env; credentials belong in explicit live tests.");
}
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/^(OPENROUTER_|MCP_|DOTENV_|NODE_OPTIONS$)/i.test(name)
));
environment.NODE_OPTIONS = `--import=${new URL("./offline-guard.mjs", import.meta.url).href}`;
const files = process.argv.length > 2 ? process.argv.slice(2) :
  readdirSync("tests").filter((file) => file.endsWith(".test.ts")).map((file) => `tests/${file}`);
if (files.length === 0) throw new Error("No offline tests found.");
const result = spawnSync(process.execPath, [
  "--import", "tsx", "--test", "--test-reporter=tap", "--test-timeout=60000", ...files,
], { env: environment, stdio: "inherit", timeout: 90_000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
