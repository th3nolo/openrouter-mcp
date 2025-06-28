const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🚀 NEWTON\'S PRINCIPIA PARALLEL ANALYSIS 🚀\n');
console.log('=' + '='.repeat(79) + '\n');

// Load the book
const htmlPath = path.join(__dirname, '../Books/pg76404-h/pg76404-images.html');
console.log('📚 Loading Newton\'s Principia from Project Gutenberg...');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Convert to text
const dom = new JSDOM(htmlContent);
const document = dom.window.document;
document.querySelectorAll('script, style, img, .pagenum').forEach(el => el.remove());
const bookText = document.body.textContent
  .replace(/\s+/g, ' ')
  .replace(/Project Gutenberg.*?START OF THE PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i, '')
  .trim();

console.log(`✓ Loaded ${bookText.length.toLocaleString()} characters\n`);

// Start MCP server
const serverPath = path.join(__dirname, '../dist/server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENROUTER_API_KEY: 'REDACTED_API_KEY',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1'
  }
});

let analysisCount = 0;

// Process responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.result && json.result.content && json.id > 1) {
        analysisCount++;
        const content = json.result.content[0].text;
        
        // Parse and display the formatted results
        if (content.includes('**Document Analysis Results**')) {
          console.log(`\n📊 ANALYSIS ${analysisCount} COMPLETE!\n`);
          console.log(content);
          console.log('\n' + '='.repeat(80) + '\n');
        }
      }
    } catch (e) {}
  });
});

// Initialize
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "principia-analyzer", version: "1.0.0" }
  }
}) + '\n');

// Analysis 1: Executive Summary
setTimeout(() => {
  console.log('📖 ANALYSIS 1: Creating Executive Summary\n');
  console.log('Using 5 parallel Gemma instances to process the first 250K characters...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: bookText.substring(0, 250000),
        analysis_type: "summarize",
        parallel_instances: 5,
        chunk_size: 30000,
        overlap: 3000,
        model: "google/gemma-3n-e4b-it",
        query: "Focus on Newton's key principles, mathematical methods, and revolutionary ideas about physics",
        max_tokens: 2000,
        temperature: 0.3
      }
    }
  }) + '\n');
}, 1000);

// Analysis 2: Search for Laws of Motion
setTimeout(() => {
  console.log('🔍 ANALYSIS 2: Finding Newton\'s Laws of Motion\n');
  console.log('Searching through 200K characters for the three laws...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: bookText.substring(0, 200000),
        query: "Newton's three laws of motion, axioms, and their exact formulations",
        analysis_type: "search",
        parallel_instances: 4,
        model: "google/gemma-3n-e4b-it",
        max_tokens: 1500,
        temperature: 0.2
      }
    }
  }) + '\n');
}, 30000);

// Analysis 3: Extract Mathematical Content
setTimeout(() => {
  console.log('🧮 ANALYSIS 3: Extracting Mathematical Formulas\n');
  console.log('Identifying theorems, proofs, and mathematical relationships...\n');
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "analyze_document",
      arguments: {
        document: bookText.substring(50000, 150000),
        query: "mathematical theorems, proofs, formulas, and geometric constructions",
        analysis_type: "extract",
        parallel_instances: 3,
        model: "google/gemma-3n-e4b-it",
        max_tokens: 1500,
        temperature: 0.1
      }
    }
  }) + '\n');
}, 60000);

// Final summary
setTimeout(() => {
  console.log('\n' + '='.repeat(80));
  console.log('\n🎉 EPIC ANALYSIS COMPLETE! 🎉\n');
  console.log('📊 Summary:');
  console.log(`- Analyzed sections of Newton's Principia (${(bookText.length/1000).toFixed(0)}K chars total)`);
  console.log('- Used parallel Gemma AI instances for efficient processing');
  console.log('- Created summaries, searched for laws, extracted formulas');
  console.log(`- Total estimated cost: ~$${(600000 / 4 * 0.00000002).toFixed(4)}`);
  console.log('\n🚀 This demonstrates how the analyze_document tool can process');
  console.log('   entire books affordably using parallel AI processing!');
  console.log('\n💡 Full book analysis would cost approximately $' + 
    (bookText.length / 4 * 0.00000002).toFixed(2));
  console.log('\n' + '='.repeat(80) + '\n');
  
  server.kill();
  process.exit(0);
}, 90000);