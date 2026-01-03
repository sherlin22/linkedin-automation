// api/sheets-logger.js - FIXED VERSION (handles sheet name correctly)
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let sheets = null;
let sheetId = null;
let sheetName = 'Sheet1'; // Default sheet name
let isInitialized = false;

async function initializeSheets() {
  try {
    console.log('🔍 Initializing Google Sheets...');
    
    const tokenPath = path.join(process.cwd(), 'google_token.json');
    console.log(`📁 Looking for token at: ${tokenPath}`);
    
    if (!fs.existsSync(tokenPath)) {
      console.warn('⚠️  google_token.json not found');
      return false;
    }

    console.log('✅ Token file found');
    
    let tokenData;
    try {
      const tokenContent = fs.readFileSync(tokenPath, 'utf8');
      tokenData = JSON.parse(tokenContent);
      console.log('✅ Token parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse token:', parseError.message);
      return false;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
      console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
      return false;
    }

    console.log('✅ OAuth credentials found in .env');

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials(tokenData);

    console.log('✅ OAuth2 client created');

    sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    console.log('✅ Google Sheets API initialized');

    sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      console.error('❌ GOOGLE_SHEET_ID not set in .env');
      sheets = null;
      return false;
    }

    console.log(`✅ Sheet ID configured: ${sheetId.substring(0, 20)}...`);

    // GET THE ACTUAL SHEET NAME
    try {
      console.log('🔍 Fetching sheet metadata to get sheet name...');
      const response = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets(properties(sheetId,title))'
      });
      
      if (response.data.sheets && response.data.sheets.length > 0) {
        sheetName = response.data.sheets[0].properties.title;
        console.log(`✅ Found sheet name: "${sheetName}"`);
      }

      console.log(`✅ Successfully connected to sheet: "${sheetName}"`);
      isInitialized = true;
      return true;
    } catch (testError) {
      console.error('❌ Failed to connect to Google Sheet:', testError.message);
      sheets = null;
      return false;
    }
  } catch (error) {
    console.error('❌ Google Sheets initialization error:', error.message);
    return false;
  }
}

async function logEventToSheets(eventData) {
  try {
    if (!sheets || !sheetId || !isInitialized) {
      console.log('⏭️  Sheets not initialized - skipping log');
      return { success: false, message: 'Sheets not initialized' };
    }

    const timestamp = new Date();
    const isoTimestamp = timestamp.toISOString();
    const readableTime = timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const [date, time] = readableTime.split(', ');

    const row = [
      isoTimestamp,
      date,
      time,
      eventData.eventType || '',
      eventData.clientName || '',
      eventData.email || '',
      eventData.slot || '',
      eventData.status || 'pending',
      eventData.message || '',
      eventData.duration || '',
      eventData.itemsProcessed || '',
      eventData.threadId || '',
      eventData.fileName || '',
      eventData.notes || ''
    ];

    console.log(`📝 Appending to Sheets: ${eventData.eventType}`);

    // Use the actual sheet name in the range
    const range = `'${sheetName}'!A:N`;
    console.log(`   📊 Using range: ${range}`);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    });

    console.log(`✅ Event logged to Sheets: ${eventData.eventType}`);
    console.log(`   📊 Range: ${response.data.updates.updatedRange}`);
    
    return { 
      success: true, 
      range: response.data.updates.updatedRange,
      updatedCells: response.data.updates.updatedCells
    };
  } catch (error) {
    console.error('❌ Sheets logging error:', error.message);
    return { success: false, error: error.message };
  }
}

async function ensureHeaders() {
  try {
    if (!sheets || !sheetId || !isInitialized) {
      console.warn('⚠️  Sheets not initialized - cannot set headers');
      return false;
    }

    const headers = [
      'Timestamp', 'Date', 'Time', 'Event Type', 'Client Name', 'Email',
      'Slot', 'Status', 'Message', 'Duration (ms)', 'Items Processed',
      'Thread ID', 'File Name', 'Notes'
    ];

    console.log('🔤 Setting up headers...');

    // Use the actual sheet name in the range
    const range = `'${sheetName}'!A1:N1`;
    console.log(`   📊 Using range: ${range}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });

    console.log('✅ Sheet headers initialized');
    return true;
  } catch (error) {
    console.warn('⚠️  Could not initialize headers:', error.message);
    return false;
  }
}

module.exports = {
  initializeSheets,
  logEventToSheets,
  ensureHeaders,
  isInitialized: () => isInitialized
};