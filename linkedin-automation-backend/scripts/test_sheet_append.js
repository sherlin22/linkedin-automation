require('dotenv').config(); // safe: if dotenv not installed it's okay later
const path = require('path');
const fs = require('fs');
const googleServices = require('./helpers/google-services');

const credsPath = path.join(__dirname, '../google_credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error('Missing google_credentials.json in project root.');
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

// initialize auth (will use OAuth token if present)
googleServices.initializeAuth(creds);

(async () => {
  const sheetId = process.env.GOOGLE_SHEET_ID || 'MISSING';
  console.log('TEST: using GOOGLE_SHEET_ID =', sheetId);
  if (sheetId === 'MISSING') {
    console.error('Please export GOOGLE_SHEET_ID or add it to .env');
    process.exit(1);
  }

  try {
    // Append a single row for test
    const now = new Date().toISOString();
    await googleServices.appendToSheet(sheetId, 'Sheet1!A1', [
      now,
      'test_thread_id',
      'test_proposal_id',
      'Test Candidate',
      'test@example.com',
      '3',
      'https://drive.google.com/test-link',
      'Sample critique snippet',
      '3000',
      '2000',
      'sent',
      'pending',
      'draft_test',
      ''
    ]);
    console.log('✅ appendToSheet succeeded');
  } catch (err) {
    console.error('❌ appendToSheet failed:', err);
  }
})();
