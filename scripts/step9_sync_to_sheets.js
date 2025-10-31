/**
 * step9_sync_to_sheets.js
 * Pushes sent/drafted LinkedIn messages from requests_log.json to Google Sheets.
 *
 * Prerequisites:
 * - Google API credentials set up (from Phase 1)
 * - .env file containing GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY
 *
 * Usage:
 *   node step9_sync_to_sheets.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '..', 'data', 'requests_log.json');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SHEET_ID || !EMAIL || !PRIVATE_KEY) {
  console.error('Missing Google Sheet credentials in .env');
  process.exit(1);
}

(async () => {
  console.log('Connecting to Google Sheets...');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  if (!fs.existsSync(LOG_PATH)) {
    console.error('requests_log.json not found');
    process.exit(1);
  }

  let logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8') || '[]');
  let unsynced = logs.filter(x => (x.status === 'sent' || x.status === 'drafted') && !x.synced);

  if (unsynced.length === 0) {
    console.log('No new entries to sync.');
    process.exit(0);
  }

  console.log(`Found ${unsynced.length} unsynced entries.`);

// Map entries to sheet columns.
// Final column order in the sheet will be:
// name, email, linkedinUrl, Status, CreatedAt, SentAt, ThreadURL, ProposalPath, BeforeScreenshot, AfterScreenshot, SyncedAt

const values = unsynced.map(entry => [
  entry.name || 'N/A',                           // name
  entry.email || '',                             // email (may be empty)
  entry.linkedinUrl || entry.threadUrl || '',    // linkedinUrl (fallback to threadUrl if needed)
  entry.status || 'N/A',                         // Status
  entry.notes || '',
  entry.timestamp || '',                         // CreatedAt
  entry.sentAt || entry.updatedAt || '',        // SentAt
  entry.threadUrl || '',                         // ThreadURL
  entry.proposalPath || '',                      // ProposalPath (path to saved draft/proposal)
  entry.debugBefore || '',                       // BeforeScreenshot
  entry.debugAfter || '',                        // AfterScreenshot
  new Date().toISOString()                       // SyncedAt
]);

const header = [ 'name', 'email', 'linkedinUrl', 'Status', 'notes', 'CreatedAt', 'SentAt', 'ThreadURL', 'ProposalPath', 'BeforeScreenshot', 'AfterScreenshot', 'SyncedAt'];

  try {
    console.log('Appending data to Google Sheet...');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "'LinkedIn Leads'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [header, ...values] },
    });
    console.log(' Data successfully synced to Google Sheet.');

    // mark entries as synced
    for (const e of unsynced) e.synced = true;
    fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf8');
    console.log(' Local log updated with synced=true flags.');
  } catch (err) {
    console.error(' Failed to sync data:', err.message);
  }
})();
