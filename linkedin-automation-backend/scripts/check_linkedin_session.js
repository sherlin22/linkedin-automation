/**
 * check_linkedin_session.js
 * Usage: node check_linkedin_session.js
 * Loads ../data/linkedin-storage.json and opens linkedin.com, logs title/url and saves a screenshot.
 */
require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const storagePath = path.resolve(__dirname, '..', 'data', 'linkedin-storage.json');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storagePath,
    args: ['--start-maximized'],
    viewport: null
  });
  try {
    const page = await browser.newPage();
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const title = await page.title();
    const url = page.url();
    console.log('Page title:', title);
    console.log('Page url:', url);
    const snap = path.resolve(process.cwd(), 'check_linkedin_session.png');
    await page.screenshot({ path: snap, fullPage: true });
    console.log('Screenshot saved to', snap);
  } catch (e) {
    console.error('Error checking session:', e);
  } finally {
    console.log('Keeping browser open so you can inspect. Close it when done.');
  }
})();
