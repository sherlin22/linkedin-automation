// save_auth_state.js
// Simple script to save LinkedIn authentication for automation
// Usage: node public/save_auth_state.js

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('='.repeat(60));
  console.log('LinkedIn Authentication Saver');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n📋 Opening LinkedIn login page...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('\n✅ Please complete the following steps:');
  console.log('   1. Sign in to LinkedIn in the browser window');
  console.log('   2. Complete any 2FA/verification if prompted');
  console.log('   3. Wait until you see your LinkedIn feed/homepage');
  console.log('   4. Come back here and press ENTER to save the session\n');

  // Wait for user to press Enter
  await new Promise((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  console.log('\n💾 Saving authentication state...');
  
  const authPath = path.resolve('auth_state.json');
  await context.storageState({ path: authPath });
  
  // Verify the saved file
  const savedData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const cookieCount = (savedData.cookies || []).length;
  const hasOrigins = !!(savedData.origins || []).length;
  
  console.log('\n✅ Authentication saved successfully!');
  console.log(`   📍 Location: ${authPath}`);
  console.log(`   🍪 Cookies: ${cookieCount}`);
  console.log(`   🌐 Origins: ${hasOrigins ? 'Yes' : 'No'}`);
  
  if (cookieCount === 0) {
    console.log('\n⚠️  WARNING: No cookies were saved!');
    console.log('   Please make sure you fully logged in before pressing Enter.');
  } else {
    console.log('\n✅ You can now run the automation scripts with:');
    console.log('   --auth=auth_state.json');
  }

  await browser.close();
  process.exit(0);
})();
