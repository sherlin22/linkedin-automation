// scripts/share_drive_folder.js
// Automatically share the Drive folder with your service account
const { google } = require('googleapis');
const fs = require('fs');

async function shareDriveFolder() {
  try {
    console.log('🔐 DRIVE FOLDER SHARING SETUP');
    console.log('='.repeat(60));
    
    // Load service account credentials
    const serviceAccountFile = 'google_service_account.json';
    
    if (!fs.existsSync(serviceAccountFile)) {
      console.error('❌ google_service_account.json not found!');
      console.log('\n💡 Make sure the file exists in your project root');
      process.exit(1);
    }
    
    const credentials = JSON.parse(fs.readFileSync(serviceAccountFile, 'utf8'));
    const serviceAccountEmail = credentials.client_email;
    
    console.log(`\n📧 Service Account: ${serviceAccountEmail}`);
    
    // Load drive config
    if (!fs.existsSync('drive_config.json')) {
      console.error('❌ drive_config.json not found!');
      console.log('\n💡 Run: python3 create_drive_folder.py first');
      process.exit(1);
    }
    
    const driveConfig = JSON.parse(fs.readFileSync('drive_config.json', 'utf8'));
    const folderId = driveConfig.resume_folder_id;
    const folderName = driveConfig.resume_folder_name;
    
    console.log(`📁 Target Folder: ${folderName}`);
    console.log(`🆔 Folder ID: ${folderId}`);
    
    // We need OAuth to share the folder (service account can't share itself access)
    console.log('\n⚠️  IMPORTANT: You need to manually share the folder');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 STEPS TO SHARE:');
    console.log('1. Open this link in your browser:');
    console.log(`   https://drive.google.com/drive/folders/${folderId}`);
    console.log('\n2. Click the "Share" button (or right-click → Share)');
    console.log('\n3. Add this email address as EDITOR:');
    console.log(`   ${serviceAccountEmail}`);
    console.log('\n4. Click "Send" or "Share"');
    console.log('\n5. Come back here and press ENTER to test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Wait for user confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise(resolve => {
      readline.question('\nPress ENTER after sharing the folder...', () => {
        readline.close();
        resolve();
      });
    });
    
    // Test access
    console.log('\n🔍 Testing Drive access...');
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    try {
      // Try to list files in the folder
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 5
      });
      
      console.log('✅ Success! Service account can access the folder');
      console.log(`📂 Found ${response.data.files.length} files in folder`);
      
      if (response.data.files.length > 0) {
        console.log('\n📄 Sample files:');
        response.data.files.forEach(file => {
          console.log(`   - ${file.name}`);
        });
      }
      
      console.log('\n🎉 Setup complete! Your automation can now upload to Drive');
      
    } catch (error) {
      console.error('❌ Access test failed:', error.message);
      console.log('\n💡 Make sure you:');
      console.log('   1. Shared the folder with the service account email');
      console.log('   2. Gave EDITOR permissions (not just Viewer)');
      console.log('   3. The folder ID is correct in drive_config.json');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

shareDriveFolder();