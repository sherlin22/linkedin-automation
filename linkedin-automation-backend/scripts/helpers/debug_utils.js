// scripts/helpers/debug_utils.js
const fs = require('fs');
const path = require('path');

/**
 * Save debug artifacts (screenshots + HTML)
 */
async function saveDebugArtifacts(page, identifier, type = 'general') {
  try {
    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const safeName = identifier.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    
    const screenshotPath = path.join(debugDir, `${type}_${safeName}_${timestamp}.png`);
    const htmlPath = path.join(debugDir, `${type}_${safeName}_${timestamp}.html`);
    
    // Take screenshot
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Save HTML
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf8');
    
    console.log(`   📸 Debug artifacts saved: ${path.basename(screenshotPath)}, ${path.basename(htmlPath)}`);
    
    return {
      success: true,
      screenshotPath: screenshotPath,
      htmlPath: htmlPath,
      files: [screenshotPath, htmlPath]
    };
    
  } catch (error) {
    console.error('❌ Debug artifacts save error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  saveDebugArtifacts
};
