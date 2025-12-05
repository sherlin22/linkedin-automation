// scripts/test_auth_state.js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔐 Testing LinkedIn authentication state...');
  
  if (!fs.existsSync('auth_state.json')) {
    console.error('❌ auth_state.json not found! Please run the login script first.');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'auth_state.json',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/feed', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Check if we're logged in
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/login') && 
             !document.querySelector('input[type="password"]');
    });
    
    if (isLoggedIn) {
      console.log('✅ Successfully logged in!');
      
      // Test service marketplace access
      console.log('🔗 Testing service marketplace access...');
      await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      console.log(`📄 Current URL: ${page.url()}`);
      console.log(`📄 Page title: ${await page.title()}`);
      
      if (page.url().includes('/service-marketplace')) {
        console.log('✅ Successfully accessed service marketplace!');
        
        // Check for proposal cards
        await page.waitForTimeout(5000);
        const cards = await page.$$('[data-test-service-request-list-item]');
        console.log(`📋 Found ${cards.length} service request cards`);
        
      } else {
        console.log('❌ Could not access service marketplace. Current page:', page.url());
      }
      
    } else {
      console.log('❌ Not logged in. Authentication state may be expired.');
    }
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();