#!/usr/bin/env node

/**
 * Document Analysis using OpenRouter MCP Server
 * 
 * This script demonstrates how to use multiple Gemma instances to analyze
 * large documents efficiently by:
 * 1. Chunking documents to fit within context windows
 * 2. Using parallel model instances for faster processing
 * 3. Combining results for comprehensive analysis
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  mcp_server: path.join(__dirname, '..', 'dist', 'server.js'),
  model: 'google/gemma-3n-e4b-it', // Using the paid Gemma model (32K context)
  chunk_size: 25000, // Characters per chunk (leaving room for prompts)
  overlap: 2000, // Overlap between chunks for context continuity
  max_parallel: 3, // Number of parallel Gemma instances
};

class DocumentAnalyzer {
  constructor() {
    this.server = null;
    this.requestId = 0;
  }

  async initialize() {
    this.server = spawn('node', [CONFIG.mcp_server], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      }
    });

    this.server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const json = JSON.parse(line);
          if (json.id && this.pendingRequests[json.id]) {
            this.pendingRequests[json.id].resolve(json);
            delete this.pendingRequests[json.id];
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      });
    });

    this.server.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('OpenRouter MCP Server running')) {
        console.error('Server error:', msg);
      }
    });

    this.pendingRequests = {};

    // Initialize MCP connection
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { roots: { listChanged: true }, sampling: {} },
      clientInfo: { name: 'document-analyzer', version: '1.0.0' }
    });
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests[id] = { resolve, reject };
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests[id]) {
          this.pendingRequests[id].reject(new Error('Request timeout'));
          delete this.pendingRequests[id];
        }
      }, 30000);
    });
  }

  chunkDocument(text, chunkSize = CONFIG.chunk_size, overlap = CONFIG.overlap) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        text: text.substring(start, end),
        start,
        end,
        index: chunks.length
      });
      
      start += chunkSize - overlap;
    }
    
    return chunks;
  }

  async analyzeChunk(chunk, query, chunkInfo) {
    const prompt = `You are analyzing part ${chunkInfo.index + 1} of a document.
${query ? `User Query: "${query}"` : 'Task: Summarize this section.'}

Document section (characters ${chunkInfo.start}-${chunkInfo.end}):
"""
${chunk.text}
"""

${query ? 
  'Provide relevant information that answers the query. If nothing relevant is found, say "No relevant information in this section."' : 
  'Provide a concise summary of the key points in this section.'}`;

    const response = await this.sendRequest('tools/call', {
      name: 'chat_with_model',
      arguments: {
        model: CONFIG.model,
        message: prompt,
        max_tokens: 1000,
        temperature: 0.3 // Lower temperature for more focused analysis
      }
    });

    return {
      chunkIndex: chunkInfo.index,
      response: response.result.content[0].text
    };
  }

  async searchDocument(documentText, query) {
    console.log(`\n🔍 Searching document for: "${query}"`);
    console.log(`📄 Document size: ${documentText.length} characters`);
    
    // Chunk the document
    const chunks = this.chunkDocument(documentText);
    console.log(`📊 Split into ${chunks.length} chunks\n`);

    // Process chunks in parallel batches
    const results = [];
    for (let i = 0; i < chunks.length; i += CONFIG.max_parallel) {
      const batch = chunks.slice(i, i + CONFIG.max_parallel);
      console.log(`Processing chunks ${i + 1}-${Math.min(i + CONFIG.max_parallel, chunks.length)} of ${chunks.length}...`);
      
      const batchPromises = batch.map(chunk => 
        this.analyzeChunk(chunk, query, chunk)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Combine and filter results
    const relevantResults = results.filter(r => 
      !r.response.includes('No relevant information')
    );

    return {
      query,
      totalChunks: chunks.length,
      relevantChunks: relevantResults.length,
      results: relevantResults
    };
  }

  async summarizeDocument(documentText) {
    console.log(`\n📝 Summarizing document...`);
    console.log(`📄 Document size: ${documentText.length} characters`);
    
    // Chunk the document
    const chunks = this.chunkDocument(documentText);
    console.log(`📊 Split into ${chunks.length} chunks\n`);

    // First pass: Get summaries of each chunk
    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i += CONFIG.max_parallel) {
      const batch = chunks.slice(i, i + CONFIG.max_parallel);
      console.log(`Summarizing chunks ${i + 1}-${Math.min(i + CONFIG.max_parallel, chunks.length)} of ${chunks.length}...`);
      
      const batchPromises = batch.map(chunk => 
        this.analyzeChunk(chunk, null, chunk)
      );
      
      const batchResults = await Promise.all(batchPromises);
      chunkSummaries.push(...batchResults);
    }

    // Second pass: Combine summaries into final summary
    console.log('\nCombining chunk summaries...');
    const combinedSummaries = chunkSummaries
      .map(s => `Section ${s.chunkIndex + 1}: ${s.response}`)
      .join('\n\n');

    const finalSummaryResponse = await this.sendRequest('tools/call', {
      name: 'chat_with_model',
      arguments: {
        model: CONFIG.model,
        message: `Please provide a comprehensive summary by combining these section summaries into a cohesive overview:\n\n${combinedSummaries}`,
        max_tokens: 2000,
        temperature: 0.3
      }
    });

    return {
      chunkSummaries,
      finalSummary: finalSummaryResponse.result.content[0].text
    };
  }

  async compareAnalyses(documentText, queries) {
    console.log(`\n🔄 Comparing analyses for multiple queries...`);
    
    // Use compare_models to process multiple queries in parallel
    const chunks = this.chunkDocument(documentText, 10000); // Smaller chunks for comparison
    const results = {};

    for (const chunk of chunks) {
      const prompt = `Analyze this text section and answer each query:
${queries.map((q, i) => `Query ${i + 1}: ${q}`).join('\n')}

Text:
"""
${chunk.text}
"""`;

      const response = await this.sendRequest('tools/call', {
        name: 'compare_models',
        arguments: {
          models: Array(queries.length).fill(CONFIG.model),
          message: prompt,
          max_tokens: 500
        }
      });

      // Parse responses for each query
      queries.forEach((query, index) => {
        if (!results[query]) results[query] = [];
        results[query].push({
          chunkIndex: chunk.index,
          response: response.result.content[0].text.split('---')[index]
        });
      });
    }

    return results;
  }

  async close() {
    if (this.server) {
      this.server.kill();
    }
  }
}

// Example usage
async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Please set OPENROUTER_API_KEY environment variable');
    process.exit(1);
  }

  const analyzer = new DocumentAnalyzer();
  
  try {
    await analyzer.initialize();
    
    // Example: Analyze a document
    const sampleDocument = `
    [Your large document text here]
    
    For testing, you can load a file:
    const document = await fs.readFile('path/to/document.txt', 'utf-8');
    `;

    // Example 1: Search for specific information
    const searchResults = await analyzer.searchDocument(
      sampleDocument,
      "What are the main findings?"
    );
    console.log('\n📋 Search Results:', searchResults);

    // Example 2: Summarize the document
    const summary = await analyzer.summarizeDocument(sampleDocument);
    console.log('\n📄 Document Summary:', summary.finalSummary);

    // Example 3: Compare multiple queries
    const comparisons = await analyzer.compareAnalyses(
      sampleDocument,
      ["What are the key points?", "What are the recommendations?", "What are the challenges?"]
    );
    console.log('\n🔍 Comparative Analysis:', comparisons);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await analyzer.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DocumentAnalyzer };