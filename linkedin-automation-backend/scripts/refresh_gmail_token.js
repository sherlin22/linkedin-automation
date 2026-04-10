/**
 * Refresh Gmail OAuth Token
 * Fixes "invalid_client" error by refreshing the access token
 * 
 * Usage: node scripts/refresh_gmail_token.js
 */

const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function refreshToken() {
  console.log('\n' + '='.repeat(60));
  console.log('REFRESHING GMAIL OAUTH TOKEN');
  console.log('='.repeat(60));

  try {
    // Check required credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.log('\n❌ ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in .env');
      return { success: false };
    }

    console.log('\n✅ Credentials found in .env');

    // Check for existing token
    const tokenPath = 'google_token.json';
    if (!fs.existsSync(tokenPath)) {
      console.log('\n❌ google_token.json not found');
      console.log('   Need to run full OAuth setup');
      return { success: false };
    }

    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('\n✅ Existing token loaded');

    // Check if refresh token exists
    if (!tokenData.refresh_token) {
      console.log('\n❌ No refresh_token in google_token.json');
      console.log('   Need to re-authorize');
      console.log('\n📋 To fix:');
      console.log('   1. Delete google_token.json');
      console.log('   2. Run: node scripts/setup_oauth.js');
      console.log('   3. Complete OAuth flow in browser');
      return { success: false };
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    console.log('\n🔄 Refreshing access token...');

    // Refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Save refreshed token
    fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
    
    console.log('\n✅ Token refreshed successfully!');
    console.log('   New access token expires at:', new Date(credentials.expiry_date).toLocaleString());
    console.log('\n💾 Saved to: google_token.json');

    // Set credentials for immediate use
    oauth2Client.setCredentials(credentials);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TOKEN REFRESHED - Try creating draft again!');
    console.log('='.repeat(60));
    console.log('\n📌 Next step:');
    console.log('   node scripts/create_gmail_draft.js\n');

    return { success: true, credentials };

  } catch (error) {
    console.error('\n❌ Token refresh failed:', error.message);
    
    if (error.message.includes('invalid_client')) {
      console.log('\n📋 The OAuth client may have been deleted from Google Cloud Console');
      console.log('   To fix:');
      console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
      console.log('   2. Check if OAuth client exists');
      console.log('   3. If not, create new OAuth 2.0 credentials');
      console.log('   4. Update .env with new CLIENT_ID and CLIENT_SECRET');
      console.log('   5. Delete google_token.json');
      console.log('   6. Run: node scripts/setup_oauth.js');
    }
    
    return { success: false, error: error.message };
  }
}

refreshToken().catch(console.error);

