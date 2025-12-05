// scripts/test_resume_parser.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const rp = require('./helpers/resume-parser'); // adjust path if needed

async function runTests() {
  console.log('Running resume-parser tests...\n');

  // 1) Direct text tests (no file)
  const sampleText = `
John Doe
Software Engineer
Email: john.doe@example.com
Mobile: +91 98765-43210
Acme Corp (Jan 2019 - Present)
  `;

  console.log('--- Test: direct text parsing ---');
  console.log('Email:', rp.extractEmail(sampleText));
  console.log('Phone:', rp.extractPhone(sampleText));
  console.log('Name:', rp.extractName(sampleText));
  console.log('---------------------------------\n');

  // 2) If you have a sample PDF/DOCX, put file path here and uncomment the block below
  const samplePdf = path.join(__dirname, 'samples', 'sample_resume.pdf'); // create samples/sample_resume.pdf if you want
  if (fs.existsSync(samplePdf)) {
    console.log('--- Test: file parsing (PDF) ---');
    try {
      const txt = await rp.parseResume(samplePdf);
      console.log('Parsed length:', txt.length);
      console.log('Email:', rp.extractEmail(txt));
      console.log('Phone:', rp.extractPhone(txt));
      console.log('Name:', rp.extractName(txt));
    } catch (err) {
      console.error('File parse error:', err.message);
    }
    console.log('--------------------------------\n');
  } else {
    console.log(`Sample PDF not found at ${samplePdf}. Skip file test (create file to test).`);
  }

  console.log('All done.');
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
