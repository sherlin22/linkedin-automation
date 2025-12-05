// scripts/check_services.js
// Check what services are available
const fs = require('fs');
const path = require('path');

console.log('🔍 SERVICE AVAILABILITY CHECK');
console.log('=============================\n');

// Check Google Service Account
const googleFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google_service_account.json';
if (fs.existsSync(googleFile)) {
  console.log('✅ Google Service Account: FOUND');
  const stats = fs.statSync(googleFile);
  console.log(`   File: ${googleFile}`);
  console.log(`   Size: ${Math.round(stats.size / 1024)} KB`);
  console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
} else {
  console.log('❌ Google Service Account: NOT FOUND');
  console.log('   Expected: google_service_account.json or file specified in GOOGLE_SERVICE_ACCOUNT_FILE');
}

console.log('');

// Check OpenAI API Key
if (process.env.OPENAI_API_KEY) {
  console.log('✅ OpenAI API Key: FOUND');
  const keyPreview = process.env.OPENAI_API_KEY.substring(0, 12) + '...' + process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4);
  console.log(`   Key: ${keyPreview}`);
} else {
  console.log('❌ OpenAI API Key: NOT FOUND');
  console.log('   Add OPENAI_API_KEY to your .env file');
}

console.log('');

// Check LinkedIn Auth
if (fs.existsSync('auth_state.json')) {
  console.log('✅ LinkedIn Auth: FOUND (auth_state.json)');
} else {
  console.log('❌ LinkedIn Auth: NOT FOUND');
}

console.log('');

// Check Resume Processing State
if (fs.existsSync('resume_processing_state.json')) {
  const state = JSON.parse(fs.readFileSync('resume_processing_state.json', 'utf8'));
  console.log(`✅ Resume State: ${state.processed?.length || 0} processed resumes`);
} else {
  console.log('✅ Resume State: No previous processing (fresh start)');
}

console.log('\n📊 SUMMARY:');
console.log('===========');

const services = {
  'Google Drive Uploads': fs.existsSync(googleFile),
  'OpenAI AI Critiques': !!process.env.OPENAI_API_KEY,
  'LinkedIn Automation': fs.existsSync('auth_state.json')
};

Object.entries(services).forEach(([service, available]) => {
  console.log(`   ${available ? '✅' : '❌'} ${service}: ${available ? 'READY' : 'NOT READY'}`);
});

console.log('\n💡 NEXT STEPS:');
if (!fs.existsSync(googleFile)) {
  console.log('   1. Copy google_service_account.json to project root');
}
if (!process.env.OPENAI_API_KEY) {
  console.log('   2. Add OPENAI_API_KEY to .env file');
}
if (Object.values(services).every(s => s)) {
  console.log('   🎉 ALL SERVICES READY! Run the automation script.');
}