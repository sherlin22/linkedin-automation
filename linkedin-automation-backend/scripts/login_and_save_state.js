// scripts/login_and_save_state.js
const playwright = require("playwright");
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await playwright.chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Opening LinkedIn login...');
  
  try {
    // Go directly to the service marketplace requests page
    await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('📍 Current URL:', page.url());

    // Check if we're on login page or already logged in
    if (page.url().includes('login') || page.url().includes('auth') || !page.url().includes('service-marketplace')) {
      console.log('🔑 Please log in manually in the browser window...');
      console.log('⏳ Waiting for you to complete login...');
      
      // Wait for navigation to service marketplace after login
      await page.waitForNavigation({ 
        url: '**/service-marketplace/provider/requests/**',
        timeout: 120000 
      }).catch(() => {
        console.log('⚠️  Still waiting for login completion...');
      });

      console.log('✅ Login successful! Current URL:', page.url());
    } else {
      console.log('✅ Already logged in!');
    }

    // Verify we're on the correct page
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    
    if (finalUrl.includes('service-marketplace/provider/requests')) {
      console.log('🎯 Successfully reached service marketplace requests page!');
      
      // Save authentication state
      await context.storageState({ path: 'auth_state.json' });
      console.log('💾 Authentication state saved to auth_state.json');
      
      // Take a screenshot for verification
      await page.screenshot({ path: 'login_success.png' });
      console.log('📸 Screenshot saved: login_success.png');
    } else {
      console.log('❌ Failed to reach service marketplace. Current URL:', finalUrl);
      await page.screenshot({ path: 'login_failed.png' });
      throw new Error('Navigation to service marketplace failed');
    }

  } catch (error) {
    console.log('❌ Error during authentication:', error.message);
    await page.screenshot({ path: 'login_error.png' });
  } finally {
    await browser.close();
    console.log('🚪 Browser closed.');
    console.log('\n✅ Now you can run: node scripts/step7_submit_proposal_loop.js --auth=auth_state.json --headful=true');
  }
})();