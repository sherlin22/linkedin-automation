// scripts/test_google_apis.js
// Test script to verify Google Drive and Gmail credentials

require('dotenv').config();
const { testDriveConnection } = require('./helpers/google_drive');
const { testGmailConnection } = require('./helpers/gmail_draft');

async function runTests() {
  console.log('🧪 TESTING GOOGLE APIS\n');
  console.log('='.repeat(60));
  
  // Test 1: Check environment variables
  console.log('\n📋 Step 1: Checking Environment Variables');
  console.log('-'.repeat(60));
  
  const hasServiceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google_service_account.json';
  const fs = require('fs');
  
  if (fs.existsSync(hasServiceAccountFile)) {
    console.log(`✅ Service account file found: ${hasServiceAccountFile}`);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('✅ GOOGLE_SERVICE_ACCOUNT_KEY environment variable found');
  } else if (fs.existsSync('token.json')) {
    console.log('✅ OAuth token.json file found');
  } else {
    console.log('❌ No credentials found!');
    console.log('   Expected one of:');
    console.log('   - google_service_account.json file');
    console.log('   - GOOGLE_SERVICE_ACCOUNT_KEY env var');
    console.log('   - token.json (OAuth)');
    process.exit(1);
  }
  
  if (process.env.OPENAI_API_KEY) {
    console.log('✅ OPENAI_API_KEY found');
  } else {
    console.log('⚠️  OPENAI_API_KEY not found (needed for resume critiques)');
  }
  
  // Test 2: Google Drive
  console.log('\n📁 Step 2: Testing Google Drive Connection');
  console.log('-'.repeat(60));
  const driveSuccess = await testDriveConnection();
  
  // Test 3: Gmail
  console.log('\n📧 Step 3: Testing Gmail Connection');
  console.log('-'.repeat(60));
  const gmailSuccess = await testGmailConnection();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Google Drive: ${driveSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Gmail:        ${gmailSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (driveSuccess && gmailSuccess) {
    console.log('\n🎉 All tests passed! Your system is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    
    if (!gmailSuccess) {
      console.log('\n💡 Gmail Troubleshooting:');
      console.log('   Service accounts need "domain-wide delegation" for Gmail.');
      console.log('   Easiest solution: Use OAuth instead');
      console.log('   Run: python3 linkedin_automation.py');
      console.log('   This will create token.json for OAuth');
    }
  }
}

runTests().catch(console.error);