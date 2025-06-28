const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load and convert HTML
const htmlPath = path.join(__dirname, '../Books/pg76404-h/pg76404-images.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

const dom = new JSDOM(htmlContent);
const document = dom.window.document;

// Remove unwanted elements
document.querySelectorAll('script, style, img, .pagenum, #pg-header, #pg-footer').forEach(el => el.remove());

// Get text
const bookText = document.body.textContent;

// Clean up text
const cleanText = bookText
  .replace(/\[Pg \d+\]/g, '') // Remove page numbers
  .replace(/\s+/g, ' ')       // Normalize whitespace
  .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
  .trim();

console.log('First 2000 characters of cleaned text:\n');
console.log(cleanText.substring(0, 2000));
console.log('\n...\n');
console.log(`Total length: ${cleanText.length} characters`);

// Save a sample for testing
fs.writeFileSync(
  path.join(__dirname, 'newton-sample.txt'),
  cleanText.substring(0, 50000),
  'utf-8'
);
console.log('\nSaved first 50K chars to newton-sample.txt for testing');