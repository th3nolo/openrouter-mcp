const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load and convert HTML to text
const htmlPath = path.join(__dirname, '../Books/pg76404-h/pg76404-images.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

console.log('📚 Converting Newton\'s Principia to text...');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

// Remove unnecessary elements
document.querySelectorAll('script, style, img').forEach(el => el.remove());

// Get main text content
const textContent = document.body.textContent
  .replace(/\s+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

console.log(`📊 Document size: ${textContent.length.toLocaleString()} characters`);
console.log(`📄 First 500 chars: ${textContent.substring(0, 500)}...\n`);

// Setup MCP server connection
const serverPath = path.join(__dirname, '../dist/server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

let responses = [];
let responseCount = 0;

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.result && json.result.content) {
        responses.push(json);
        responseCount++;
        console.log(`\n📨 Received response ${responseCount}\n`);
        
        // Print the result immediately
        if (json.result.content[0] && json.result.content[0].text) {
          console.log(json.result.content[0].text);
          console.log('\n' + '='.repeat(80) + '\n');
        }
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  });
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!msg.includes('OpenRouter MCP Server running')) {
    console.error('Debug:', msg);
  }
});

// Initialize MCP connection
console.log('🚀 Initializing MCP server...\n');
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

// Wait a moment then analyze
setTimeout(() => {
  console.log('📖 Analyzing the first 100K characters of Newton\'s Principia...\n');
  console.log('This will use 4 parallel Gemma instances to process the text in chunks.\n');
  
  // Take first 100K characters for this test
  const sampleText = textContent.substring(0, 100000);
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: sampleText,
        analysis_type: "summarize",
        parallel_instances: 4,
        chunk_size: 20000,
        overlap: 1500,
        query: "Focus on the main themes, Newton's key principles, and the structure of the work",
        model: "google/gemma-3n-e4b-it",
        max_tokens: 1500,
        temperature: 0.3
      }
    }
  }) + '\n');
}, 1000);

// Close after 30 seconds
setTimeout(() => {
  console.log('\n💰 Cost estimate for full book analysis:');
  console.log(`- Full book size: ${textContent.length.toLocaleString()} characters`);
  console.log(`- Estimated chunks: ${Math.ceil(textContent.length / 20000)}`);
  console.log(`- Estimated cost: $${(textContent.length / 4 * 0.00000002).toFixed(4)}`);
  console.log('\nThe analyze_document tool makes it affordable to process entire books!');
  
  server.kill();
  process.exit(0);
}, 30000);