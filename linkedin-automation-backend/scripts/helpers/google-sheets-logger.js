// scripts/helpers/google-sheets-logger.js
// SIMPLE VERSION - Only logs essential data
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleSheetsLogger {
  constructor() {
    this.sheets = null;
    this.sheetId = null;
    this.sheetName = 'Sheet1';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔍 Initializing Google Sheets Logger...');

      const tokenPath = path.join(process.cwd(), 'google_token.json');

      if (!fs.existsSync(tokenPath)) {
        throw new Error('google_token.json not found');
      }

      let tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

      if (!clientId || !clientSecret) {
        throw new Error('Missing Google credentials');
      }

      this.sheetId = process.env.GOOGLE_SHEET_ID;
      if (!this.sheetId) {
        throw new Error('Missing GOOGLE_SHEET_ID');
      }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials(tokenData);

      oauth2Client.on('tokens', (tokens) => {
        tokenData.access_token = tokens.access_token;
        if (tokens.refresh_token) tokenData.refresh_token = tokens.refresh_token;
        if (tokens.expiry_date) tokenData.expiry_date = tokens.expiry_date;
        try {
          fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
        } catch (e) {
          console.warn('⚠️  Failed to save token');
        }
      });

      this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId,
        fields: 'sheets(properties(sheetId,title))'
      });

      if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
        this.sheetName = spreadsheet.data.sheets[0].properties.title;
      }

      this.isInitialized = true;
      console.log(`✅ Connected to Sheet: "${this.sheetName}"`);
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  async ensureHeaders() {
    try {
      if (!this.isInitialized) {
        throw new Error('Logger not initialized');
      }

      // SIMPLE HEADERS - Only what matters
      const headers = [
        'Date',
        'Time',
        'Event Type',
        'Client Name',
        'Email',
        'Status'
      ];

      const range = `'${this.sheetName}'!A1:F1`;

      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      const existingHeaders = result.data.values?.[0] || [];

      if (existingHeaders.length === 0 || existingHeaders[0] !== 'Date') {
        console.log('📝 Setting up headers...');
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: range,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] }
        });
        console.log('✅ Headers created');
      } else {
        console.log('✅ Headers already exist');
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to ensure headers:', error.message);
      return false;
    }
  }

  /**
   * Log event to Google Sheets - SIMPLE FORMAT
   */
  async logEvent(eventData) {
    try {
      if (!this.isInitialized) {
        throw new Error('Logger not initialized');
      }

      const timestamp = new Date();
      const readableDate = timestamp.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const readableTime = timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      // SIMPLE ROW - Only essential data
      const row = [
        readableDate,                           // Date
        readableTime,                           // Time
        eventData.eventType || '',              // Event Type
        eventData.clientName || '',             // Client Name
        eventData.email || '',                  // Email
        eventData.status || 'success'           // Status
      ];

      const range = `'${this.sheetName}'!A:F`;

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });

      console.log(`✅ Logged: ${eventData.eventType} - ${eventData.clientName}`);

      return {
        success: true,
        range: response.data.updates.updatedRange,
        updatedCells: response.data.updates.updatedCells
      };
    } catch (error) {
      console.error('❌ Failed to log event:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logProposal(clientName, email) {
    return await this.logEvent({
      eventType: 'Proposal Submitted',
      clientName,
      email,
      status: 'success'
    });
  }

  async logFollowup(clientName, email) {
    return await this.logEvent({
      eventType: 'Follow-up Sent',
      clientName,
      email,
      status: 'success'
    });
  }

  async logDownload(clientName, email) {
    return await this.logEvent({
      eventType: 'Resume Downloaded',
      clientName,
      email,
      status: 'success'
    });
  }

  async logDraft(clientName, email) {
    return await this.logEvent({
      eventType: 'Draft Created',
      clientName,
      email,
      status: 'success'
    });
  }

  async getRowCount() {
    try {
      if (!this.isInitialized) {
        throw new Error('Logger not initialized');
      }

      const range = `'${this.sheetName}'!A:F`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      return (response.data.values || []).length - 1;
    } catch (error) {
      console.error('❌ Failed to get row count:', error.message);
      return 0;
    }
  }
}

module.exports = { GoogleSheetsLogger };