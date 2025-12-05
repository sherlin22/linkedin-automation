require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const credsPath = path.join(__dirname, '../google_credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error('Missing google_credentials.json');
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

async function initAuth() {
  let authClient;
  if (creds.type === 'service_account') {
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    authClient = auth;
  } else {
    const cfg = creds.installed || creds.web;
    authClient = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, (cfg.redirect_uris && cfg.redirect_uris[0]) || null);
    const tokenPath = path.join(__dirname, '../google_token.json');
    if (!fs.existsSync(tokenPath)) { console.error('Missing google_token.json (run auth helper)'); process.exit(1); }
    const token = JSON.parse(fs.readFileSync(tokenPath,'utf8'));
    authClient.setCredentials(token);
  }
  return authClient;
}

(async () => {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) { console.error('Please export GOOGLE_SHEET_ID or set it in .env'); process.exit(1); }
  const auth = await initAuth();
  const sheets = google.sheets({version:'v4', auth});
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    console.log('Spreadsheet title:', meta.data.properties.title);
    console.log('Sheets:');
    meta.data.sheets.forEach(s => {
      console.log(' -', s.properties.sheetId, 'title:', s.properties.title);
    });
  } catch (err) {
    console.error('Failed to read spreadsheet metadata:', err);
  }
})();
