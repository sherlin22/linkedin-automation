require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const credsPath = path.join(__dirname, '../google_credentials.json');
if (!fs.existsSync(credsPath)) { console.error('Missing google_credentials.json'); process.exit(1); }
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

async function initAuth() {
  if (creds.type === 'service_account') {
    return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  } else {
    const cfg = creds.installed || creds.web;
    const oauth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, (cfg.redirect_uris && cfg.redirect_uris[0]) || null);
    const tokenPath = path.join(__dirname, '../google_token.json');
    if (!fs.existsSync(tokenPath)) { console.error('Missing google_token.json'); process.exit(1); }
    const token = JSON.parse(fs.readFileSync(tokenPath,'utf8'));
    oauth2.setCredentials(token);
    return oauth2;
  }
}

(async () => {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) { console.error('Please export GOOGLE_SHEET_ID or set it in .env'); process.exit(1); }

  // Change this to the exact tab title printed by list_sheets.js
  const sheetTitle = 'leads';
  const needsQuoting = /[\\s'!@#\$%\^&\*\(\)\+\=\{\}\[\];:,<>?\/\\|`~]/.test(sheetTitle);
  const range = needsQuoting ? `\'${sheetTitle}\'!A1` : `${sheetTitle}!A1`;

  const auth = await initAuth();
  const sheets = google.sheets({version:'v4', auth});
  try {
    const now = new Date().toISOString();
    const values = [[ now, 'test_thread', 'test_proposal', 'Candidate X' ]];
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
    console.log('Append response status:', res.status, 'updatedRange:', res.data.updates && res.data.updates.updatedRange);
  } catch (err) {
    console.error('Append failed:', err);
  }
})();
