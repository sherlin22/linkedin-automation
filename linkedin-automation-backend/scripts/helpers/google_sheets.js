// scripts/helpers/google_sheets.js
const { google } = require('googleapis');

/**
 * Log resume processing workflow to Google Sheets
 * Required columns:
 * timestamp, linkedin_thread_id, candidate_name, candidate_email, years_experience,
 * resume_price, linkedin_price, resume_drive_link, critique_snippet, drive_file_id,
 * email_draft_id, status, debug_artifacts_drive_links
 */
async function logToGoogleSheet(workflowResult) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!sheetId) {
      console.log('⚠️  GOOGLE_SHEET_ID not configured - skipping Sheets logging');
      return {
        success: false,
        skipped: true,
        message: 'Google Sheet ID not configured'
      };
    }
    
    // Check if service account credentials exist
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      console.log('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY not configured - skipping Sheets logging');
      return {
        success: false,
        skipped: true,
        message: 'Google Service Account not configured'
      };
    }
    
    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (e) {
      console.error('❌ Invalid GOOGLE_SERVICE_ACCOUNT_KEY format');
      return {
        success: false,
        error: 'Invalid service account credentials format'
      };
    }
    
    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Prepare row data
    const critiqueSnippet = workflowResult.resumeCritique 
      ? workflowResult.resumeCritique.substring(0, 200) + (workflowResult.resumeCritique.length > 200 ? '...' : '')
      : 'N/A';
    
    const status = workflowResult.stages.draftCreated ? 'SUCCESS' : 'FAILED';
    
    const debugLinks = workflowResult.debugArtifacts?.links 
      ? workflowResult.debugArtifacts.links.join(', ')
      : 'N/A';
    
    const row = [
      new Date().toISOString(),
      workflowResult.linkedinThreadId || 'N/A',
      workflowResult.clientName || 'N/A',
      workflowResult.clientEmail || 'N/A',
      workflowResult.yearsExperience !== null ? workflowResult.yearsExperience : 'N/A',
      workflowResult.pricing?.resume_price || 'N/A',
      workflowResult.pricing?.linkedin_price || 'N/A',
      workflowResult.driveInfo?.driveLink || 'N/A',
      critiqueSnippet,
      workflowResult.driveInfo?.driveFileId || 'N/A',
      workflowResult.draftInfo?.draftId || 'N/A',
      status,
      debugLinks
    ];
    
    // Append row to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:M', // Adjust sheet name if needed
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row]
      }
    });
    
    console.log(`✅ Logged to Google Sheets: ${workflowResult.clientName}`);
    
    return {
      success: true,
      sheetId: sheetId,
      row: row
    };
    
  } catch (error) {
    console.error('❌ Google Sheets logging error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize Google Sheet with headers (run once)
 */
async function initializeGoogleSheet() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID not configured');
    }
    
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }
    
    const credentials = JSON.parse(serviceAccountKey);
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const headers = [
      'timestamp',
      'linkedin_thread_id',
      'candidate_name',
      'candidate_email',
      'years_experience',
      'resume_price',
      'linkedin_price',
      'resume_drive_link',
      'critique_snippet',
      'drive_file_id',
      'email_draft_id',
      'status',
      'debug_artifacts_drive_links'
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:M1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });
    
    console.log('✅ Initialized Google Sheet with headers');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Google Sheet initialization error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  logToGoogleSheet,
  initializeGoogleSheet
};
