// scripts/helpers/google_drive.js - FULLY FIXED VERSION
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Upload file to Google Drive
 * PRIORITY: OAuth (google_token.json) > Service Account File > Service Account Env Var
 */
async function uploadToGoogleDrive(filePath, fileName, clientName = null, isReadable = true) {
  try {
    console.log('🔍 Checking Google Drive credentials...');
    
    // PRIORITY 1: OAuth with google_token.json (uses YOUR Google Drive storage)
    if (fs.existsSync('google_token.json')) {
      console.log('   📄 Using OAuth google_token.json (recommended)');
      return await uploadWithOAuth(filePath, fileName, clientName, isReadable, 'google_token.json');
    }
    
    // PRIORITY 1b: Fallback to token.json (old naming convention)
    if (fs.existsSync('token.json')) {
      console.log('   📄 Using OAuth token.json');
      return await uploadWithOAuth(filePath, fileName, clientName, isReadable, 'token.json');
    }
    
    // PRIORITY 2: Service account file (will fail due to quota)
    const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google_service_account.json';
    if (fs.existsSync(serviceAccountFile)) {
      console.log(`   ⚠️  Using service account (may have storage quota issues)`);
      console.log('   💡 Tip: Run "node scripts/setup_oauth.js" to use OAuth instead');
      return await uploadWithServiceAccount(filePath, fileName, clientName, isReadable, serviceAccountFile);
    }
    
    // PRIORITY 3: Service account from env var (will fail due to quota)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('   ⚠️  Using service account from env var (may have storage quota issues)');
      return await uploadWithServiceAccountEnv(filePath, fileName, clientName, isReadable);
    }
    
    // No credentials found
    console.log('⚠️  No Google Drive credentials found');
    console.log('   📝 Missing: google_token.json');
    console.log('   Run: node scripts/setup_oauth.js');
    return {
      success: false,
      skipped: true,
      message: 'No Drive credentials configured. Run setup_oauth.js'
    };
    
  } catch (error) {
    console.error('❌ Google Drive upload error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload using OAuth (RECOMMENDED - uses your personal Drive storage)
 * FIX: Properly handles token file reading and credential setup
 */
async function uploadWithOAuth(filePath, fileName, clientName, isReadable, tokenFile = 'google_token.json') {
  try {
    // CRITICAL FIX: Read token file properly
    if (!fs.existsSync(tokenFile)) {
      throw new Error(`Token file not found: ${tokenFile}`);
    }
    
    let tokenData;
    try {
      tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    } catch (e) {
      throw new Error(`Invalid token file ${tokenFile}: ${e.message}`);
    }
    
    // Verify token has required fields
    if (!tokenData.access_token) {
      throw new Error(`Token missing access_token. Please run setup_oauth.js again`);
    }
    
    // Get credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials(tokenData);
    
    // Handle token refresh
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        tokenData.refresh_token = tokens.refresh_token;
      }
      tokenData.access_token = tokens.access_token;
      if (tokens.expiry_date) {
        tokenData.expiry_date = tokens.expiry_date;
      }
      try {
        fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));
      } catch (e) {
        console.warn('⚠️  Failed to save updated token:', e.message);
      }
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    return await uploadToDrive(drive, filePath, fileName, clientName, isReadable);
    
  } catch (error) {
    console.error(`❌ OAuth upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      hint: 'Run: node scripts/setup_oauth.js'
    };
  }
}

/**
 * Upload using service account file
 */
async function uploadWithServiceAccount(filePath, fileName, clientName, isReadable, serviceAccountFile) {
  try {
    const credentials = JSON.parse(fs.readFileSync(serviceAccountFile, 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    return await uploadToDrive(drive, filePath, fileName, clientName, isReadable);
    
  } catch (error) {
    if (error.message.includes('storage quota')) {
      console.error('   💡 Service accounts have no storage. Use OAuth instead:');
      console.error('      node scripts/setup_oauth.js');
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload using service account from env var
 */
async function uploadWithServiceAccountEnv(filePath, fileName, clientName, isReadable) {
  try {
    let keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim();
    
    // Handle quoted strings
    if ((keyString.startsWith("'") && keyString.endsWith("'")) ||
        (keyString.startsWith('"') && keyString.endsWith('"'))) {
      keyString = keyString.slice(1, -1);
    }
    
    const credentials = JSON.parse(keyString);
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    return await uploadToDrive(drive, filePath, fileName, clientName, isReadable);
    
  } catch (error) {
    if (error.message.includes('storage quota')) {
      console.error('   💡 Service accounts have no storage. Use OAuth instead:');
      console.error('      node scripts/setup_oauth.js');
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Common upload logic for all auth methods
 * FIX: Creates Unreadable folder correctly
 */
async function uploadToDrive(drive, filePath, fileName, clientName, isReadable) {
  try {
    console.log('📁 Creating folder structure...');
    
    // Create folder structure: LinkedIn_Automation/Resumes/Readable or Unreadable/YYYY-MM-DD/
    const today = new Date().toISOString().split('T')[0];
    
    let rootFolderId = await findOrCreateFolder(drive, 'LinkedIn_Automation', null);
    console.log(`   ✓ Root folder: LinkedIn_Automation`);
    
    let resumesFolderId = await findOrCreateFolder(drive, 'Resumes', rootFolderId);
    console.log(`   ✓ Resumes folder`);
    
    // ✅ FIX: Handle both Readable and Unreadable properly
    const categoryFolder = isReadable ? 'Readable' : 'Unreadable';
    let categoryFolderId = await findOrCreateFolder(drive, categoryFolder, resumesFolderId);
    console.log(`   ✓ ${categoryFolder} folder`);
    
    let dateFolderId = await findOrCreateFolder(drive, today, categoryFolderId);
    console.log(`   ✓ Date folder: ${today}`);
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }
    
    console.log('📤 Uploading file to Drive...');
    
    const fileMetadata = {
      name: fileName,
      parents: [dateFolderId]
    };
    
    const media = {
      mimeType: getMimeType(path.extname(fileName)),
      body: fs.createReadStream(filePath)
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, mimeType, size'
    });
    
    const file = response.data;
    
    console.log(`✅ Uploaded to Drive: ${file.id}`);
    console.log(`📍 Folder path: LinkedIn_Automation/Resumes/${categoryFolder}/${today}/`);
    console.log(`🔗 Link: ${file.webViewLink}`);
    
    return {
      success: true,
      driveFileId: file.id,
      driveLink: file.webViewLink,
      driveFolderId: dateFolderId,
      driveMimeType: file.mimeType,
      driveCategory: categoryFolder,
      driveDate: today,
      driveFolderPath: `LinkedIn_Automation/Resumes/${categoryFolder}/${today}`,
      uploadedSize: file.size
    };
    
  } catch (error) {
    console.error(`❌ Upload to Drive failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find or create a folder in Google Drive
 * ✅ FIX: Handles both Readable and Unreadable folders properly
 */
async function findOrCreateFolder(drive, folderName, parentId) {
  try {
    // Build query
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 10
    });
    
    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }
    
    // Create new folder
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    
    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    
    console.log(`   📁 Created folder: ${folderName}`);
    return folder.data.id;
    
  } catch (error) {
    throw new Error(`Failed to find/create folder ${folderName}: ${error.message}`);
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  uploadToGoogleDrive
};