// Create a new file: scripts/step9_enhanced_resume_download.js
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

class EnhancedResumeDownloader {
    constructor() {
        this.browser = null;
        this.page = null;
        this.downloadsDir = path.join(process.cwd(), 'downloads', 'resumes');
        this.resumeState = this.loadResumeState();
    }

    loadResumeState() {
        try {
            const statePath = path.join(this.downloadsDir, 'enhanced_resume_state.json');
            if (fs.existsSync(statePath)) {
                return fs.readJsonSync(statePath);
            }
        } catch (error) {
            console.log('📁 No existing resume state found, starting fresh');
        }
        return { 
            processed: [],
            downloaded: []
        };
    }

    saveResumeState() {
        const statePath = path.join(this.downloadsDir, 'enhanced_resume_state.json');
        fs.ensureDirSync(this.downloadsDir);
        fs.writeJsonSync(statePath, this.resumeState, { spaces: 2 });
    }

    async init() {
        console.log('🚀 ENHANCED RESUME DOWNLOAD - Multiple Detection Strategies');
        console.log('==========================================================');
        
        this.browser = await chromium.launch({ 
            headless: false,
            downloadsPath: this.downloadsDir
        });
        
        const context = await this.browser.newContext({
            acceptDownloads: true
        });
        
        this.page = await context.newPage();
        return this;
    }

    async loginToLinkedIn() {
        console.log('📱 Opening LinkedIn Messaging...');
        await this.page.goto('https://www.linkedin.com/messaging/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        if (await this.page.locator('input[type="password"]').isVisible() || 
            await this.page.locator('text=Sign in').isVisible()) {
            console.log('🔐 MANUAL LOGIN REQUIRED');
            console.log('Please log in to LinkedIn in the browser window.');
            
            await this.page.waitForURL('https://www.linkedin.com/messaging/**', { timeout: 120000 });
            console.log('✅ Login successful!');
        }

        await this.page.waitForTimeout(5000);
    }

    async getAllConversations() {
        console.log('📜 Loading conversations...');
        
        await this.page.waitForSelector('li.msg-conversation-listitem', { timeout: 15000 });
        
        console.log('🔍 Getting ALL conversation names...');
        const conversationItems = await this.page.locator('li.msg-conversation-listitem').all();
        console.log(`📊 Found ${conversationItems.length} conversations`);
        
        const conversations = [];
        for (let i = 0; i < conversationItems.length; i++) {
            try {
                const name = await conversationItems[i].locator('.msg-conversation-listitem__participant-names').textContent();
                const cleanName = name ? name.trim() : `Unknown_${i + 1}`;
                console.log(`   ${i + 1}. ${cleanName}`);
                conversations.push({
                    element: conversationItems[i],
                    name: cleanName,
                    index: i
                });
            } catch (error) {
                console.log(`   ❌ Could not get conversation ${i + 1}: ${error.message}`);
            }
        }
        
        return conversations;
    }

    // ENHANCED ATTACHMENT DETECTION
    async findAttachmentsInConversation() {
        const attachmentSelectors = [
            // Primary download buttons
            'button[data-test-file-download-button]',
            'button:has-text("Download")',
            'button:has-text("download")',
            
            // PDF links and attachments
            'a[href*=".pdf"]',
            '[data-test-pdf-attachment]',
            '.msg-s-message-group__bubble--attachment',
            
            // File attachment indicators
            '.msg-s-attachment',
            '[data-test-attachment]',
            
            // LinkedIn's specific attachment classes
            '.msg-s-message-party__attachment',
            '.msg-s-message-list-event__attachment'
        ];

        let allElements = [];
        
        for (const selector of attachmentSelectors) {
            try {
                const elements = await this.page.locator(selector).all();
                if (elements.length > 0) {
                    console.log(`   🔍 Found ${elements.length} elements with selector: ${selector}`);
                    allElements = [...allElements, ...elements];
                }
            } catch (error) {
                // Skip if selector fails
            }
        }

        // Also look for any elements containing "pdf" text
        try {
            const pdfTextElements = await this.page.locator('*:has-text(".pdf")').all();
            if (pdfTextElements.length > 0) {
                console.log(`   🔍 Found ${pdfTextElements.length} elements mentioning PDF`);
                allElements = [...allElements, ...pdfTextElements];
            }
        } catch (error) {
            // Continue if this fails
        }

        return allElements;
    }

    async downloadResumeFromConversation(conversation) {
        const { name, element, index } = conversation;
        
        console.log(`\n🔍 [${index + 1}] Checking: ${name}`);
        
        // Skip if already processed and downloaded
        if (this.resumeState.processed.includes(name) && this.resumeState.downloaded.includes(name)) {
            console.log(`   ⏭️  Skipping (already downloaded): ${name}`);
            return false;
        }

        try {
            // Click on the conversation
            await element.click();
            await this.page.waitForTimeout(4000);
            
            // Wait for conversation to load
            try {
                await this.page.waitForSelector('.msg-s-message-list', { timeout: 8000 });
            } catch (error) {
                console.log('   ⏳ Conversation loading slowly, continuing...');
            }
            
            // SCROLL multiple times to load all messages
            for (let scroll = 0; scroll < 3; scroll++) {
                await this.page.evaluate(() => {
                    const messageList = document.querySelector('.msg-s-message-list');
                    if (messageList) {
                        messageList.scrollTop = 0; // Scroll to top first
                    }
                });
                await this.page.waitForTimeout(1000);
                
                await this.page.evaluate(() => {
                    const messageList = document.querySelector('.msg-s-message-list');
                    if (messageList) {
                        messageList.scrollTop = messageList.scrollHeight; // Then to bottom
                    }
                });
                await this.page.waitForTimeout(2000);
            }
            
            // ENHANCED ATTACHMENT DETECTION
            const allElements = await this.findAttachmentsInConversation();
            
            console.log(`   📎 Total elements found: ${allElements.length}`);
            
            if (allElements.length === 0) {
                console.log('   📭 No downloadable attachments found');
                // Mark as processed even if no attachments found
                if (!this.resumeState.processed.includes(name)) {
                    this.resumeState.processed.push(name);
                }
                return false;
            }
            
            let downloadedCount = 0;
            const filesBeforeDownload = new Set(fs.readdirSync(this.downloadsDir));
            
            for (let i = 0; i < allElements.length; i++) {
                try {
                    console.log(`   🖱️ Attempting to click element ${i + 1}/${allElements.length}`);
                    
                    // Scroll element into view
                    await allElements[i].scrollIntoViewIfNeeded();
                    await this.page.waitForTimeout(1000);
                    
                    // Take screenshot for debugging
                    await allElements[i].screenshot({ path: path.join(this.downloadsDir, `debug_${name.replace(/[^a-zA-Z0-9]/g, '_')}_element_${i}.png`) });
                    
                    // Try to click with multiple strategies
                    try {
                        await allElements[i].click({ force: true });
                    } catch (clickError) {
                        console.log(`   ⚠️  Regular click failed, trying JavaScript click`);
                        await this.page.evaluate((element) => {
                            element.click();
                        }, await allElements[i].elementHandle());
                    }
                    
                    // Wait for download
                    await this.page.waitForTimeout(10000);
                    
                    // Check for new files
                    const currentFiles = fs.readdirSync(this.downloadsDir);
                    const newFiles = currentFiles.filter(f => !filesBeforeDownload.has(f) && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
                    
                    if (newFiles.length > 0) {
                        downloadedCount++;
                        console.log(`   ✅ Downloaded: ${newFiles[0]}`);
                        
                        // Rename file to include conversation name
                        const newPath = path.join(this.downloadsDir, newFiles[0]);
                        const fileExtension = path.extname(newFiles[0]);
                        const renamedFile = `resume_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${fileExtension}`;
                        const renamedPath = path.join(this.downloadsDir, renamedFile);
                        
                        if (fs.existsSync(newPath)) {
                            fs.renameSync(newPath, renamedPath);
                            console.log(`   📝 Renamed to: ${renamedFile}`);
                        }
                        
                        break; // Stop after first successful download
                    } else {
                        console.log(`   ⚠️  Clicked element ${i + 1} but no new file detected`);
                    }
                    
                } catch (error) {
                    console.log(`   ❌ Error with element ${i + 1}: ${error.message}`);
                }
            }
            
            // Update state
            if (!this.resumeState.processed.includes(name)) {
                this.resumeState.processed.push(name);
            }
            if (downloadedCount > 0 && !this.resumeState.downloaded.includes(name)) {
                this.resumeState.downloaded.push(name);
                console.log(`   🎉 Downloaded ${downloadedCount} file(s) from ${name}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.log(`   ❌ Error processing ${name}: ${error.message}`);
            return false;
        }
    }

    async processAllConversations(conversations) {
        console.log(`\n🎯 Processing ${conversations.length} conversations`);
        
        let totalDownloaded = 0;
        
        for (const conversation of conversations) {
            const downloaded = await this.downloadResumeFromConversation(conversation);
            if (downloaded) {
                totalDownloaded++;
            }
            
            this.saveResumeState();
            await this.page.waitForTimeout(2000);
        }
        
        return totalDownloaded;
    }

    async run() {
        try {
            await this.init();
            await this.loginToLinkedIn();
            
            const conversations = await this.getAllConversations();
            const downloadedCount = await this.processAllConversations(conversations);
            
            console.log('\n' + '='.repeat(60));
            console.log('🏁 ENHANCED PROCESSING COMPLETE');
            console.log('='.repeat(60));
            console.log(`   • Total conversations: ${conversations.length}`);
            console.log(`   • Conversations processed: ${this.resumeState.processed.length}`);
            console.log(`   • New resumes downloaded: ${downloadedCount}`);
            
            const allFiles = fs.readdirSync(this.downloadsDir).filter(f => f.includes('resume_'));
            console.log(`   • Total resume files in folder: ${allFiles.length}`);
            
        } catch (error) {
            console.log(`❌ Script failed: ${error.message}`);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run the script
const args = process.argv.slice(2);
const confirm = args.includes('--confirm=true');

if (confirm) {
    const downloader = new EnhancedResumeDownloader();
    downloader.run();
} else {
    console.log('❌ Please run with --confirm=true to start the download process');
    process.exit(1);
}