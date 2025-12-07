const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function exchangeCode() {
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.error('❌ Please provide auth code as argument');
    console.error('Usage: node exchange_oauth_code.js <AUTH_CODE>');
    process.exit(1);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(authCode);

    console.log('✅ Tokens received!');
    console.log('📝 Token details:');
    console.log(`   Access Token: ${tokens.access_token.substring(0, 30)}...`);
    console.log(`   Token Type: ${tokens.type}`);
    console.log(`   Expiry: ${new Date(tokens.expiry_date).toLocaleString()}`);
    
    if (tokens.refresh_token) {
      console.log(`   ✓ Refresh Token: ${tokens.refresh_token.substring(0, 30)}...`);
    }

    // Save tokens
    fs.writeFileSync('google_token.json', JSON.stringify(tokens, null, 2));
    console.log('\n✅ Token saved to google_token.json');
    
    console.log('\n🧪 Testing token access...');
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    
    console.log('✅ Token is valid and working!');
    console.log('   Drive access confirmed\n');
    
    console.log('🎉 You can now run:');
    console.log('   node scripts/step9_complete_resume_workflow.js --confirm=true\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exchangeCode();
