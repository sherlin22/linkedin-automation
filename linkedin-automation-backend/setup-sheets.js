// setup-sheets.js - Initialize Google Sheets
require('dotenv').config();
const { initializeSheets, ensureHeaders } = require('./api/sheets-logger');

(async () => {
  console.log('\n📋 INITIALIZING GOOGLE SHEETS');
  console.log('='.repeat(50));

  const success = await initializeSheets();
  
  if (success) {
    console.log('\n🔤 Setting up headers...');
    await ensureHeaders();
    console.log('\n✅ Google Sheets initialized successfully!');
    console.log('\n🚀 You can now start the server:');
    console.log('   npm start');
  } else {
    console.log('\n❌ Failed to initialize Sheets');
    console.log('Make sure:');
    console.log('  1. google_token.json exists');
    console.log('  2. GOOGLE_SHEET_ID is set in .env');
    console.log('  3. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set');
  }
})();
