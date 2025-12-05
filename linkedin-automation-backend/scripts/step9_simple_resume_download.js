const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  RESUME_STATE_FILE: './resume_processing_state.json',
  DOWNLOADS_DIR: './downloads/resumes',
  AUTH_STATE_FILE: './auth_state.json'
};

let RESUME_STATE = { processed: [] };

// Load resume state
async function loadResumeState() {
  try {
    const data = await fs.readFile(CONFIG.RESUME_STATE_FILE, 'utf8');
    RESUME_STATE = JSON.parse(data);
    console.log(`📁 Loaded resume state: ${RESUME_STATE.processed?.length || 0} processed`);
  } catch (e) {
    console.log('📁 No existing resume state found, starting fresh');
    RESUME_STATE = { processed: [] };
  }
}

// Save resume state
async function saveResumeState() {
  await fs.writeFile(CONFIG.RESUME_STATE_FILE, JSON.stringify(RESUME_STATE, null, 2));
}

// Manual login handler
async function handleManualLogin(page) {
  console.log('🔐 MANUAL LOGIN REQUIRED');
  console.log('================================');
  console.log('Please log in to LinkedIn in the browser window that opened.');
  console.log('After successful login, the script will continue automatically.');
  console.log('================================');
  
  // Wait for user to complete login (wait for messaging page)
  try {
    await page.waitForURL('**/messaging/**', { timeout: 180000 }); // 3 minutes timeout
    console.log('✅ Login successful! Saving session...');
    
    // Save the auth state
    await page.context().storageState({ path: CONFIG.AUTH_STATE_FILE });
    console.log('💾 Session saved for future use');
    return true;
  } catch (error) {
    console.log('❌ Login timeout or failed. Please try again.');
    return false;
  }
}

// Enhanced download function
async function downloadResumeFile(page, contactName) {
  try {
    console.log(`   🔍 Looking for attachments for: ${contactName}`);
    
    await page.waitForTimeout(3000);
    
    // Look for attachment indicators
    const attachmentSelectors = [
      'span:has-text("sent an attachment")',
      'div:has-text("sent an attachment")',
      '[data-test-attachment]',
      '.msg-s-event-listitem--file'
    ];
    
    for (const selector of attachmentSelectors) {
      const attachments = await page.$$(selector);
      if (attachments.length > 0) {
        console.log(`   ✅ Found ${attachments.length} attachment(s) with selector: ${selector}`);
        
        for (const attachment of attachments) {
          try {
            if (await attachment.isVisible()) {
              await attachment.scrollIntoViewIfNeeded();
              await page.waitForTimeout(1000);
              
              console.log(`   🖱️ Clicking attachment...`);
              
              // Set up download listener
              const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
              
              await attachment.click({ force: true });
              await page.waitForTimeout(3000);
              
              const download = await downloadPromise;
              
              if (download) {
                console.log(`   📥 Download started: ${download.suggestedFilename()}`);
                
                // Ensure downloads directory exists
                await fs.mkdir(CONFIG.DOWNLOADS_DIR, { recursive: true });
                
                // Create safe filename
                const sanitizedName = contactName.replace(/[^a-zA-Z0-9]/g, '_');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `${sanitizedName}_resume_${timestamp}.pdf`;
                const filePath = path.join(CONFIG.DOWNLOADS_DIR, fileName);
                
                await download.saveAs(filePath);
                
                // Verify file
                try {
                  const stats = await fs.stat(filePath);
                  const sizeKB = Math.round(stats.size / 1024);
                  
                  if (stats.size > 0) {
                    console.log(`   ✅ SUCCESS: Downloaded ${fileName} (${sizeKB} KB)`);
                    return {
                      fileName,
                      localPath: filePath,
                      sizeKB,
                      contactName
                    };
                  }
                } catch (e) {
                  console.log(`   ❌ File not saved properly`);
                }
              }
            }
          } catch (error) {
            console.log(`   ⚠️ Attachment click failed: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`   ❌ Could not download file for ${contactName}`);
    return null;
    
  } catch (error) {
    console.log(`   ❌ Download error: ${error.message}`);
    return null;
  }
}

// Generate resume critique
async function generateResumeCritique(contactName) {
  console.log(`   🤖 Generating professional critique...`);
  
  const critique = `Professional Resume Analysis for ${contactName}:

AREAS FOR IMPROVEMENT:
1. QUANTIFY ACHIEVEMENTS: Add specific metrics to demonstrate impact
2. ACTION-ORIENTED LANGUAGE: Start bullet points with strong action verbs
3. ATS OPTIMIZATION: Include more industry-specific keywords
4. PROFESSIONAL SUMMARY: Create a compelling executive summary
5. VISUAL HIERARCHY: Improve formatting for better readability

RECOMMENDATIONS:
• Tailor resume for specific job applications
• Highlight most relevant accomplishments first
• Ensure consistent formatting throughout
• Include both technical and soft skills

This resume shows good potential but would benefit from stronger accomplishment statements.`;

  console.log(`   ✅ Critique generated`);
  return critique;
}

// Create email content
function createEmailContent(contactName, resumeCritique, pricing) {
  const emailContent = `Subject: Resume Writing & LinkedIn Services - Deepa Rajan

Dear ${contactName},

Greetings!!!
PFA the proposal attached with the details needed to proceed further with the services.

Pls share a confirmation on the services you opt-in for:
Resume Writing – Rs ${pricing.resume}/- INR – (As per the Experience, Customised Resume with a Result Oriented approach attracting opportunities)
LinkedIn Optimisation – Rs ${pricing.linkedin}/- INR – (Help you Position yourself and will make stand out from the crowd)

To proceed, I've reviewed your resume and noticed areas for improvement that can significantly enhance its impact:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Profile Summary :  Areas of improvement
${resumeCritique}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next Steps
To proceed, kindly: Confirm which services you would like to avail

Make a 80% advance payment to the details below:
        UPI: deepas2093@sbi
Fill out and return the attached LinkedIn Glossary Sheet

Excited to support your leadership journey and help you unlock high-level opportunities across IT infrastructure, service delivery, and enterprise systems.

Let's get started!

To Your Success,
Deepa Rajan
 +91 9036846673`;

  return emailContent;
}

// Process downloaded resume
async function processResumeWorkflow(downloadResult) {
  try {
    console.log(`\n🔄 Processing resume for: ${downloadResult.contactName}`);
    
    const pricing = { resume: 3000, linkedin: 2500 };
    console.log(`   💰 Pricing - Resume: ₹${pricing.resume}, LinkedIn: ₹${pricing.linkedin}`);
    
    const resumeCritique = await generateResumeCritique(downloadResult.contactName);
    
    console.log(`   📧 Creating email draft...`);
    const emailContent = createEmailContent(downloadResult.contactName, resumeCritique, pricing);
    
    const emailFileName = `email_${downloadResult.contactName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const emailPath = path.join(CONFIG.DOWNLOADS_DIR, emailFileName);
    await fs.writeFile(emailPath, emailContent);
    
    console.log(`   💾 Email draft saved: ${emailPath}`);
    console.log(`   📊 Resume file: ${downloadResult.fileName} (${downloadResult.sizeKB} KB)`);
    
    return {
      success: true,
      pricing: pricing,
      resumeCritique: resumeCritique,
      emailFile: emailPath,
      resumeFile: downloadResult.fileName
    };
    
  } catch (error) {
    console.log(`   ❌ Processing error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Find conversations with attachments
async function findTargetConversations(page) {
  console.log('🔍 Scanning conversations for attachments...');
  
  try {
    // Wait for conversations to load
    await page.waitForSelector('li.msg-conversation-listitem', { timeout: 15000 });
    
    const conversationItems = await page.$$('li.msg-conversation-listitem');
    console.log(`   📊 Found ${conversationItems.length} conversations`);
    
    const targetConversations = [];
    
    for (const item of conversationItems.slice(0, 20)) {
      try {
        const name = await item.$eval('.msg-conversation-card__participant-names', el => el.textContent?.trim()).catch(() => null);
        const snippet = await item.$eval('.msg-conversation-card__snippet', el => el.textContent?.trim()).catch(() => '');
        
        if (name && !RESUME_STATE.processed.includes(name)) {
          const hasAttachment = snippet.toLowerCase().includes('sent an attachment') || snippet.toLowerCase().includes('attachment');
          if (hasAttachment) {
            targetConversations.push(name);
            console.log(`   ✅ Target: ${name}`);
            console.log(`      Preview: "${snippet.substring(0, 60)}..."`);
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return targetConversations;
  } catch (error) {
    console.log(`   ❌ Error finding conversations: ${error.message}`);
    return [];
  }
}

// Main function
(async () => {
  const args = require('minimist')(process.argv.slice(2));
  const headful = args.headful || false;
  const confirm = args.confirm || false;

  console.log('🚀 STEP 9: Resume Download + Processing');
  console.log('=======================================');

  await loadResumeState();

  const browser = await chromium.launch({ 
    headless: false, // Always show browser for login
    slowMo: 100
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1200, height: 800 }
    });

    const page = await context.newPage();

    // Navigate directly to LinkedIn messaging
    console.log('🌐 Opening LinkedIn Messaging...');
    await page.goto('https://www.linkedin.com/messaging/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Check if we're on login page
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log(`📄 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('login') || await page.$('input[type="password"]')) {
      console.log('🔐 Login page detected');
      
      // Handle manual login
      const loginSuccess = await handleManualLogin(page);
      if (!loginSuccess) {
        await browser.close();
        return;
      }
    }

    // Verify we're on messaging page
    if (!page.url().includes('messaging')) {
      console.log('🔄 Redirecting to messaging...');
      await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
    }

    console.log('✅ Successfully on LinkedIn Messaging');

    // Load conversations
    console.log('📜 Loading conversations...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);
    }

    // Find target conversations
    const targetConversations = await findTargetConversations(page);
    
    if (targetConversations.length === 0) {
      console.log('💡 No conversations with attachments found.');
      console.log('   • Make sure you have conversations with "sent an attachment"');
      console.log('   • Check that you are logged in correctly');
      await browser.close();
      return;
    }

    console.log(`🎯 Found ${targetConversations.length} target conversations`);

    let processed = 0;
    let downloadsSuccessful = 0;

    // Process each target conversation
    for (const name of targetConversations) {
      console.log(`\n🔍 Processing: ${name}`);
      
      try {
        // Click on conversation
        await page.click(`li.msg-conversation-listitem:has-text("${name}")`, { timeout: 10000 });
        await page.waitForTimeout(4000);

        if (confirm) {
          const downloadResult = await downloadResumeFile(page, name);

          if (downloadResult) {
            downloadsSuccessful++;
            console.log(`   🎉 Successfully downloaded resume from ${name}`);
            
            const processResult = await processResumeWorkflow(downloadResult);
            if (processResult.success) {
              console.log(`   ✅ Processing completed`);
            }

            RESUME_STATE.processed.push(name);
            await saveResumeState();
          } else {
            console.log(`   ❌ Could not download from ${name}`);
          }
        } else {
          console.log(`   💡 Dry run - would attempt download from ${name}`);
        }

        processed++;
        await page.waitForTimeout(2000);

      } catch (error) {
        console.log(`   ❌ Error processing ${name}: ${error.message}`);
      }
    }

    // Final summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🏁 PROCESSING COMPLETE`);
    console.log(`   • Conversations processed: ${processed}`);
    console.log(`   • Resumes downloaded: ${downloadsSuccessful}`);
    console.log(`   • Email drafts created: ${downloadsSuccessful}`);
    
    if (downloadsSuccessful > 0) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   📁 Files saved in: ${CONFIG.DOWNLOADS_DIR}/`);
    } else if (!confirm) {
      console.log(`\n💡 Run with --confirm=true to attempt actual downloads`);
    }

    await browser.close();

  } catch (e) {
    console.error("❌ Fatal Error:", e);
    await browser.close();
    process.exit(1);
  }
})();