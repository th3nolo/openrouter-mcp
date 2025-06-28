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

console.log('Testing simple chat first...\n');

server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server:', data.toString());
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

// Test simple chat
setTimeout(() => {
  console.log('Testing chat_with_model...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "chat_with_model",
      arguments: {
        model: "google/gemma-3n-e4b-it",
        message: "What is Newton's second law?",
        max_tokens: 100
      }
    }
  }) + '\n');
}, 1000);

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 10000);