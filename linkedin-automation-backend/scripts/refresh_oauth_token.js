// scripts/refresh_oauth_token.js - Refresh expired OAuth token
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function refreshOAuthToken() {
  console.log('\n🔄 REFRESHING OAUTH TOKEN\n');
  console.log('═'.repeat(60));
  
  try {
    // Check token file exists
    if (!fs.existsSync('google_token.json')) {
      console.log('❌ google_token.json not found');
      console.log('   Run: node scripts/setup_oauth.js first\n');
      return false;
    }
    
    // Read current token
    const tokenData = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));
    console.log('✅ Token file loaded');
    
    // Check if refresh token exists
    if (!tokenData.refresh_token) {
      console.log('❌ No refresh token found in google_token.json');
      console.log('   This means the token cannot be auto-refreshed');
      console.log('   Solution: Run node scripts/setup_oauth.js to re-authenticate\n');
      return false;
    }
    
    console.log('📋 Token Status:');
    console.log(`   Refresh Token: ${tokenData.refresh_token.substring(0, 30)}...`);
    
    if (tokenData.expiry_date) {
      const expiryDate = new Date(tokenData.expiry_date);
      console.log(`   Expires: ${expiryDate.toLocaleString()}`);
      console.log(`   Status: ${new Date() > expiryDate ? '❌ EXPIRED' : '✅ Still valid'}`);
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );
    
    oauth2Client.setCredentials(tokenData);
    
    // Manually refresh token
    console.log('\n📡 Refreshing token with Google...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('✅ Token refreshed successfully!');
    console.log(`   New Access Token: ${credentials.access_token.substring(0, 30)}...`);
    
    // Save updated token
    fs.writeFileSync('google_token.json', JSON.stringify(credentials, null, 2));
    console.log('💾 Updated google_token.json\n');
    
    // Test the new token
    console.log('🧪 Testing new token with Drive API...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    
    console.log('✅ Drive API test successful!');
    console.log(`   Accessible files: ${response.data.files?.length || 0}\n`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Token refresh failed: ${error.message}\n`);
    
    if (error.message.includes('invalid_grant')) {
      console.log('💡 The refresh token itself is invalid or revoked');
      console.log('   Solutions:');
      console.log('   1. Re-authenticate:');
      console.log('      node scripts/setup_oauth.js\n');
      console.log('   2. Revoke access and try again:');
      console.log('      https://myaccount.google.com/permissions\n');
    } else if (error.message.includes('Access Denied')) {
      console.log('💡 OAuth credentials in .env might be incorrect');
      console.log('   Check: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET\n');
    }
    
    return false;
  }
}

async function quickDiagnosis() {
  console.log('\n📊 QUICK OAUTH DIAGNOSIS\n');
  console.log('═'.repeat(60));
  
  // Check .env
  console.log('1. Environment Variables:');
  console.log(`   ✅ GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set' : '❌ MISSING'}`);
  console.log(`   ✅ GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'Set' : '❌ MISSING'}`);
  console.log(`   ✅ GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? 'Set' : 'Using default (localhost:3000)'}`);
  
  // Check token file
  console.log('\n2. Token File:');
  if (fs.existsSync('google_token.json')) {
    const token = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));
    console.log(`   ✅ google_token.json exists`);
    console.log(`   ✅ Access Token: ${token.access_token ? 'Present' : '❌ Missing'}`);
    console.log(`   ✅ Refresh Token: ${token.refresh_token ? 'Present' : '❌ Missing'}`);
    
    if (token.expiry_date) {
      const isExpired = new Date() > new Date(token.expiry_date);
      console.log(`   ${isExpired ? '❌' : '✅'} Expiry: ${new Date(token.expiry_date).toLocaleString()}`);
    }
  } else {
    console.log(`   ❌ google_token.json NOT FOUND`);
    console.log(`      Run: node scripts/setup_oauth.js`);
  }
  
  // Check backup
  console.log('\n3. Backup:');
  if (fs.existsSync('google_token.json.backup')) {
    console.log(`   ✅ Backup exists: google_token.json.backup`);
  } else {
    console.log(`   ℹ️  No backup found`);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         🔐 OAUTH TOKEN REFRESH & DIAGNOSIS                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Run diagnosis first
  await quickDiagnosis();
  
  // Check if we should refresh
  console.log('\n' + '═'.repeat(60));
  
  if (!fs.existsSync('google_token.json')) {
    console.log('\n⚠️  SOLUTION: Need to authenticate first');
    console.log('   Run: node scripts/setup_oauth.js\n');
    process.exit(1);
  }
  
  // Try to refresh
  const success = await refreshOAuthToken();
  
  if (success) {
    console.log('═'.repeat(60));
    console.log('✅ OAUTH READY! You can now run Step 9:\n');
    console.log('   node scripts/step9_complete_resume_workflow.js --confirm=true --max=10\n');
  } else {
    console.log('═'.repeat(60));
    console.log('❌ OAUTH NEEDS RE-AUTHENTICATION\n');
    console.log('   Run: node scripts/setup_oauth.js\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});