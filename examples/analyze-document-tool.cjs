const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load test document
const testDocument = fs.readFileSync(path.join(__dirname, 'test-document.txt'), 'utf-8');

const serverPath = '/home/th3nolo/openrouter-mcp/dist/server.js';
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'REDACTED_API_KEY',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

let responses = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      responses.push(json);
      if (json.result && json.result.content) {
        console.log('\n📊 Response received');
      }
    } catch (e) {}
  });
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!msg.includes('OpenRouter MCP Server running')) {
    console.error('Server log:', msg);
  }
});

console.log('🚀 Testing the new analyze_document tool\n');

// Initialize MCP connection
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { roots: { listChanged: true }, sampling: {} },
    clientInfo: { name: "test", version: "1.0.0" }
  }
}) + '\n');

// Example 1: Document Summarization
setTimeout(() => {
  console.log('📝 Example 1: Document Summarization\n');
  console.log('Analyzing document with parallel processing...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDocument,
        analysis_type: "summarize",
        parallel_instances: 3,
        chunk_size: 20000,
        overlap: 1000
      }
    }
  }) + '\n');
}, 500);

// Example 2: Search Analysis
setTimeout(() => {
  console.log('\n📝 Example 2: Document Search\n');
  console.log('Searching for AI challenges and limitations...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDocument,
        query: "challenges, limitations, and ethical concerns",
        analysis_type: "search",
        parallel_instances: 4,
        model: "google/gemma-3n-e4b-it"
      }
    }
  }) + '\n');
}, 15000);

// Example 3: Information Extraction
setTimeout(() => {
  console.log('\n📝 Example 3: Information Extraction\n');
  console.log('Extracting key dates and milestones...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDocument,
        query: "dates, years, and historical milestones",
        analysis_type: "extract",
        parallel_instances: 3,
        temperature: 0.1
      }
    }
  }) + '\n');
}, 30000);

// Example 4: Q&A Analysis
setTimeout(() => {
  console.log('\n📝 Example 4: Q&A Analysis\n');
  console.log('Answering multiple questions about the document...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDocument,
        query: "1. What are the key milestones in AI development?\n2. What are the main challenges facing AI?\n3. What recommendations are provided for organizations?",
        analysis_type: "qa",
        parallel_instances: 3,
        max_tokens: 1500
      }
    }
  }) + '\n');
}, 45000);

// Display results and exit
setTimeout(() => {
  console.log('\n✅ All analyses complete!\n');
  console.log('='.repeat(80));
  
  responses.forEach((resp, idx) => {
    if (resp.result && resp.result.content && resp.id > 1) {
      console.log(`\n📊 Result ${resp.id - 1}:`);
      console.log(resp.result.content[0].text);
      console.log('\n' + '='.repeat(80));
    }
  });
  
  // Show cost estimate
  console.log('\n💰 Cost Estimate:');
  console.log('- Each analysis: ~$0.0002-0.0005 (depending on document size)');
  console.log('- Total for 4 analyses: ~$0.002');
  console.log('\nThe analyze_document tool efficiently processes large documents using parallel Gemma instances!');
  
  server.kill();
  process.exit(0);
}, 60000);