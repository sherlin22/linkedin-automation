// scripts/setup_oauth.js - OAUTH SETUP FOR GOOGLE DRIVE
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
require('dotenv').config();

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send'
];

/**
 * Set up OAuth2 authentication for Google Drive
 * This creates google_token.json with refresh token for persistent access
 */
async function setupOAuth() {
  console.log('\n🔑 GOOGLE OAUTH SETUP');
  console.log('='.repeat(60));
  
  // Get credentials from .env
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
  
  // Validate credentials
  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials in .env file');
    console.error('\nRequired .env variables:');
    console.error('   GOOGLE_CLIENT_ID=your_client_id');
    console.error('   GOOGLE_CLIENT_SECRET=your_client_secret');
    console.error('   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback');
    console.error('\n📝 How to get credentials:');
    console.error('   1. Go to: https://console.cloud.google.com/');
    console.error('   2. Create OAuth 2.0 Credentials (Desktop app)');
    console.error('   3. Download as JSON and copy values to .env');
    process.exit(1);
  }
  
  console.log('✓ Credentials loaded from .env');
  console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`   Redirect URI: ${redirectUri}`);
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  
  console.log('\n🌐 Opening browser for authorization...');
  console.log('   If browser doesn\'t open, visit:');
  console.log(`   ${authUrl}\n`);
  
  // Open browser
  const open = require('open');
  await open(authUrl).catch(() => {
    console.log('   ℹ️  Manual authorization required');
  });
  
  // Start local server to receive callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const queryUrl = url.parse(req.url, true);
      const code = queryUrl.query.code;
      const error = queryUrl.query.error;
      
      if (error) {
        console.error(`\n❌ Authorization error: ${error}`);
        res.end('Authorization failed. You can close this window.');
        server.close();
        reject(new Error(`Authorization error: ${error}`));
        return;
      }
      
      if (!code) {
        res.end('Waiting for authorization...');
        return;
      }
      
      try {
        console.log('✓ Authorization code received');
        console.log('📝 Exchanging code for tokens...');
        
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('✓ Tokens received');
        
        // Save tokens
        const tokenPath = path.join(process.cwd(), 'google_token.json');
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        
        console.log(`✅ Token saved to: ${tokenPath}`);
        console.log('\n📊 Token details:');
        console.log(`   Access Token: ${tokens.access_token.substring(0, 30)}...`);
        console.log(`   Token Type: ${tokens.type}`);
        console.log(`   Expiry: ${new Date(tokens.expiry_date).toLocaleString()}`);
        
        if (tokens.refresh_token) {
          console.log(`   ✓ Refresh Token: ${tokens.refresh_token.substring(0, 30)}...`);
        }
        
        res.end('✅ Authorization successful! You can close this window.');
        server.close();
        resolve(tokens);
        
      } catch (error) {
        console.error(`❌ Token exchange failed: ${error.message}`);
        res.end('Token exchange failed. Please try again.');
        server.close();
        reject(error);
      }
    });
    
    server.listen(3000, () => {
      console.log('✓ Local server listening on http://localhost:3000');
      console.log('   Waiting for authorization callback...\n');
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Test the OAuth token
 */
async function testOAuthToken() {
  try {
    if (!fs.existsSync('google_token.json')) {
      console.error('❌ Token file not found');
      return false;
    }
    
    const tokenData = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );
    
    oauth2Client.setCredentials(tokenData);
    
    // Try to list Drive files to verify token works
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    
    console.log('✅ Token is valid and working');
    console.log(`   Drive access confirmed`);
    return true;
    
  } catch (error) {
    console.error(`❌ Token test failed: ${error.message}`);
    return false;
  }
}

/**
 * Main
 */
(async () => {
  try {
    // Check if token already exists
    if (fs.existsSync('google_token.json')) {
      console.log('📄 google_token.json already exists');
      console.log('   Testing token...');
      
      const isValid = await testOAuthToken();
      if (isValid) {
        console.log('\n✅ You\'re all set! Ready to upload resumes.\n');
        process.exit(0);
      } else {
        console.log('\n⚠️  Token is invalid. Re-authenticating...\n');
      }
    }
    
    // Perform OAuth setup
    await setupOAuth();
    
    // Test the token
    console.log('\n🧪 Testing token...');
    await testOAuthToken();
    
    console.log('\n✅ Setup complete! Ready to upload resumes to Google Drive');
    console.log('\nNext steps:');
    console.log('   1. Run Step 9: node scripts/step9_complete_resume_workflow.js --confirm=true');
    console.log('   2. Resumes will auto-upload to Google Drive');
    console.log('   3. Check: LinkedIn_Automation/Resumes/Readable/ in Drive\n');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
})();