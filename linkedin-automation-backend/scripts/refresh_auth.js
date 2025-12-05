// scripts/refresh_auth.js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔄 Refreshing LinkedIn Authentication...');
  
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  
  try {
    console.log('🔐 Opening LinkedIn login...');
    await page.goto('https://www.linkedin.com/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    console.log('📍 Please log in manually in the browser window...');
    console.log('⏳ Waiting for successful login...');
    
    // Wait for user to complete login
    await page.waitForFunction(() => {
      return window.location.href.includes('/feed') || 
             window.location.href.includes('/service-marketplace') ||
             document.querySelector('[data-test-global-nav-header]');
    }, { timeout: 120000 });
    
    console.log('✅ Login successful!');
    console.log('Current URL:', page.url());
    
    // Verify we can access service marketplace
    console.log('🔗 Testing service marketplace access...');
    await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    if (page.url().includes('/service-marketplace/provider/requests')) {
      console.log('✅ Successfully accessed service marketplace!');
    } else {
      console.log('⚠️ Could not access service marketplace directly');
    }
    
    // Save authentication state
    await context.storageState({ path: 'auth_state.json' });
    console.log('💾 Authentication state saved to auth_state.json');
    
    // Take screenshot for verification
    await page.screenshot({ path: 'auth_refresh_success.png' });
    console.log('📸 Screenshot saved: auth_refresh_success.png');
    
    console.log('\n🎯 Authentication refreshed successfully!');
    console.log('🚀 You can now run: node scripts/step7_simple.js --confirm=true');
    
  } catch (error) {
    console.error('❌ Authentication refresh failed:', error.message);
    await page.screenshot({ path: 'auth_refresh_failed.png' });
  } finally {
    await browser.close();
  }
})();