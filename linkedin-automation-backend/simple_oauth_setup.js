const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

async function setupOAuth() {
  console.log('\n🔑 GOOGLE OAUTH SETUP');
  console.log('='.repeat(60));
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    process.exit(1);
  }
  
  console.log('✓ Credentials loaded from .env');
  
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  
  console.log('\n🌐 Visit this URL in your browser:');
  console.log(`\n${authUrl}\n`);
  console.log('Then copy the authorization code from the redirect URL');
  console.log('(look for: code=XXXXX in the URL bar after you authorize)\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('📝 Paste the authorization code here: ', async (code) => {
    rl.close();
    
    if (!code || code.length < 10) {
      console.error('❌ Invalid code provided');
      process.exit(1);
    }
    
    try {
      console.log('\n🔄 Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log('✅ Tokens received!');
      console.log('📝 Token details:');
      console.log(`   Access Token: ${tokens.access_token.substring(0, 30)}...`);
      console.log(`   Token Type: ${tokens.type}`);
      console.log(`   Expiry: ${new Date(tokens.expiry_date).toLocaleString()}`);
      
      if (tokens.refresh_token) {
        console.log(`   ✓ Refresh Token: ${tokens.refresh_token.substring(0, 30)}...`);
      }
      
      fs.writeFileSync('google_token.json', JSON.stringify(tokens, null, 2));
      console.log('\n✅ Token saved to google_token.json');
      
      console.log('\n🧪 Testing token access...');
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)'
      });
      
      console.log('✅ Token is valid and working!');
      console.log('   Drive access confirmed\n');
      
      console.log('🎉 Setup complete! You can now run:');
      console.log('   node scripts/step9_complete_resume_workflow.js --confirm=true\n');
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      if (error.message.includes('invalid_grant')) {
        console.error('\n⚠️  The code expired. Please try again with a fresh code.');
      }
      process.exit(1);
    }
  });
}

setupOAuth();