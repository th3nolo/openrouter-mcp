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

console.log('🔍 Debug mode: Testing analyze_document\n');

// Capture ALL output
server.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('STDOUT:', text);
  
  // Try to parse JSON responses
  const lines = text.split('\n').filter(l => l.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.error) {
        console.error('\n❌ ERROR RESPONSE:', json.error);
      }
    } catch (e) {}
  });
});

server.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

// Initialize
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "debug", version: "1.0.0" }
  }
}) + '\n');

// Simple test
setTimeout(() => {
  const testDoc = "Newton discovered that F=ma. This is the second law of motion.";
  
  console.log('\n📝 Sending simple test document...\n');
  
  const request = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: testDoc,
        analysis_type: "summarize",
        parallel_instances: 1,
        chunk_size: 100,
        model: "google/gemma-3n-e4b-it",
        max_tokens: 500
      }
    }
  };
  
  console.log('Request:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
}, 1000);

// Exit after 20 seconds
setTimeout(() => {
  console.log('\n✅ Debug test complete');
  server.kill();
  process.exit(0);
}, 20000);