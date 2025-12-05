// scripts/verify_drive_structure.js
// Check folder structure and files in Google Drive

const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function verifyDriveStructure() {
  try {
    console.log('\n🔍 VERIFYING GOOGLE DRIVE STRUCTURE\n');

    // Load token
    if (!fs.existsSync('google_token.json')) {
      console.error('❌ google_token.json not found. Run setup_oauth.js first');
      process.exit(1);
    }

    const tokenData = JSON.parse(fs.readFileSync('google_token.json', 'utf8'));

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials(tokenData);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Find root LinkedIn_Automation folder
    console.log('📁 Finding LinkedIn_Automation folder...');
    const rootResponse = await drive.files.list({
      q: "name='LinkedIn_Automation' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, webViewLink)',
      pageSize: 1
    });

    if (rootResponse.data.files.length === 0) {
      console.log('❌ LinkedIn_Automation folder not found');
      console.log('📝 Create one by running: node scripts/step9_complete_resume_workflow.js --confirm=true --max=1\n');
      return;
    }

    const rootFolder = rootResponse.data.files[0];
    console.log(`✅ Found: ${rootFolder.name}`);
    console.log(`🔗 URL: https://drive.google.com/drive/folders/${rootFolder.id}\n`);

    // Find Resumes folder
    console.log('📁 Finding Resumes folder...');
    const resumesResponse = await drive.files.list({
      q: `name='Resumes' and mimeType='application/vnd.google-apps.folder' and '${rootFolder.id}' in parents and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1
    });

    if (resumesResponse.data.files.length === 0) {
      console.log('❌ Resumes folder not found (no files uploaded yet)\n');
      return;
    }

    const resumesFolder = resumesResponse.data.files[0];
    console.log(`✅ Found: Resumes`);
    console.log(`🔗 URL: https://drive.google.com/drive/folders/${resumesFolder.id}\n`);

    // Find Readable/Unreadable folders
    const categories = ['Readable', 'Unreadable'];
    
    for (const category of categories) {
      console.log(`📁 Finding ${category} folder...`);
      const categoryResponse = await drive.files.list({
        q: `name='${category}' and mimeType='application/vnd.google-apps.folder' and '${resumesFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (categoryResponse.data.files.length === 0) {
        console.log(`⏭️  ${category} folder not found yet\n`);
        continue;
      }

      const categoryFolder = categoryResponse.data.files[0];
      console.log(`✅ Found: ${category}`);
      console.log(`🔗 URL: https://drive.google.com/drive/folders/${categoryFolder.id}\n`);

      // Find date folders
      console.log(`   📅 Looking for date folders in ${category}...`);
      const dateResponse = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and '${categoryFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, createdTime)',
        pageSize: 10
      });

      if (dateResponse.data.files.length === 0) {
        console.log(`   ⏭️  No date folders found\n`);
        continue;
      }

      dateResponse.data.files.forEach(dateFolder => {
        console.log(`   ✓ ${dateFolder.name} (${dateFolder.createdTime.split('T')[0]})`);
        console.log(`     🔗 https://drive.google.com/drive/folders/${dateFolder.id}`);
      });

      // Find files in each date folder
      for (const dateFolder of dateResponse.data.files) {
        const filesResponse = await drive.files.list({
          q: `'${dateFolder.id}' in parents and trashed=false`,
          fields: 'files(id, name, size, mimeType, createdTime)',
          pageSize: 20
        });

        if (filesResponse.data.files.length > 0) {
          console.log(`\n   📄 Files in ${dateFolder.name}:`);
          filesResponse.data.files.forEach(file => {
            const sizeKB = Math.round(file.size / 1024);
            console.log(`      • ${file.name} (${sizeKB} KB)`);
            console.log(`        🔗 https://drive.google.com/file/d/${file.id}/view`);
          });
        }
      }
      console.log('');
    }

    console.log('============================================================');
    console.log('📊 SUMMARY');
    console.log('============================================================');
    console.log(`Your resumes are organized as:`);
    console.log(`📁 LinkedIn_Automation/`);
    console.log(`   └─ 📁 Resumes/`);
    console.log(`      ├─ 📁 Readable/`);
    console.log(`      │   └─ 📁 [DATE]/`);
    console.log(`      │       └─ 📄 resume_*.pdf`);
    console.log(`      └─ 📁 Unreadable/`);
    console.log(`          └─ 📁 [DATE]/`);
    console.log(`              └─ 📄 resume_*.pdf`);
    console.log('\n✅ Structure verified!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyDriveStructure();