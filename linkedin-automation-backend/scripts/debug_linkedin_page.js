// scripts/debug_linkedin_page.js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔍 Debugging LinkedIn Service Marketplace Page...');
  
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'auth_state.json',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to LinkedIn Service Marketplace...');
    await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(8000);
    
    console.log('\n=== PAGE ANALYSIS ===');
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ path: 'debug_page.png', fullPage: true });
    
    // Analyze the page structure
    console.log('\n=== CARD ANALYSIS ===');
    
    // Look for different types of cards
    const cardSelectors = [
      '[data-test-service-request-list-item]',
      '.service-request-card',
      '.artdeco-list__item',
      'li',
      'div[class*="card"]',
      'div[class*="request"]',
      'section[class*="card"]'
    ];
    
    for (const selector of cardSelectors) {
      const count = await page.$$eval(selector, elements => elements.length);
      console.log(`Selector "${selector}": ${count} elements`);
    }
    
    // Look for proposal buttons specifically
    console.log('\n=== BUTTON ANALYSIS ===');
    const buttonTexts = await page.$$eval('button', buttons => 
      buttons.map(btn => ({
        text: (btn.textContent || btn.innerText || '').trim().substring(0, 50),
        className: btn.className,
        dataTest: btn.getAttribute('data-test')
      })).filter(btn => btn.text.length > 0)
    );
    
    console.log('Found buttons:', buttonTexts.slice(0, 10)); // Show first 10
    
    // Look for names in the page
    console.log('\n=== NAME ANALYSIS ===');
    const potentialNames = await page.$$eval('span, div, p, h1, h2, h3, h4', elements => 
      elements.map(el => ({
        tag: el.tagName,
        text: (el.textContent || el.innerText || '').trim(),
        className: el.className,
        dataTest: el.getAttribute('data-test')
      })).filter(el => 
        el.text.length > 2 && 
        el.text.length < 50 &&
        !el.text.includes('Submit') &&
        !el.text.includes('Proposal') &&
        el.text.split(' ').length <= 4 &&
        el.text.split(' ').every(word => word[0] === word[0].toUpperCase())
      )
    );
    
    console.log('Potential names found:', potentialNames.slice(0, 10));
    
    // Save page HTML for analysis
    const html = await page.content();
    fs.writeFileSync('debug_page.html', html);
    console.log('\n💾 Saved page HTML to debug_page.html');
    
    console.log('\n✅ Debug completed. Check debug_page.png and debug_page.html');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
})();