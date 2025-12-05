const path = require('path');
require('dotenv').config();
const fs = require('fs');
const googleServices = require('./helpers/google-services');

// load credentials JSON from project root
const credsPath = path.join(__dirname, '../google_credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error('❌ Missing google_credentials.json in project root.');
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

// initialize auth (this will use your service account)
googleServices.initializeAuth(creds);

(async () => {
  try {
    // Create or get top-level folder LinkedIn_Automation
    const rootFolderId = await googleServices.getOrCreateFolder('LinkedIn_Automation', null);
    const dateFolderName = new Date().toISOString().slice(0, 10);
    const resumesFolderId = await googleServices.getOrCreateFolder(dateFolderName, rootFolderId);

    // create a small local file to upload
    const testFilePath = path.join(__dirname, 'hello.txt');
    fs.writeFileSync(testFilePath, 'Hello from LinkedIn automation test');

    // upload the file
    const uploaded = await googleServices.uploadToDrive(testFilePath, `test_upload_${Date.now()}.txt`, resumesFolderId);
    console.log('✅ Uploaded:', uploaded);

    // Optional: append to Google Sheet (replace ID if you want to test it)
const sheetId = process.env.GOOGLE_SHEET_ID;
if (!sheetId) {
  console.log('ℹ️  No GOOGLE_SHEET_ID found in env — skipping sheet append.');
} else {
  await googleServices.appendToSheet(sheetId, 'leads!A1', [
    new Date().toISOString(), 'test_thread', 'test_proposal', 'Test Candidate',
    'test@example.com', '2', uploaded.webViewLink || '', 'Critique snippet',
    '2000', '1500', 'sent', 'pending', 'draft_test', ''
  ]);
  console.log('✅ Row appended to Google Sheet');
}
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
})();
