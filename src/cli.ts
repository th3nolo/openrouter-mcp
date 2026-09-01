#!/usr/bin/env node

import { config as loadEnvironment } from "dotenv";

import {
  APP_RANKING_CATEGORIES,
  APP_RANKING_SUBCATEGORIES,
  INPUT_MODALITIES,
  MODEL_CATEGORIES,
  MODEL_SORTS,
  OUTPUT_MODALITIES,
  OpenRouterClient,
  openRouterAnalyticsQuerySchema,
} from "./openrouter.js";
import {
  chatWithModel,
  compareModels,
  getAnalyticsSchema,
  getCredits,
  getGeneration,
  getModel,
  listActivity,
  listAppRankings,
  listModelEndpoints,
  listModelRankings,
  listModels,
  listProviders,
  queryAnalytics,
} from "./operations.js";
import { runServer } from "./server.js";

loadEnvironment({ quiet: true });

const CLI_VERSION = "3.0.0";
const SCHEMA_VERSION = "1.0.0";

type OptionKind = "boolean" | "string";
type ParsedValue = boolean | string;

interface ParsedOptions {
  positionals: string[];
  values: Record<string, ParsedValue>;
}

interface CommandResult {
  command: string;
  data: unknown;
  nextSteps: string[];
}

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

async function main(argumentsList: string[] = process.argv.slice(2)): Promise<void> {
  if (argumentsList.length === 0 || argumentsList.includes("--help") || argumentsList.includes("-h")) {
    printHelp();
    return;
  }
  if (argumentsList.includes("--version") || argumentsList.includes("-v")) {
    process.stdout.write(CLI_VERSION + "\n");
    return;
  }

  const noun = argumentsList[0];
  if (noun === "serve") {
    await runServer(argumentsList.slice(1));
    return;
  }

  const api = OpenRouterClient.fromEnvironment();
  const result = noun === "schema"
    ? schemaCommand(argumentsList.slice(1))
    : await executeCommand(api, noun ?? "", argumentsList.slice(1));
  writeSuccess(result, wantsJson(argumentsList));
}

async function executeCommand(
  api: OpenRouterClient,
  noun: string,
  argumentsList: string[],
): Promise<CommandResult> {
  const verb = argumentsList[0];
  const commandArguments = argumentsList.slice(1);

  if (noun === "models" && verb === "list") {
    const parsed = parseOptions(commandArguments, {
      architecture: "string",
      category: "string",
      distillable: "string",
      "input-modalities": "string",
      json: "boolean",
      limit: "string",
      "max-output-price": "string",
      "max-prompt-price": "string",
      "min-context-length": "string",
      "min-output-price": "string",
      "min-prompt-price": "string",
      "model-authors": "string",
      offset: "string",
      "output-modalities": "string",
      providers: "string",
      q: "string",
      region: "string",
      sort: "string",
      "supported-parameters": "string",
      zdr: "boolean",
    });
    assertNoPositionals(parsed);
    const outputModalities = readCsv(parsed, "output-modalities");
    const output = await listModels(api, {
      architecture: readOptionalString(parsed, "architecture"),
      category: readEnum(parsed, "category", MODEL_CATEGORIES),
      distillable: readOptionalBoolean(parsed, "distillable"),
      input_modalities: readEnumList(parsed, "input-modalities", INPUT_MODALITIES),
      limit: readInteger(parsed, "limit", 25, 1, 100),
      max_output_price: readOptionalNumber(parsed, "max-output-price", 0),
      max_prompt_price: readOptionalNumber(parsed, "max-prompt-price", 0),
      min_context_length: readOptionalInteger(parsed, "min-context-length", 1),
      min_output_price: readOptionalNumber(parsed, "min-output-price", 0),
      min_prompt_price: readOptionalNumber(parsed, "min-prompt-price", 0),
      model_authors: readCsv(parsed, "model-authors"),
      offset: readInteger(parsed, "offset", 0, 0),
      output_modalities: outputModalities?.length === 1 && outputModalities[0] === "all"
        ? "all"
        : validateEnumList("output-modalities", outputModalities, OUTPUT_MODALITIES),
      providers: readCsv(parsed, "providers"),
      q: readOptionalString(parsed, "q"),
      region: readEnum(parsed, "region", ["eu", "us"] as const),
      sort: readEnum(parsed, "sort", MODEL_SORTS),
      supported_parameters: readCsv(parsed, "supported-parameters"),
      zdr: readBoolean(parsed, "zdr", false) ? true : undefined,
    });
    return commandResult("models.list", output, ["models get <author/slug>", "models endpoints <author/slug>"]);
  }

  if (noun === "models" && verb === "get") {
    const parsed = parseOptions(commandArguments, { json: "boolean" });
    const model = requireSinglePositional(parsed, "model ID");
    assertModelId(model);
    return commandResult("models.get", await getModel(api, model), ["models endpoints " + model]);
  }

  if (noun === "models" && verb === "endpoints") {
    const parsed = parseOptions(commandArguments, {
      json: "boolean",
      limit: "string",
      offset: "string",
      provider: "string",
    });
    const model = requireSinglePositional(parsed, "model ID");
    assertModelId(model);
    const output = await listModelEndpoints(api, {
      limit: readInteger(parsed, "limit", 25, 1, 100),
      model,
      offset: readInteger(parsed, "offset", 0, 0),
      provider: readOptionalString(parsed, "provider"),
    });
    return commandResult("models.endpoints", output, ["chat send --model " + model + " --message <text>"]);
  }

  if (noun === "providers" && verb === "list") {
    const parsed = parseOptions(commandArguments, {
      datacenter: "string",
      headquarters: "string",
      json: "boolean",
      limit: "string",
      offset: "string",
      q: "string",
    });
    assertNoPositionals(parsed);
    const output = await listProviders(api, {
      datacenter: readCountryCode(parsed, "datacenter"),
      headquarters: readCountryCode(parsed, "headquarters"),
      limit: readInteger(parsed, "limit", 50, 1, 100),
      offset: readInteger(parsed, "offset", 0, 0),
      q: readOptionalString(parsed, "q"),
    });
    return commandResult("providers.list", output, ["models list --providers <provider>"]);
  }

  if (noun === "rankings" && verb === "models") {
    const parsed = parseOptions(commandArguments, {
      "context-bucket": "string",
      date: "string",
      "include-other": "boolean",
      json: "boolean",
      limit: "string",
      modality: "string",
    });
    assertNoPositionals(parsed);
    const output = await listModelRankings(api, {
      context_bucket: readEnum(parsed, "context-bucket", ["1K", "10K", "100K", "1M", "10M"] as const),
      date: readDate(parsed, "date"),
      include_other: readBoolean(parsed, "include-other", false),
      limit: readInteger(parsed, "limit", 20, 1, 50),
      modality: readEnum(parsed, "modality", ["text", "image", "image_output", "audio", "tool_calling"] as const),
    });
    return commandResult("rankings.models", output, ["models get <author/slug>"]);
  }

  if (noun === "rankings" && verb === "apps") {
    const parsed = parseOptions(commandArguments, {
      category: "string",
      "end-date": "string",
      json: "boolean",
      limit: "string",
      offset: "string",
      sort: "string",
      "start-date": "string",
      subcategory: "string",
    });
    assertNoPositionals(parsed);
    const startDate = readDate(parsed, "start-date");
    const endDate = readDate(parsed, "end-date");
    if (startDate && endDate && startDate > endDate) {
      throw new CliUsageError("--start-date must not be after --end-date.");
    }
    const output = await listAppRankings(api, {
      category: readEnum(parsed, "category", APP_RANKING_CATEGORIES),
      end_date: endDate,
      limit: readInteger(parsed, "limit", 25, 1, 100),
      offset: readInteger(parsed, "offset", 0, 0, 100),
      sort: readEnum(parsed, "sort", ["popular", "trending"] as const) ?? "popular",
      start_date: startDate,
      subcategory: readEnum(parsed, "subcategory", APP_RANKING_SUBCATEGORIES),
    });
    return commandResult("rankings.apps", output, ["rankings apps --sort trending"]);
  }

  if (noun === "account" && verb === "credits") {
    const parsed = parseOptions(commandArguments, { json: "boolean" });
    assertNoPositionals(parsed);
    return commandResult("account.credits", await getCredits(api), ["activity list"]);
  }

  if (noun === "activity" && verb === "list") {
    const parsed = parseOptions(commandArguments, {
      "api-key-hash": "string",
      date: "string",
      "group-by": "string",
      json: "boolean",
      limit: "string",
      offset: "string",
      "user-id": "string",
      "workspace-id": "string",
    });
    assertNoPositionals(parsed);
    const apiKeyHash = readOptionalString(parsed, "api-key-hash");
    if (apiKeyHash && !/^[A-Fa-f0-9]{64}$/.test(apiKeyHash)) {
      throw new CliUsageError("--api-key-hash must be a 64-character SHA-256 hexadecimal string.");
    }
    const output = await listActivity(api, {
      api_key_hash: apiKeyHash,
      date: readDate(parsed, "date"),
      group_by: readEnum(parsed, "group-by", ["workspace"] as const),
      limit: readInteger(parsed, "limit", 50, 1, 100),
      offset: readInteger(parsed, "offset", 0, 0),
      user_id: readOptionalString(parsed, "user-id"),
      workspace_id: readOptionalString(parsed, "workspace-id"),
    });
    return commandResult("activity.list", output, ["account credits"]);
  }

  if (noun === "analytics" && verb === "schema") {
    const parsed = parseOptions(commandArguments, { json: "boolean" });
    assertNoPositionals(parsed);
    return commandResult("analytics.schema", await getAnalyticsSchema(api), [
      "analytics query --metrics total_usage,request_count --start <UTC> --end <UTC>",
    ]);
  }

  if (noun === "analytics" && verb === "query") {
    const parsed = parseOptions(commandArguments, {
      "classifier-dimensions-json": "string",
      "classifier-filters-json": "string",
      dimensions: "string",
      end: "string",
      "filters-json": "string",
      granularity: "string",
      "group-limit": "string",
      json: "boolean",
      limit: "string",
      metrics: "string",
      "order-by": "string",
      "order-direction": "string",
      start: "string",
    });
    assertNoPositionals(parsed);
    const orderBy = readOptionalString(parsed, "order-by");
    const orderDirection = readEnum(parsed, "order-direction", ["asc", "desc"] as const);
    if (!orderBy && orderDirection) {
      throw new CliUsageError("--order-direction requires --order-by.");
    }
    const candidate = {
      classifier_dimensions: readJsonOption(parsed, "classifier-dimensions-json"),
      classifier_filters: readJsonOption(parsed, "classifier-filters-json"),
      dimensions: readCsv(parsed, "dimensions"),
      filters: readJsonOption(parsed, "filters-json"),
      granularity: readEnum(parsed, "granularity", ["minute", "hour", "day", "week", "month"] as const),
      group_limit: readOptionalBoundedInteger(parsed, "group-limit", 1, 10_000),
      limit: readInteger(parsed, "limit", 1_000, 1, 10_000),
      metrics: readRequiredCsv(parsed, "metrics"),
      order_by: orderBy ? { direction: orderDirection ?? "desc", field: orderBy } : undefined,
      time_range: {
        end: readRequiredString(parsed, "end"),
        start: readRequiredString(parsed, "start"),
      },
    };
    const validated = openRouterAnalyticsQuerySchema.safeParse(candidate);
    if (!validated.success) {
      const issue = validated.error.issues[0];
      throw new CliUsageError("Invalid analytics query: " + (issue?.message ?? "unknown validation error"));
    }
    const output = await queryAnalytics(api, validated.data);
    const nextSteps = output.metadata.truncated
      ? ["Narrow the time range or raise --limit before treating the result as complete."]
      : validated.data.dimensions?.includes("generation_id")
        ? ["generations get <generation-id>"]
        : [];
    return commandResult("analytics.query", output, nextSteps);
  }

  if (noun === "chat" && verb === "send") {
    const parsed = parseOptions(commandArguments, {
      json: "boolean",
      "max-completion-tokens": "string",
      message: "string",
      model: "string",
      "system-prompt": "string",
      temperature: "string",
    });
    assertNoPositionals(parsed);
    const model = readRequiredString(parsed, "model");
    assertModelId(model);
    const output = await chatWithModel(api, {
      max_completion_tokens: readInteger(parsed, "max-completion-tokens", 1_000, 1, 131_072),
      message: readRequiredString(parsed, "message"),
      model,
      system_prompt: readOptionalString(parsed, "system-prompt"),
      temperature: readNumber(parsed, "temperature", 0.7, 0, 2),
    });
    return commandResult("chat.send", output, ["generations get " + output.generation_id]);
  }

  if (noun === "chat" && verb === "compare") {
    const parsed = parseOptions(commandArguments, {
      json: "boolean",
      "max-completion-tokens": "string",
      message: "string",
      models: "string",
    });
    assertNoPositionals(parsed);
    const models = readCsv(parsed, "models") ?? [];
    if (models.length < 2 || models.length > 8 || new Set(models).size !== models.length) {
      throw new CliUsageError("--models must contain two to eight unique comma-separated model IDs.");
    }
    models.forEach(assertModelId);
    const output = await compareModels(api, {
      max_completion_tokens: readInteger(parsed, "max-completion-tokens", 500, 1, 131_072),
      message: readRequiredString(parsed, "message"),
      models,
    });
    return commandResult("chat.compare", output, ["generations get <generation-id>"]);
  }

  if (noun === "generations" && verb === "get") {
    const parsed = parseOptions(commandArguments, { json: "boolean" });
    const generationId = requireSinglePositional(parsed, "generation ID");
    return commandResult("generations.get", await getGeneration(api, generationId), []);
  }

  throw new CliUsageError("Unknown command. Run openrouter-mcp --help for the command list.");
}

function schemaCommand(argumentsList: string[]): CommandResult {
  const parsed = parseOptions(argumentsList, { json: "boolean" });
  assertNoPositionals(parsed);
  return commandResult(
    "schema",
    {
      schema_version: SCHEMA_VERSION,
      cli_version: CLI_VERSION,
      mcp_protocol: "2026-07-28",
      output_contract: {
        json: { ok: "boolean", command: "string", data: "command result", next_steps: "string[]" },
        mode: "JSON when stdout is piped or --json is present; human-readable text on an interactive terminal",
        stderr: "diagnostics and structured errors only",
      },
      exit_codes: { success: 0, operation_failed: 1, usage_error: 2 },
      global_options: ["--json"],
      commands: [
        commandSchema("models list", "list_models", "none", "read-only", "models list [options]", [
          "--q", "--category", "--architecture", "--model-authors", "--providers", "--supported-parameters",
          "--input-modalities", "--output-modalities", "--distillable true|false", "--zdr", "--region",
          "--min-context-length", "--min-prompt-price", "--max-prompt-price", "--min-output-price",
          "--max-output-price", "--sort", "--limit", "--offset",
        ]),
        commandSchema("models get", "get_model", "none", "read-only", "models get <author/slug>"),
        commandSchema(
          "models endpoints",
          "list_model_endpoints",
          "none",
          "read-only",
          "models endpoints <author/slug> [options]",
          ["--provider", "--limit", "--offset"],
        ),
        commandSchema("providers list", "list_providers", "none", "read-only", "providers list [options]", [
          "--q", "--headquarters", "--datacenter", "--limit", "--offset",
        ]),
        commandSchema(
          "rankings models",
          "list_model_rankings",
          "api",
          "read-only",
          "rankings models [options]",
          ["--date", "--modality", "--context-bucket", "--include-other", "--limit"],
        ),
        commandSchema(
          "rankings apps",
          "list_app_rankings",
          "api",
          "read-only",
          "rankings apps [options]",
          ["--start-date", "--end-date", "--category", "--subcategory", "--sort", "--limit", "--offset"],
        ),
        commandSchema("account credits", "get_credits", "management", "read-only", "account credits"),
        commandSchema("activity list", "list_activity", "management", "read-only", "activity list [options]", [
          "--date", "--api-key-hash", "--user-id", "--workspace-id", "--group-by workspace", "--limit", "--offset",
        ]),
        commandSchema(
          "analytics schema",
          "get_analytics_schema",
          "management",
          "read-only",
          "analytics schema",
        ),
        commandSchema(
          "analytics query",
          "query_analytics",
          "management",
          "read-only",
          "analytics query --metrics CSV --start UTC --end UTC [options]",
          [
            "--metrics", "--start", "--end", "--dimensions", "--granularity", "--filters-json",
            "--classifier-dimensions-json",
            "--classifier-filters-json", "--order-by", "--order-direction", "--group-limit", "--limit",
          ],
        ),
        commandSchema("chat send", "chat_with_model", "api", "paid-call", "chat send [options]", [
          "--model", "--message", "--system-prompt", "--max-completion-tokens", "--temperature",
        ]),
        commandSchema("chat compare", "compare_models", "api", "paid-call", "chat compare [options]", [
          "--models", "--message", "--max-completion-tokens",
        ]),
        commandSchema(
          "generations get",
          "get_generation",
          "api",
          "read-only",
          "generations get <generation-id>",
        ),
        commandSchema("serve", null, "none", "local-server", "serve [--transport stdio|http] [--port N]"),
      ],
      environment: {
        OPENROUTER_API_KEY: "Inference, rankings, and generation metadata",
        OPENROUTER_MANAGEMENT_KEY: "Credits, activity, and analytics; falls back to OPENROUTER_API_KEY",
      },
    },
    ["models list", "providers list"],
  );
}

function commandSchema(
  command: string,
  mcpTool: string | null,
  auth: string,
  risk: string,
  usage: string,
  options: string[] = [],
) {
  return { command, mcp_tool: mcpTool, auth, risk, usage, options };
}

function commandResult(command: string, data: unknown, nextSteps: string[]): CommandResult {
  return { command, data, nextSteps };
}

function parseOptions(argumentsList: string[], specification: Readonly<Record<string, OptionKind>>): ParsedOptions {
  const values: Record<string, ParsedValue> = {};
  const positionals: string[] = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument) {
      continue;
    }
    if (argument === "--") {
      positionals.push(...argumentsList.slice(index + 1));
      break;
    }
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    const name = argument.slice(2, equals < 0 ? undefined : equals);
    const kind = specification[name];
    if (!kind) {
      throw new CliUsageError("Unknown option --" + name + ".");
    }
    if (name in values) {
      throw new CliUsageError("Option --" + name + " may be supplied only once.");
    }
    if (kind === "boolean") {
      if (equals >= 0) {
        const raw = argument.slice(equals + 1);
        if (raw !== "true" && raw !== "false") {
          throw new CliUsageError("Option --" + name + " accepts only true or false.");
        }
        values[name] = raw === "true";
      } else {
        values[name] = true;
      }
      continue;
    }
    const value = equals >= 0 ? argument.slice(equals + 1) : argumentsList[++index];
    if (!value || value.startsWith("--")) {
      throw new CliUsageError("Option --" + name + " requires a value.");
    }
    values[name] = value;
  }
  return { positionals, values };
}

function readOptionalString(parsed: ParsedOptions, name: string): string | undefined {
  const value = parsed.values[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new CliUsageError("Option --" + name + " requires a string value.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliUsageError("Option --" + name + " must not be empty.");
  }
  return trimmed;
}

function readRequiredString(parsed: ParsedOptions, name: string): string {
  const value = readOptionalString(parsed, name);
  if (!value) {
    throw new CliUsageError("Option --" + name + " is required.");
  }
  return value;
}

function readBoolean(parsed: ParsedOptions, name: string, fallback: boolean): boolean {
  const value = parsed.values[name];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new CliUsageError("Option --" + name + " must be boolean.");
  }
  return value;
}

function readOptionalBoolean(parsed: ParsedOptions, name: string): boolean | undefined {
  const value = readOptionalString(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  if (value !== "true" && value !== "false") {
    throw new CliUsageError("Option --" + name + " accepts only true or false.");
  }
  return value === "true";
}

function readNumber(
  parsed: ParsedOptions,
  name: string,
  fallback: number,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
): number {
  const raw = readOptionalString(parsed, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new CliUsageError("Option --" + name + " must be between " + minimum + " and " + maximum + ".");
  }
  return value;
}

function readOptionalNumber(parsed: ParsedOptions, name: string, minimum: number): number | undefined {
  const raw = readOptionalString(parsed, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum) {
    throw new CliUsageError("Option --" + name + " must be at least " + minimum + ".");
  }
  return value;
}

function readInteger(
  parsed: ParsedOptions,
  name: string,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = readNumber(parsed, name, fallback, minimum, maximum);
  if (!Number.isSafeInteger(value)) {
    throw new CliUsageError("Option --" + name + " must be an integer.");
  }
  return value;
}

function readOptionalInteger(parsed: ParsedOptions, name: string, minimum: number): number | undefined {
  const raw = readOptionalString(parsed, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new CliUsageError("Option --" + name + " must be an integer of at least " + minimum + ".");
  }
  return value;
}

function readOptionalBoundedInteger(
  parsed: ParsedOptions,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (parsed.values[name] === undefined) {
    return undefined;
  }
  return readInteger(parsed, name, minimum, minimum, maximum);
}

function readCsv(parsed: ParsedOptions, name: string): string[] | undefined {
  const value = readOptionalString(parsed, name);
  if (!value) {
    return undefined;
  }
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    throw new CliUsageError("Option --" + name + " must contain at least one value.");
  }
  return items;
}

function readRequiredCsv(parsed: ParsedOptions, name: string): string[] {
  const values = readCsv(parsed, name);
  if (!values) {
    throw new CliUsageError("Option --" + name + " is required.");
  }
  return values;
}

function readJsonOption(parsed: ParsedOptions, name: string): unknown {
  const value = readOptionalString(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CliUsageError("Option --" + name + " must contain valid JSON.");
  }
}

function readEnum<const T extends readonly string[]>(
  parsed: ParsedOptions,
  name: string,
  allowed: T,
): T[number] | undefined {
  const value = readOptionalString(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new CliUsageError("Option --" + name + " must be one of: " + allowed.join(", ") + ".");
  }
  return value as T[number];
}

function readEnumList<const T extends readonly string[]>(
  parsed: ParsedOptions,
  name: string,
  allowed: T,
): Array<T[number]> | undefined {
  return validateEnumList(name, readCsv(parsed, name), allowed);
}

function validateEnumList<const T extends readonly string[]>(
  name: string,
  values: string[] | undefined,
  allowed: T,
): Array<T[number]> | undefined {
  if (!values) {
    return undefined;
  }
  for (const value of values) {
    if (!allowed.includes(value)) {
      throw new CliUsageError("Option --" + name + " must contain only: " + allowed.join(", ") + ".");
    }
  }
  return values as Array<T[number]>;
}

function readCountryCode(parsed: ParsedOptions, name: string): string | undefined {
  const value = readOptionalString(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  if (!/^[A-Za-z]{2}$/.test(value)) {
    throw new CliUsageError("Option --" + name + " must be a two-letter country code.");
  }
  return value.toUpperCase();
}

function readDate(parsed: ParsedOptions, name: string): string | undefined {
  const value = readOptionalString(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CliUsageError("Option --" + name + " must use YYYY-MM-DD in UTC.");
  }
  const parsedDate = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new CliUsageError("Option --" + name + " is not a valid calendar date.");
  }
  return value;
}

function requireSinglePositional(parsed: ParsedOptions, label: string): string {
  if (parsed.positionals.length !== 1 || !parsed.positionals[0]) {
    throw new CliUsageError("Exactly one " + label + " is required.");
  }
  return parsed.positionals[0];
}

function assertNoPositionals(parsed: ParsedOptions): void {
  if (parsed.positionals.length > 0) {
    throw new CliUsageError("Unexpected positional argument: " + parsed.positionals[0]);
  }
}

function assertModelId(model: string): void {
  if (!/^[^\s/]+\/[^\s/]+$/.test(model)) {
    throw new CliUsageError("Model must use the exact author/slug format.");
  }
}

function wantsJson(argumentsList: string[]): boolean {
  return !process.stdout.isTTY || argumentsList.some((argument) => argument === "--json" || argument === "--json=true");
}

function writeSuccess(result: CommandResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify({
      ok: true,
      command: result.command,
      data: result.data,
      next_steps: result.nextSteps,
    }, null, 2) + "\n");
    return;
  }
  process.stdout.write(formatHuman(result) + "\n");
}

function formatHuman(result: CommandResult): string {
  const data = result.data as Record<string, unknown>;
  if (result.command === "models.list") {
    const models = (data.models ?? []) as Array<Record<string, unknown>>;
    return renderTable(
      ["MODEL", "CONTEXT", "PROMPT / 1M", "OUTPUT / 1M"],
      models.map((model) => {
        const pricing = model.pricing as Record<string, unknown> | undefined;
        return [
          String(model.id ?? ""),
          formatInteger(model.context_length),
          formatPerMillion(pricing?.prompt),
          formatPerMillion(pricing?.completion),
        ];
      }),
    );
  }
  if (result.command === "providers.list") {
    const providers = (data.providers ?? []) as Array<Record<string, unknown>>;
    return renderTable(
      ["PROVIDER", "HEADQUARTERS", "DATACENTERS"],
      providers.map((provider) => [
        String(provider.slug ?? ""),
        String(provider.headquarters ?? "-"),
        Array.isArray(provider.datacenters) ? provider.datacenters.join(",") : "-",
      ]),
    );
  }
  if (result.command === "rankings.models") {
    const rankings = (data.rankings ?? []) as Array<Record<string, unknown>>;
    return renderTable(
      ["RANK", "MODEL", "TOKENS"],
      rankings.map((item) => [String(item.rank ?? ""), String(item.model_permaslug ?? ""), String(item.total_tokens ?? "")]),
    ) + "\n\n" + String(data.attribution ?? "");
  }
  if (result.command === "rankings.apps") {
    const apps = (data.apps ?? []) as Array<Record<string, unknown>>;
    return renderTable(
      ["RANK", "APP", "REQUESTS", "TOKENS"],
      apps.map((app) => [
        String(app.rank ?? ""),
        String(app.app_name ?? ""),
        formatInteger(app.total_requests),
        String(app.total_tokens ?? ""),
      ]),
    ) + "\n\n" + String(data.attribution ?? "");
  }
  if (result.command === "account.credits") {
    return [
      "Purchased: $" + formatDecimal(data.total_credits),
      "Used:      $" + formatDecimal(data.total_usage),
      "Remaining: $" + formatDecimal(data.remaining_credits),
    ].join("\n");
  }
  if (result.command === "chat.send") {
    return String(data.response ?? "") + "\n\nGeneration: " + String(data.generation_id ?? "");
  }
  return JSON.stringify(result.data, null, 2);
}

function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const renderRow = (row: string[]): string => row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();
  return [renderRow(headers), renderRow(widths.map((width) => "-".repeat(width))), ...rows.map(renderRow)].join("\n");
}

function formatInteger(value: unknown): string {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "-";
}

function formatPerMillion(value: unknown): string {
  if (typeof value !== "string") {
    return "-";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? "$" + formatDecimal(numeric * 1_000_000) : "-";
}

function formatDecimal(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "-";
}

function printHelp(): void {
  process.stdout.write([
    "Usage: openrouter-mcp <noun> <verb> [arguments] [options]",
    "",
    "Discovery",
    "  models list                         Search and page models",
    "  models get <author/slug>            Get one model",
    "  models endpoints <author/slug>      List serving endpoints",
    "  providers list                      List providers and data locations",
    "  rankings models                     List model usage rankings",
    "  rankings apps                       List public app rankings",
    "",
    "Account",
    "  account credits                     Get purchased, used, and remaining credits",
    "  activity list                       List endpoint-level account activity",
    "  analytics schema                    Discover current analytics fields",
    "  analytics query                     Query Activity Explore aggregates",
    "",
    "Inference",
    "  chat send --model ID --message TEXT Send one paid inference call",
    "  chat compare --models A,B --message TEXT",
    "  generations get <generation-id>     Get exact cost and routing metadata",
    "",
    "Runtime",
    "  schema                              Print the agent-readable command contract",
    "  serve --transport stdio|http        Run strict stateless MCP 2026-07-28",
    "",
    "Use --json for structured output. JSON is automatic when stdout is not a TTY.",
    "Secrets come only from OPENROUTER_API_KEY and OPENROUTER_MANAGEMENT_KEY.",
    "",
  ].join("\n"));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof CliUsageError ? "usage_error" : "operation_failed";
  if (wantsJson(process.argv.slice(2))) {
    process.stderr.write(JSON.stringify({ ok: false, error: { code, message } }, null, 2) + "\n");
  } else {
    process.stderr.write("Error: " + message + "\n");
  }
  process.exitCode = error instanceof CliUsageError ? 2 : 1;
});
