/**
 * Simple Gmail OAuth Setup
 * Uses port from .env (default 3000)
 * 
 * Usage: node scripts/simple_oauth_setup.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const open = require('open');
const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify'
];

async function setupOAuth() {
  console.log('\n' + '='.repeat(60));
  console.log('GMAIL OAUTH SETUP');
  console.log('='.repeat(60));

  // Verify credentials
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('\n❌ Missing credentials in .env');
    console.log('   Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    return;
  }

  console.log('\n✅ Credentials found');
  console.log(`   Redirect URI: http://localhost:${PORT}/oauth2callback`);

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${PORT}/oauth2callback`
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('\n🔐 Authorization URL generated');

  // Create simple server to handle callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (url.pathname === '/oauth2callback' && url.searchParams.has('code')) {
      const code = url.searchParams.get('code');
      
      try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        // Save tokens
        fs.writeFileSync('google_token.json', JSON.stringify(tokens, null, 2));
        
        console.log('\n✅ Token saved to google_token.json');
        
        res.end('✅ Authorization successful! You can close this window.');
        server.close();
        process.exit(0);
        
      } catch (error) {
        console.error('\n❌ Token exchange failed:', error.message);
        res.end('❌ Error: ' + error.message);
        server.close();
        process.exit(1);
      }
    } else {
      res.end('Invalid request');
    }
  });

  // Start server
  await new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`\n🌐 Server running on http://localhost:${PORT}`);
      console.log('\n📋 Next Steps:');
      console.log('   1. Opening browser for authorization...');
      console.log('   2. If browser doesn\'t open, copy this URL:');
      console.log('\n   ' + authUrl + '\n');
      resolve();
    });
  });

  // Open browser
  try {
    await open(authUrl);
    console.log('✅ Browser opened');
  } catch (error) {
    console.log('⚠️ Could not open browser automatically');
  }

  console.log('\n⏳ Waiting for authorization...');
  console.log('   (Complete the OAuth flow in your browser)');
}

setupOAuth().catch(console.error);

