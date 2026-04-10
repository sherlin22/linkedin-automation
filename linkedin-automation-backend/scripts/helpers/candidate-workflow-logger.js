// scripts/helpers/candidate-workflow-logger.js - FULLY FIXED
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

      const headers = [
        'Date',                           // A
        'Time',                           // B
        'Proposal Sent To',               // C
        'Proposal Status',                // D
        'Follow-up To',                   // E
        'Follow-up Status',               // F
        'Resume Downloaded',              // G
        'Resume Status',                  // H
        'Email ID',                       // I
        'Mail Drafted',                   // J
        'Draft Status',                   // K
        'Draft Type',                     // L
        'Draft Follow-up Sent',           // M
        'Draft Follow-up Status',         // N
        'Draft Follow-up Date',           // O
        'LinkedIn Thread ID',             // P
        'Notes'                           // Q
      ];

      const range = `'${this.sheetName}'!A1:Q1`;

      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: range
      });

      const existingHeaders = result.data.values?.[0] || [];

      if (existingHeaders.length === 0 || existingHeaders[0] !== 'Date') {
        console.log('📝 Setting up headers...');
        
        // ✅ CRITICAL: Clear ONLY columns A:Q to avoid issues with hidden data
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.sheetId,
          range: `'${this.sheetName}'!A:Q`
        });

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
        return this.candidateCache[cleanName];
      }

      // ✅ FIX: Search ONLY column C, not entire column
      const searchRange = `'${this.sheetName}'!C:C`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: searchRange
      });

      const rows = response.data.values || [];
      
      // Check if candidate already exists (row 1 is headers, start from row 2 = index 1)
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] && rows[i][0] && rows[i][0].trim() === cleanName) {
          const rowIndex = i + 1; // Google Sheets is 1-indexed
          this.candidateCache[cleanName] = rowIndex;
          console.log(`   ✅ Found existing row for "${cleanName}": ${rowIndex}`);
          return rowIndex;
        }
      }

      // ✅ CREATE NEW ROW - Use explicit range A2:Q to control width
      console.log(`   📝 Creating new row for "${cleanName}"...`);
      
      const now = new Date();
      const today = now.toLocaleDateString('en-GB', {
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
        today,              // A
        time,               // B
        cleanName,          // C
        '',                 // D
        '',                 // E
        '',                 // F
        '',                 // G
        '',                 // H
        '',                 // I
        '',                 // J
        '',                 // K
        '',                 // L
        '',                 // M
        '',                 // N
        '',                 // O
        '',                 // P
        ''                  // Q
      ];

      // ✅ CRITICAL FIX: Use A:A (single column) to append safely
      // This prevents Google Sheets from expanding the range unexpectedly
      const appendResponse = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `'${this.sheetName}'!A:A`, // Single column - safer for appending
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      const updatedRange = appendResponse.data.updates?.updatedRange;
      
      if (!updatedRange) {
        console.error('❌ No updatedRange in response');
        return null;
      }

      console.log(`   📝 Updated range: ${updatedRange}`);

      // ✅ FIX: Extract row number from range like 'Sheet1'!A2:A2
      const rangeMatch = updatedRange.match(/!A(\d+):/);
      
      if (!rangeMatch || !rangeMatch[1]) {
        console.error('❌ Failed to extract row number from range:', updatedRange);
        return null;
      }

      const rowIndex = parseInt(rangeMatch[1], 10);

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

      // Update C:D (Proposal Sent To + Proposal Status)
      const range = `'${this.sheetName}'!C${rowIndex}:D${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[candidateName.trim(), 'Success']]
        }
      });

      // Update thread ID in column P
      if (threadId) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `'${this.sheetName}'!P${rowIndex}`,
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

      const range = `'${this.sheetName}'!G${rowIndex}:J${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[candidateName.trim(), resumeStatus || 'Failed', emailId || '', mailDrafted]]
        }
      });

      console.log(`✅ Logged Resume Download: ${candidateName} (Row ${rowIndex})`);
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

  async logDraftFollowup(candidateName, draftType = 'Auto', status = 'Success') {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      const now = new Date();
      const followupDate = now.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const followupTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const followupDateTime = `${followupDate} ${followupTime}`;

      // Update L:O (Draft Type, Follow-up Sent, Status, Date)
      const range = `'${this.sheetName}'!L${rowIndex}:O${rowIndex}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[draftType, 'Yes', status, followupDateTime]]
        }
      });

      console.log(`✅ Logged Draft Follow-up: ${candidateName} (Row ${rowIndex})`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Draft follow-up log failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async addNote(candidateName, note) {
    try {
      if (!this.isInitialized) throw new Error('Logger not initialized');

      const rowIndex = await this.findOrCreateCandidateRow(candidateName);
      if (!rowIndex) throw new Error('Could not find/create row');

      const range = `'${this.sheetName}'!Q${rowIndex}`;
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

      return (response.data.values || []).length - 1;
    } catch (error) {
      console.error('❌ Failed to get row count:', error.message);
      return 0;
    }
  }
}

module.exports = { CandidateWorkflowLogger };