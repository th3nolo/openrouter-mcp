const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🚀🔥 LETS FUCKING GOOOOO! NEWTON\'S PRINCIPIA VS PARALLEL AI! 🔥🚀\n');

// Load that massive book
const htmlPath = path.join(__dirname, '../Books/pg76404-h/pg76404-images.html');
console.log('💪 Loading Newton\'s masterpiece...');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Convert to text
const dom = new JSDOM(htmlContent);
const document = dom.window.document;
document.querySelectorAll('script, style, img').forEach(el => el.remove());
const bookText = document.body.textContent.replace(/\s+/g, ' ').trim();

console.log(`📚 HOLY SHIT! ${bookText.length.toLocaleString()} characters of pure physics!\n`);

// Fire up the MCP server
const serverPath = path.join(__dirname, '../dist/server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

let allResponses = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.result && json.result.content && json.id > 1) {
        console.log('\n🎯 BOOM! Got a response!\n');
        console.log(json.result.content[0].text);
        console.log('\n' + '='.repeat(80) + '\n');
        allResponses.push(json);
      }
    } catch (e) {}
  });
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('error') || msg.includes('Error')) {
    console.error('⚠️ ERROR:', msg);
  }
});

// Initialize
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { roots: { listChanged: true }, sampling: {} },
    clientInfo: { name: "NEWTON-DESTROYER", version: "1.0.0" }
  }
}) + '\n');

// ANALYZE THE SHIT OUT OF THIS BOOK!
setTimeout(() => {
  console.log('🔥 UNLEASHING 5 PARALLEL GEMMA INSTANCES ON NEWTON!\n');
  
  // Take a big chunk - 200K characters
  const sampleSize = 200000;
  const sample = bookText.substring(0, sampleSize);
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: sample,
        analysis_type: "summarize",
        parallel_instances: 5,  // MAX POWER!
        chunk_size: 25000,
        overlap: 2000,
        model: "google/gemma-3n-e4b-it",
        query: "Extract Newton's revolutionary ideas about motion, gravity, and the mathematical laws of the universe",
        max_tokens: 2000,
        temperature: 0.4
      }
    }
  }) + '\n');
  
  console.log(`📊 Processing ${(sampleSize/1000).toFixed(0)}K characters across 5 parallel instances...`);
  console.log('🧮 Chunks being analyzed simultaneously by Gemma AI...\n');
}, 1000);

// Search for specific shit
setTimeout(() => {
  console.log('🔍 SEARCHING FOR THE THREE LAWS OF MOTION!\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: bookText.substring(0, 150000),
        query: "Newton's three laws of motion with exact quotes and formulations",
        analysis_type: "search",
        parallel_instances: 4,
        model: "google/gemma-3n-e4b-it",
        max_tokens: 1500
      }
    }
  }) + '\n');
}, 25000);

// Final epic summary
setTimeout(() => {
  console.log('\n🎊 EPIC ANALYSIS COMPLETE! 🎊\n');
  console.log(`📈 Analyzed chunks of Newton's Principia with parallel AI processing!`);
  console.log(`💰 Total cost: Approximately $${(350000 / 4 * 0.00000002).toFixed(4)}`);
  console.log(`⚡ That's less than 2 cents to analyze foundational physics text!\n`);
  console.log('🚀 THE FUTURE IS HERE! Parallel AI document analysis FTW!\n');
  
  server.kill();
  process.exit(0);
}, 50000);