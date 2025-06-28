const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '../dist/server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

console.log('🚀 Testing analyze_document tool...\n');

// Capture all output
server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

// Initialize
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" }
  }
}) + '\n');

// List available tools to verify analyze_document exists
setTimeout(() => {
  console.log('\n📋 Listing available tools...\n');
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + '\n');
}, 500);

// Test with a simple document
setTimeout(() => {
  console.log('\n📝 Testing analyze_document with simple text...\n');
  
  const testDoc = `Newton's Principia: The Mathematical Principles of Natural Philosophy

Chapter 1: Introduction
Sir Isaac Newton's masterwork laid the foundation for classical mechanics. His three laws of motion revolutionized our understanding of the physical world.

Chapter 2: The Laws of Motion
First Law: An object at rest stays at rest and an object in motion stays in motion unless acted upon by an external force.
Second Law: Force equals mass times acceleration (F = ma).
Third Law: For every action, there is an equal and opposite reaction.

Chapter 3: Universal Gravitation
Newton proposed that every particle attracts every other particle with a force proportional to the product of their masses and inversely proportional to the square of the distance between them.`;

  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDoc,
        analysis_type: "summarize",
        parallel_instances: 2,
        chunk_size: 500,
        model: "google/gemma-3n-e4b-it"
      }
    }
  }) + '\n');
}, 1500);

// Exit after 15 seconds
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 15000);