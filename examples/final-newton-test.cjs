const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 NEWTON\'S PRINCIPIA - FINAL ANALYSIS TEST\n');
console.log('='.repeat(80) + '\n');

// Load the cleaned sample
const sampleText = fs.readFileSync(path.join(__dirname, 'newton-sample.txt'), 'utf-8');
console.log(`📚 Loaded ${sampleText.length.toLocaleString()} characters of Newton's Principia\n`);

// Start MCP server
const serverPath = path.join(__dirname, '../dist/server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

// Capture responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.result && json.result.content && json.id === 2) {
        console.log('\n✅ ANALYSIS COMPLETE!\n');
        const text = json.result.content[0].text;
        
        // Extract just the summary part
        const summaryMatch = text.match(/\*\*Summary:\*\*\n(.+?)(?:\n\n|$)/s);
        if (summaryMatch) {
          console.log('📖 SUMMARY OF NEWTON\'S PRINCIPIA:\n');
          console.log(summaryMatch[1]);
        } else {
          console.log(text);
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Show stats
        const statsMatch = text.match(/\*\*Document Size:\*\* ([\d,]+) characters/);
        const chunksMatch = text.match(/\*\*Chunks Processed:\*\* (\d+)/);
        
        if (statsMatch && chunksMatch) {
          console.log('📊 PROCESSING STATS:');
          console.log(`- Document size: ${statsMatch[1]} characters`);
          console.log(`- Chunks processed: ${chunksMatch[1]}`);
          console.log(`- Parallel instances: 3`);
          console.log(`- Model: Google Gemma 3n-e4b-it`);
          console.log(`- Estimated cost: $${(50000 / 4 * 0.00000002).toFixed(5)}`);
        }
      }
    } catch (e) {}
  });
});

server.stderr.on('data', (data) => {
  if (data.toString().includes('Error')) {
    console.error('Error:', data.toString());
  }
});

// Initialize
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "newton-test", version: "1.0.0" }
  }
}) + '\n');

// Run analysis
setTimeout(() => {
  console.log('🔬 Analyzing Newton\'s Principia with parallel processing...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: sampleText,
        analysis_type: "summarize",
        parallel_instances: 3,
        chunk_size: 15000,
        overlap: 1000,
        model: "google/gemma-3n-e4b-it",
        max_tokens: 1500,
        temperature: 0.3
      }
    }
  }) + '\n');
}, 1000);

// Exit after 30 seconds
setTimeout(() => {
  console.log('\n✨ Test complete!');
  server.kill();
  process.exit(0);
}, 30000);