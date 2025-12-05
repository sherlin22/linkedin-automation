// scripts/check_auth.js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔐 Checking LinkedIn Authentication Status...');
  
  if (!fs.existsSync('auth_state.json')) {
    console.error('❌ auth_state.json not found!');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'auth_state.json',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  
  try {
    console.log('🌐 Testing authentication...');
    await page.goto('https://www.linkedin.com/feed', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login') || currentUrl.includes('/uas/login')) {
      console.log('❌ AUTHENTICATION FAILED: Redirected to login page');
      console.log('💡 Please run: node scripts/login_and_save_state.js');
    } else if (currentUrl.includes('/feed') || currentUrl.includes('/service-marketplace')) {
      console.log('✅ AUTHENTICATION SUCCESSFUL: Logged in to LinkedIn');
      
      // Test service marketplace access
      console.log('🔗 Testing service marketplace access...');
      await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      console.log(`Service Marketplace URL: ${page.url()}`);
      
      if (page.url().includes('/service-marketplace/provider/requests')) {
        console.log('✅ SUCCESS: Can access service marketplace');
        
        // Check for cards
        await page.waitForTimeout(5000);
        const cards = await page.$$('.artdeco-list__item, div[class*="request"]');
        console.log(`📋 Found ${cards.length} potential request cards`);
        
        // Check for proposal buttons
        let proposalButtonCount = 0;
        for (const card of cards.slice(0, 5)) { // Check first 5 cards
          const button = await card.$('button:has-text("Submit proposal")');
          if (button) proposalButtonCount++;
        }
        console.log(`🔘 Found ${proposalButtonCount} cards with proposal buttons`);
        
      } else {
        console.log('❌ Cannot access service marketplace');
      }
    } else {
      console.log('⚠️ Unknown page state');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();