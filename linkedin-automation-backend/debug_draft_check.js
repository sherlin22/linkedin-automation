const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

async function checkDraft() {
  console.log('Loading credentials...');
  const tokenData = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );
  
  oauth2Client.setCredentials(tokenData);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Check first Salu Balan draft
  console.log('\n=== Checking draft: r7015999581989003896 ===');
  try {
    const result = await gmail.users.drafts.get({
      userId: 'me',
      id: 'r7015999581989003896'
    });
    console.log('Draft EXISTS - snippet:', result.data.message?.snippet?.substring(0, 100));
  } catch (e) {
    console.log('Draft NOT found - Status:', e.response?.status);
    if (e.response?.status === 404) {
      console.log('This means the draft was SENT or DELETED');
    }
  }
  
  console.log('\n=== Checking second draft: r-3785987203951928978 ===');
  try {
    const result = await gmail.users.drafts.get({
      userId: 'me',
      id: 'r-3785987203951928978'
    });
    console.log('Draft EXISTS - snippet:', result.data.message?.snippet?.substring(0, 100));
  } catch (e) {
    console.log('Draft NOT found - Status:', e.response?.status);
  }
  
  // Also check SENT messages for salubalan
  console.log('\n=== Checking SENT messages for salubalan ===');
  const sent = await gmail.users.messages.list({
    userId: 'me',
    q: 'to:salubalan@gmail.com',
    maxResults: 5
  });
  console.log('Sent messages count:', sent.data.resultSizeEstimate);
  
  if (sent.data.messages) {
    for (const m of sent.data.messages) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: m.id });
      const headers = msg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value;
      const date = headers.find(h => h.name === 'Date')?.value;
      console.log('  - Subject:', subject, '| Date:', date);
    }
  }
}

checkDraft().catch(console.error);

