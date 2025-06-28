#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validation schemas
const ChatRequestSchema = z.object({
  model: z.string().describe("OpenRouter model ID (e.g., 'openai/gpt-4')"),
  message: z.string().describe("Message to send to the model"),
  max_tokens: z.number().optional().default(1000).describe("Maximum tokens in response"),
  temperature: z.number().optional().default(0.7).describe("Temperature for response randomness"),
  system_prompt: z.string().optional().describe("System prompt for the conversation"),
});

const CompareModelsSchema = z.object({
  models: z.array(z.string()).describe("Array of model IDs to compare"),
  message: z.string().describe("Message to send to all models"),
  max_tokens: z.number().optional().default(500).describe("Maximum tokens per response"),
});

const DocumentAnalysisSchema = z.object({
  document: z.string().describe("Document content to analyze"),
  query: z.string().optional().describe("Optional query to focus the analysis"),
  chunk_size: z.number().optional().default(25000).describe("Size of each chunk in characters"),
  overlap: z.number().optional().default(2000).describe("Overlap between chunks in characters"),
  parallel_instances: z.number().optional().default(3).describe("Number of parallel instances (max 5)"),
  model: z.string().optional().default("google/gemma-3n-e4b-it").describe("Model to use for analysis"),
  analysis_type: z.enum(["search", "summarize", "extract", "qa"]).optional().default("summarize").describe("Type of analysis to perform"),
  max_tokens: z.number().optional().default(1000).describe("Maximum tokens per chunk analysis"),
  temperature: z.number().optional().default(0.3).describe("Temperature for response generation"),
});

// OpenRouter API configuration
const OPENROUTER_CONFIG = {
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME || "OpenRouter MCP Server",
    "Content-Type": "application/json",
  },
};

// Check if API key is available
if (!OPENROUTER_CONFIG.apiKey) {
  console.error("WARNING: OPENROUTER_API_KEY environment variable is not set!");
  console.error("Please set OPENROUTER_API_KEY to use the OpenRouter MCP server.");
}

class OpenRouterMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "openrouter-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupErrorHandling();
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "openrouter://models",
            name: "Available Models",
            description: "List of all available OpenRouter models with pricing",
            mimeType: "application/json",
          },
          {
            uri: "openrouter://pricing",
            name: "Model Pricing",
            description: "Current pricing information for all models",
            mimeType: "application/json",
          },
          {
            uri: "openrouter://usage",
            name: "Usage Statistics",
            description: "Your OpenRouter usage statistics",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case "openrouter://models":
            return await this.getModelsResource();
          case "openrouter://pricing":
            return await this.getPricingResource();
          case "openrouter://usage":
            return await this.getUsageResource();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error}`);
      }
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_models",
            description: "Get list of available OpenRouter models",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "chat_with_model",
            description: "Send a message to a specific OpenRouter model",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  description: "OpenRouter model ID (e.g., 'openai/gpt-4')",
                },
                message: {
                  type: "string",
                  description: "Message to send to the model",
                },
                max_tokens: {
                  type: "number",
                  description: "Maximum tokens in response",
                  default: 1000,
                },
                temperature: {
                  type: "number",
                  description: "Temperature for response randomness",
                  default: 0.7,
                },
                system_prompt: {
                  type: "string",
                  description: "System prompt for the conversation",
                },
              },
              required: ["model", "message"],
            },
          },
          {
            name: "compare_models",
            description: "Compare responses from multiple models",
            inputSchema: {
              type: "object",
              properties: {
                models: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Array of model IDs to compare",
                },
                message: {
                  type: "string",
                  description: "Message to send to all models",
                },
                max_tokens: {
                  type: "number",
                  description: "Maximum tokens per response",
                  default: 500,
                },
              },
              required: ["models", "message"],
            },
          },
          {
            name: "get_model_info",
            description: "Get detailed information about a specific model",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  description: "Model ID to get information about",
                },
              },
              required: ["model"],
            },
          },
          {
            name: "analyze_document",
            description: "Analyze large documents using parallel processing with multiple model instances",
            inputSchema: {
              type: "object",
              properties: {
                document: {
                  type: "string",
                  description: "Document content to analyze",
                },
                query: {
                  type: "string",
                  description: "Optional query to focus the analysis",
                },
                chunk_size: {
                  type: "number",
                  description: "Size of each chunk in characters",
                  default: 25000,
                },
                overlap: {
                  type: "number",
                  description: "Overlap between chunks in characters",
                  default: 2000,
                },
                parallel_instances: {
                  type: "number",
                  description: "Number of parallel instances (max 5)",
                  default: 3,
                },
                model: {
                  type: "string",
                  description: "Model to use for analysis",
                  default: "google/gemma-3n-e4b-it",
                },
                analysis_type: {
                  type: "string",
                  enum: ["search", "summarize", "extract", "qa"],
                  description: "Type of analysis to perform",
                  default: "summarize",
                },
                max_tokens: {
                  type: "number",
                  description: "Maximum tokens per chunk analysis",
                  default: 1000,
                },
                temperature: {
                  type: "number",
                  description: "Temperature for response generation",
                  default: 0.3,
                },
              },
              required: ["document"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_models":
            return await this.listModels();
          case "chat_with_model":
            return await this.chatWithModel(ChatRequestSchema.parse(args));
          case "compare_models":
            return await this.compareModels(CompareModelsSchema.parse(args));
          case "get_model_info":
            return await this.getModelInfo(args as { model: string });
          case "analyze_document":
            return await this.analyzeDocument(DocumentAnalysisSchema.parse(args));
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Tool ${name} error:`, error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  // Resource handlers
  private async getModelsResource() {
    const response = await axios.get(`${OPENROUTER_CONFIG.baseURL}/models`, {
      headers: OPENROUTER_CONFIG.headers,
    });

    return {
      contents: [
        {
          type: "text" as const,
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async getPricingResource() {
    const response = await axios.get(`${OPENROUTER_CONFIG.baseURL}/models`, {
      headers: OPENROUTER_CONFIG.headers,
    });

    const pricing = response.data.data.map((model: any) => ({
      id: model.id,
      name: model.name,
      pricing: model.pricing,
    }));

    return {
      contents: [
        {
          type: "text" as const,
          text: JSON.stringify(pricing, null, 2),
        },
      ],
    };
  }

  private async getUsageResource() {
    // OpenRouter doesn't have a direct usage endpoint, so we'll return a placeholder
    const usage = {
      message: "Usage statistics would be available here",
      note: "OpenRouter doesn't provide a direct usage API endpoint",
    };

    return {
      contents: [
        {
          type: "text" as const,
          text: JSON.stringify(usage, null, 2),
        },
      ],
    };
  }

  // Tool handlers
  private async listModels() {
    const response = await axios.get(`${OPENROUTER_CONFIG.baseURL}/models`, {
      headers: OPENROUTER_CONFIG.headers,
    });

    const models = response.data.data.map((model: any) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      context_length: model.context_length,
      pricing: model.pricing,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${models.length} available models:\n\n${JSON.stringify(models, null, 2)}`,
        },
      ],
    };
  }

  private async chatWithModel(params: z.infer<typeof ChatRequestSchema>) {
    const { model, message, max_tokens, temperature, system_prompt } = params;

    const messages = [];
    if (system_prompt) {
      messages.push({ role: "system", content: system_prompt });
    }
    messages.push({ role: "user", content: message });

    const response = await axios.post(
      `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
      {
        model,
        messages,
        max_tokens,
        temperature,
      },
      { headers: OPENROUTER_CONFIG.headers }
    );

    const result = response.data.choices[0].message.content;
    const usage = response.data.usage;

    return {
      content: [
        {
          type: "text" as const,
          text: `**Model:** ${model}\n**Response:** ${result}\n\n**Usage:**\n- Prompt tokens: ${usage.prompt_tokens}\n- Completion tokens: ${usage.completion_tokens}\n- Total tokens: ${usage.total_tokens}`,
        },
      ],
    };
  }

  private async compareModels(params: z.infer<typeof CompareModelsSchema>) {
    const { models, message, max_tokens } = params;

    const promises = models.map(async (model) => {
      try {
        const response = await axios.post(
          `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
          {
            model,
            messages: [{ role: "user", content: message }],
            max_tokens,
          },
          { headers: OPENROUTER_CONFIG.headers }
        );

        return {
          model,
          response: response.data.choices[0].message.content,
          usage: response.data.usage,
          success: true,
        };
      } catch (error) {
        return {
          model,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    });

    const results = await Promise.all(promises);

    const formattedResults = results
      .map((result) => {
        if (result.success) {
          return `**${result.model}:**\n${result.response}\n*Tokens: ${result.usage.total_tokens}*`;
        } else {
          return `**${result.model}:** ❌ Error - ${result.error}`;
        }
      })
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Comparison of ${models.length} models:\n\n${formattedResults}`,
        },
      ],
    };
  }

  private async getModelInfo(params: { model: string }) {
    const response = await axios.get(`${OPENROUTER_CONFIG.baseURL}/models`, {
      headers: OPENROUTER_CONFIG.headers,
    });

    const model = response.data.data.find((m: any) => m.id === params.model);

    if (!model) {
      throw new Error(`Model ${params.model} not found`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(model, null, 2),
        },
      ],
    };
  }

  private async analyzeDocument(params: z.infer<typeof DocumentAnalysisSchema>) {
    const {
      document,
      query,
      chunk_size,
      overlap,
      parallel_instances,
      model,
      analysis_type,
      max_tokens,
      temperature,
    } = params;

    // Validate parallel instances
    const instances = Math.min(Math.max(1, parallel_instances), 5);

    // Create chunks with overlap
    const chunks = this.createDocumentChunks(document, chunk_size, overlap);

    // Process based on analysis type
    let results;
    switch (analysis_type) {
      case "search":
        results = await this.performSearchAnalysis(chunks, query || "", model, instances, max_tokens, temperature);
        break;
      case "extract":
        results = await this.performExtractionAnalysis(chunks, query || "", model, instances, max_tokens, temperature);
        break;
      case "qa":
        results = await this.performQAAnalysis(chunks, query || "", model, instances, max_tokens, temperature);
        break;
      case "summarize":
      default:
        results = await this.performSummarizationAnalysis(chunks, query, model, instances, max_tokens, temperature);
        break;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: results,
        },
      ],
    };
  }

  private createDocumentChunks(document: string, chunkSize: number, overlap: number): Array<{ text: string; index: number; start: number; end: number }> {
    const chunks: Array<{ text: string; index: number; start: number; end: number }> = [];
    let start = 0;
    let index = 0;

    while (start < document.length) {
      const end = Math.min(start + chunkSize, document.length);
      chunks.push({
        text: document.substring(start, end),
        index,
        start,
        end,
      });

      if (end >= document.length) break;
      
      start += chunkSize - overlap;
      index++;
    }

    return chunks;
  }

  private async processChunksInBatches(
    chunks: Array<{ text: string; index: number; start: number; end: number }>,
    promptBuilder: (chunk: any) => string,
    model: string,
    instances: number,
    maxTokens: number,
    temperature: number
  ): Promise<Array<{ chunk: number; response: string; error?: string }>> {
    const results: Array<{ chunk: number; response: string; error?: string }> = [];
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += instances) {
      const batch = chunks.slice(i, i + instances);
      const promises = batch.map(async (chunk) => {
        try {
          const response = await axios.post(
            `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
            {
              model,
              messages: [{ role: "user", content: promptBuilder(chunk) }],
              max_tokens: maxTokens,
              temperature,
            },
            { headers: OPENROUTER_CONFIG.headers }
          );
          
          return {
            chunk: chunk.index,
            response: response.data.choices[0].message.content,
          };
        } catch (error) {
          return {
            chunk: chunk.index,
            response: "",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  private async performSummarizationAnalysis(
    chunks: Array<{ text: string; index: number; start: number; end: number }>,
    query: string | undefined,
    model: string,
    instances: number,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    // Step 1: Summarize each chunk
    const chunkSummaries = await this.processChunksInBatches(
      chunks,
      (chunk) => `Summarize this section of a larger document (section ${chunk.index + 1} of ${chunks.length}):\n\n${chunk.text}\n\n${query ? `Focus on: ${query}` : "Provide a comprehensive summary."}`,
      model,
      instances,
      maxTokens,
      temperature
    );

    // Step 2: Combine summaries
    const combinedSummaries = chunkSummaries
      .filter(s => !s.error)
      .map(s => `Section ${s.chunk + 1}: ${s.response}`)
      .join("\n\n");

    // Step 3: Create final summary
    const finalSummaryResponse = await axios.post(
      `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
      {
        model,
        messages: [{
          role: "user",
          content: `Create a comprehensive summary by combining these section summaries:\n\n${combinedSummaries}\n\n${query ? `Ensure the summary addresses: ${query}` : "Create a coherent, unified summary."}`
        }],
        max_tokens: maxTokens * 2,
        temperature,
      },
      { headers: OPENROUTER_CONFIG.headers }
    );

    const finalSummary = finalSummaryResponse.data.choices[0].message.content;
    const errors = chunkSummaries.filter(s => s.error);

    return `📊 **Document Analysis Results**\n\n` +
      `**Analysis Type:** Summarization\n` +
      `**Model:** ${model}\n` +
      `**Document Size:** ${chunks[chunks.length - 1].end.toLocaleString()} characters\n` +
      `**Chunks Processed:** ${chunks.length}\n` +
      `**Parallel Instances:** ${instances}\n` +
      (query ? `**Focus Query:** ${query}\n` : "") +
      `\n---\n\n` +
      `**Summary:**\n${finalSummary}\n` +
      (errors.length > 0 ? `\n⚠️ **Errors:** ${errors.length} chunks failed to process\n` : "");
  }

  private async performSearchAnalysis(
    chunks: Array<{ text: string; index: number; start: number; end: number }>,
    query: string,
    model: string,
    instances: number,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!query) {
      throw new Error("Search analysis requires a query");
    }

    const searchResults = await this.processChunksInBatches(
      chunks,
      (chunk) => `Search this document section for information about "${query}":\n\n${chunk.text}\n\nReport any relevant findings with specific quotes and details. If nothing relevant is found, respond with "No relevant information found."`,
      model,
      instances,
      maxTokens,
      temperature
    );

    const findings = searchResults
      .filter(r => !r.error && !r.response.toLowerCase().includes("no relevant information"))
      .map(r => `**Section ${r.chunk + 1} (chars ${chunks[r.chunk].start}-${chunks[r.chunk].end}):**\n${r.response}`)
      .join("\n\n");

    return `🔍 **Document Search Results**\n\n` +
      `**Query:** "${query}"\n` +
      `**Model:** ${model}\n` +
      `**Document Size:** ${chunks[chunks.length - 1].end.toLocaleString()} characters\n` +
      `**Chunks Searched:** ${chunks.length}\n` +
      `\n---\n\n` +
      (findings ? findings : "No relevant information found in the document.");
  }

  private async performExtractionAnalysis(
    chunks: Array<{ text: string; index: number; start: number; end: number }>,
    extractionTarget: string,
    model: string,
    instances: number,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    const target = extractionTarget || "key facts, dates, names, and important information";

    const extractionResults = await this.processChunksInBatches(
      chunks,
      (chunk) => `Extract ${target} from this document section:\n\n${chunk.text}\n\nProvide extracted information in a structured format.`,
      model,
      instances,
      maxTokens,
      temperature
    );

    // Combine and deduplicate extracted information
    const combinedResponse = await axios.post(
      `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
      {
        model,
        messages: [{
          role: "user",
          content: `Combine and organize these extracted items, removing duplicates:\n\n${extractionResults.filter(r => !r.error).map(r => r.response).join("\n\n")}\n\nPresent the final extracted information in a clear, organized format.`
        }],
        max_tokens: maxTokens * 2,
        temperature: 0.1,
      },
      { headers: OPENROUTER_CONFIG.headers }
    );

    return `📋 **Document Extraction Results**\n\n` +
      `**Extraction Target:** ${target}\n` +
      `**Model:** ${model}\n` +
      `**Chunks Processed:** ${chunks.length}\n` +
      `\n---\n\n` +
      combinedResponse.data.choices[0].message.content;
  }

  private async performQAAnalysis(
    chunks: Array<{ text: string; index: number; start: number; end: number }>,
    questions: string,
    model: string,
    instances: number,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!questions) {
      throw new Error("Q&A analysis requires questions");
    }

    // First, search all chunks for relevant information
    const qaResults = await this.processChunksInBatches(
      chunks,
      (chunk) => `Based on this document section, answer these questions:\n${questions}\n\nDocument section:\n${chunk.text}\n\nProvide specific answers with quotes when possible. If the section doesn't contain relevant information, indicate that.`,
      model,
      instances,
      maxTokens,
      temperature
    );

    // Combine answers from all chunks
    const combinedAnswers = await axios.post(
      `${OPENROUTER_CONFIG.baseURL}/chat/completions`,
      {
        model,
        messages: [{
          role: "user",
          content: `Synthesize these answers into comprehensive responses to the questions:\n\nQuestions:\n${questions}\n\nAnswers from different sections:\n${qaResults.filter(r => !r.error).map((r, i) => `Section ${r.chunk + 1}: ${r.response}`).join("\n\n")}\n\nProvide final, complete answers to each question.`
        }],
        max_tokens: maxTokens * 2,
        temperature,
      },
      { headers: OPENROUTER_CONFIG.headers }
    );

    return `❓ **Document Q&A Results**\n\n` +
      `**Questions:** ${questions}\n` +
      `**Model:** ${model}\n` +
      `**Chunks Analyzed:** ${chunks.length}\n` +
      `\n---\n\n` +
      `**Answers:**\n${combinedAnswers.data.choices[0].message.content}`;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("OpenRouter MCP Server running on stdio");
  }
}

// Start the server
const server = new OpenRouterMCPServer();
server.run().catch(console.error);