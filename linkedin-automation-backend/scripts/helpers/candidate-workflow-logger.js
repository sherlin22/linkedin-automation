// scripts/helpers/candidate-workflow-logger.js - FIXED WITH TIME COLUMN
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class CandidateWorkflowLogger {
  constructor() {
    this.sheets = null;
    this.sheetId = null;
    this.sheetName = 'Sheet1';
    this.isInitialized = false;
    this.candidateCache = {};
  }

  async initialize() {
    try {
      console.log('🔍 Initializing Candidate Workflow Logger...');

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

      // ✅ UPDATED HEADERS WITH TIME COLUMN
      const headers = [
        'Date',                    // A
        'Time',                    // B ← NEW
        'Proposal Sent To',        // C
        'Proposal Status',         // D
        'Follow-up To',            // E
        'Follow-up Status',        // F
        'Resume Downloaded',       // G
        'Resume Status',           // H
        'Email ID',                // I
        'Mail Drafted',            // J
        'Draft Status',            // K
        'LinkedIn Thread ID',      // L
        'Notes'                    // M
      ];

      const range = `'${this.sheetName}'!A1:M1`;

      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      const existingHeaders = result.data.values?.[0] || [];

      if (existingHeaders.length === 0 || existingHeaders[0] !== 'Date') {
        console.log('📝 Setting up headers with TIME column...');
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.sheetId,
          range: `'${this.sheetName}'!A:M`
        });

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: range,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] }
        });
        console.log('✅ Headers created with TIME column');
      } else {
        console.log('✅ Headers already exist');
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to ensure headers:', error.message);
      return false;
    }
  }

  async findOrCreateCandidateRow(candidateName) {
    try {
      if (!this.isInitialized) {
        throw new Error('Logger not initialized');
      }

      if (!candidateName || typeof candidateName !== 'string') {
        console.error('❌ Invalid candidate name:', candidateName);
        return null;
      }

      const cleanName = candidateName.trim();

      // Check cache first
      if (this.candidateCache[cleanName]) {
        console.log(`   ✅ Using cached row for ${cleanName}: ${this.candidateCache[cleanName]}`);
        return this.candidateCache[cleanName];
      }

      // Search for existing row by reading column C (Proposal Sent To)
      const range = `'${this.sheetName}'!C:C`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      const rows = response.data.values || [];
      let rowIndex = -1;

      // Skip header (row 0), check from row 1 onwards
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] && rows[i][0] && rows[i][0].trim() === cleanName) {
          rowIndex = i + 1; // Google Sheets is 1-indexed
          this.candidateCache[cleanName] = rowIndex;
          console.log(`   ✅ Found existing row for "${cleanName}": ${rowIndex}`);
          return rowIndex;
        }
      }

      // Create new row with DATE and TIME
      console.log(`   📝 Creating new row for "${cleanName}"...`);
      
      const now = new Date();
      const today = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const newRow = [
        today,            // A - Date
        time,             // B - Time ← INCLUDES TIME NOW
        cleanName,        // C - Proposal Sent To
        '',               // D - Proposal Status
        '',               // E - Follow-up To
        '',               // F - Follow-up Status
        '',               // G - Resume Downloaded
        '',               // H - Resume Status
        '',               // I - Email ID
        '',               // J - Mail Drafted
        '',               // K - Draft Status
        '',               // L - LinkedIn Thread ID
        ''                // M - Notes
      ];

      const appendRange = `'${this.sheetName}'!A2:M`;
      const appendResponse = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: appendRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      const updatedRange = appendResponse.data.updates?.updatedRange;
      
      if (!updatedRange) {
        console.error('❌ No updatedRange in response:', appendResponse.data);
        return null;
      }

      console.log(`   📝 Updated range: ${updatedRange}`);

      // Parse range like: 'Sheet1'!A2:M2
      const rangeMatch = updatedRange.match(/!A(\d+):/);
      
      if (!rangeMatch || !rangeMatch[1]) {
        console.error('❌ Failed to extract row number from range:', updatedRange);
        return null;
      }

      rowIndex = parseInt(rangeMatch[1], 10);

      if (isNaN(rowIndex)) {
        console.error('❌ Invalid row index:', rangeMatch[1]);
        return null;
      }

      this.candidateCache[cleanName] = rowIndex;
      console.log(`   ✅ Created new row for "${cleanName}": ${rowIndex}`);
      return rowIndex;
    } catch (error) {
      console.error('❌ Failed to find/create row:', error.message);
      console.error('   Stack:', error.stack);
      return null;
    }
  }

  async logProposal(candidateName, threadId) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      // Update columns C:D (Proposal Sent To + Proposal Status)
      const range = `'${this.sheetName}'!C${rowIndex}:D${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[candidateName.trim(), 'Success']]
        }
      });

      // Update thread ID in column L
      if (threadId) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `'${this.sheetName}'!L${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[threadId]] }
        });
      }

      console.log(`✅ Logged Proposal: ${candidateName} (Row ${rowIndex})`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Proposal log failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async logFollowup(candidateName, threadId) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      // Update columns E:F (Follow-up To + Follow-up Status)
      const range = `'${this.sheetName}'!E${rowIndex}:F${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[candidateName.trim(), 'Success']]
        }
      });

      console.log(`✅ Logged Follow-up: ${candidateName} (Row ${rowIndex})`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Follow-up log failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async logResumeDownload(candidateName, resumeStatus, emailId, threadId) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      const isReadable = resumeStatus && resumeStatus.includes('Readable');
      const mailDrafted = isReadable ? 'Yes' : 'No';

      // Update columns G:J (Resume Downloaded, Resume Status, Email ID, Mail Drafted)
      const range = `'${this.sheetName}'!G${rowIndex}:J${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[candidateName.trim(), resumeStatus || 'Failed', emailId || '', mailDrafted]]
        }
      });

      console.log(`✅ Logged Resume Download: ${candidateName} (${resumeStatus}) (Row ${rowIndex})`);
      return { success: true, rowIndex, mailDrafted };
    } catch (error) {
      console.error('❌ Resume download log failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async logMailDraft(candidateName, draftStatus) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      // Update column K (Draft Status)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `'${this.sheetName}'!K${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[draftStatus || 'Success']] }
      });

      console.log(`✅ Logged Mail Draft: ${candidateName} (Row ${rowIndex})`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Mail draft log failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async addNote(candidateName, note) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      // Get existing notes from column M
      const range = `'${this.sheetName}'!M${rowIndex}`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      const existingNote = response.data.values?.[0]?.[0] || '';
      const updatedNote = existingNote ? `${existingNote}; ${note}` : note;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: { values: [[updatedNote]] }
      });

      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Note addition failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getRowCount() {
    try {
      if (!this.isInitialized) {
        throw new Error('Logger not initialized');
      }

      const range = `'${this.sheetName}'!A:A`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      return (response.data.values || []).length - 1; // Subtract header
    } catch (error) {
      console.error('❌ Failed to get row count:', error.message);
      return 0;
    }
  }
}

module.exports = { CandidateWorkflowLogger };