const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load Newton's Principia HTML
const htmlPath = path.join(__dirname, '../Books/pg76404-h/pg76404-images.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Convert HTML to plain text
console.log('📚 Converting Newton\'s Principia HTML to text...');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

// Remove script and style elements
document.querySelectorAll('script, style').forEach(el => el.remove());

// Get text content
const textContent = document.body.textContent
  .replace(/\s+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

console.log(`📊 Document size: ${textContent.length.toLocaleString()} characters\n`);

// Setup MCP server
const serverPath = path.join(__dirname, '../dist/server.js');
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
        console.log('📊 Response received');
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

// Initialize MCP
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

// Test 1: Summarize the entire book
setTimeout(() => {
  console.log('🔬 Test 1: Summarizing Newton\'s Principia\n');
  console.log('Using parallel processing to create a comprehensive summary...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: textContent.substring(0, 500000), // First 500K chars for initial test
        analysis_type: "summarize",
        parallel_instances: 5,
        chunk_size: 25000,
        overlap: 2000,
        query: "Focus on Newton's laws of motion, universal gravitation, and key mathematical proofs"
      }
    }
  }) + '\n');
}, 500);

// Test 2: Search for specific concepts
setTimeout(() => {
  console.log('\n🔬 Test 2: Searching for Laws of Motion\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: textContent.substring(0, 300000),
        query: "Newton's three laws of motion and their mathematical formulations",
        analysis_type: "search",
        parallel_instances: 4
      }
    }
  }) + '\n');
}, 20000);

// Test 3: Extract key information
setTimeout(() => {
  console.log('\n🔬 Test 3: Extracting Mathematical Formulas and Theorems\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: textContent.substring(0, 200000),
        query: "mathematical formulas, equations, theorems, and proofs",
        analysis_type: "extract",
        parallel_instances: 3,
        temperature: 0.1
      }
    }
  }) + '\n');
}, 40000);

// Test 4: Q&A about the book
setTimeout(() => {
  console.log('\n🔬 Test 4: Q&A about Newton\'s Principia\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: textContent.substring(0, 150000),
        query: "1. What are Newton's three laws of motion?\n2. How does Newton explain universal gravitation?\n3. What mathematical methods does Newton use in his proofs?",
        analysis_type: "qa",
        parallel_instances: 3,
        max_tokens: 2000
      }
    }
  }) + '\n');
}, 60000);

// Display results
setTimeout(() => {
  console.log('\n✅ All analyses complete!\n');
  console.log('='.repeat(80));
  
  responses.forEach((resp, idx) => {
    if (resp.result && resp.result.content && resp.id > 1) {
      console.log(`\n📊 Analysis ${resp.id - 1} Results:`);
      console.log(resp.result.content[0].text);
      console.log('\n' + '='.repeat(80));
    }
  });
  
  // Cost analysis
  const totalChars = 500000 + 300000 + 200000 + 150000; // Sum of all analyses
  const avgTokens = totalChars / 4; // Rough estimate
  const cost = avgTokens * 0.00000002;
  
  console.log('\n💰 Cost Analysis:');
  console.log(`- Total characters analyzed: ${totalChars.toLocaleString()}`);
  console.log(`- Estimated tokens: ${avgTokens.toLocaleString()}`);
  console.log(`- Estimated cost: $${cost.toFixed(5)}`);
  console.log('\nThe parallel processing made analyzing this massive historical text efficient and affordable!');
  
  server.kill();
  process.exit(0);
}, 80000);