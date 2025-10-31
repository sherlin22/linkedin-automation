require('dotenv').config();
const { google } = require('googleapis');

async function main() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
  const sheetId = process.env.TEST_SHEET_ID;

  try {
    // Read header row (A1:E1)
    const read = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'leads!A1:E1' });
    console.log('Header row:', read.data.values ? read.data.values[0] : 'empty');

    // Append a test row to leads!A2 (this will add a new row)
    const append = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'leads!A2',
      valueInputOption: 'RAW',
      requestBody: { values: [['Test Name','test@example.com','https://linkedin.com/in/test','new','added-by-test']] }
    });
    console.log('Append HTTP status:', append.status);
  } catch (err) {
    console.error('Google Sheets error:', err.response ? err.response.data : err.message);
  }
}

main();
