// scripts/step9_final_optimized_resume_download.js
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

class OptimizedResumeDownloader {
    constructor() {
        this.browser = null;
        this.page = null;
        this.downloadsDir = path.join(process.cwd(), 'downloads', 'resumes');
        this.resumeState = this.loadResumeState();
    }

    loadResumeState() {
        try {
            const statePath = path.join(this.downloadsDir, 'optimized_resume_state.json');
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
        const statePath = path.join(this.downloadsDir, 'optimized_resume_state.json');
        fs.ensureDirSync(this.downloadsDir);
        fs.writeJsonSync(statePath, this.resumeState, { spaces: 2 });
    }

    async init() {
        console.log('🚀 OPTIMIZED RESUME DOWNLOAD - Smart Detection');
        console.log('==============================================');
        
        this.browser = await chromium.launch({ 
            headless: false,
            downloadsPath: this.downloadsDir
        });
        
        const context = await this.browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1200, height: 800 }
        });
        
        this.page = await context.newPage();
        return this;
    }

    async loginToLinkedIn() {
        console.log('📱 Opening LinkedIn Messaging...');
        await this.page.goto('https://www.linkedin.com/messaging/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        if (await this.page.locator('input[type="password"]').isVisible() || 
            await this.page.locator('text=Sign in').isVisible()) {
            console.log('🔐 MANUAL LOGIN REQUIRED');
            console.log('Please log in to LinkedIn in the browser window.');
            
            await this.page.waitForURL('https://www.linkedin.com/messaging/**', { timeout: 120000 });
            console.log('✅ Login successful!');
        }

        await this.page.waitForTimeout(3000);
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

    // SMART ATTACHMENT DETECTION - Only click actual interactive elements
    async findDownloadableAttachments() {
        console.log('   🔍 Looking for downloadable attachments...');
        
        // PRIMARY: Look for actual download buttons and interactive elements
        const interactiveSelectors = [
            // Download buttons (most important)
            'button[data-test-file-download-button]',
            'button:has-text("Download")',
            'button:has-text("download")',
            
            // File preview elements that might contain download buttons
            '.msg-s-attachment-card__action-button',
            '[data-test-attachment-download]',
            
            // Attachment cards that are clickable
            '.msg-s-attachment-card',
            '[data-test-attachment-card]'
        ];

        let interactiveElements = [];
        
        for (const selector of interactiveSelectors) {
            try {
                const elements = await this.page.locator(selector).all();
                if (elements.length > 0) {
                    console.log(`   ✅ Found ${elements.length} interactive elements with: ${selector}`);
                    interactiveElements = [...interactiveElements, ...elements];
                }
            } catch (error) {
                // Skip if selector fails
            }
        }

        // SECONDARY: If no interactive elements found, look for attachment indicators
        if (interactiveElements.length === 0) {
            console.log('   🔍 No interactive elements found, checking for attachment indicators...');
            const indicatorSelectors = [
                '.msg-s-message-group__bubble--attachment',
                '.msg-s-attachment',
                '[data-test-attachment]',
                '.msg-s-message-party__attachment'
            ];

            for (const selector of indicatorSelectors) {
                try {
                    const elements = await this.page.locator(selector).all();
                    if (elements.length > 0) {
                        console.log(`   📎 Found ${elements.length} attachment indicators with: ${selector}`);
                        interactiveElements = [...interactiveElements, ...elements];
                    }
                } catch (error) {
                    // Skip if selector fails
                }
            }
        }

        return interactiveElements;
    }

    async downloadResumeFromConversation(conversation) {
        const { name, element, index } = conversation;
        
        console.log(`\n🔍 [${index + 1}] Checking: ${name}`);
        
        // Skip if already downloaded
        if (this.resumeState.downloaded.includes(name)) {
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
            
            // SMART SCROLLING - Load all messages
            console.log('   📜 Scrolling to load all messages...');
            for (let scroll = 0; scroll < 5; scroll++) {
                await this.page.evaluate(() => {
                    const messageList = document.querySelector('.msg-s-message-list');
                    if (messageList) {
                        messageList.scrollTop = messageList.scrollHeight;
                    }
                });
                await this.page.waitForTimeout(1500);
            }
            
            // SMART ATTACHMENT DETECTION
            const interactiveElements = await this.findDownloadableAttachments();
            
            console.log(`   📎 Total interactive elements found: ${interactiveElements.length}`);
            
            if (interactiveElements.length === 0) {
                console.log('   📭 No downloadable attachments found');
                if (!this.resumeState.processed.includes(name)) {
                    this.resumeState.processed.push(name);
                }
                return false;
            }
            
            let downloadedCount = 0;
            const filesBeforeDownload = new Set(fs.readdirSync(this.downloadsDir));
            
            // Try each interactive element
            for (let i = 0; i < interactiveElements.length; i++) {
                try {
                    console.log(`   🖱️ Attempting to click element ${i + 1}/${interactiveElements.length}`);
                    
                    // Scroll element into view
                    await interactiveElements[i].scrollIntoViewIfNeeded();
                    await this.page.waitForTimeout(1000);
                    
                    // Get element info for debugging
                    const elementInfo = await interactiveElements[i].evaluate(el => ({
                        tagName: el.tagName,
                        className: el.className,
                        text: el.textContent?.substring(0, 50),
                        hasOnClick: !!el.onclick
                    }));
                    
                    console.log(`   🔧 Element info: ${elementInfo.tagName}.${elementInfo.className.split(' ')[0]} - "${elementInfo.text}..."`);
                    
                    // Take screenshot for debugging
                    try {
                        await interactiveElements[i].screenshot({ 
                            path: path.join(this.downloadsDir, `debug_${name.replace(/[^a-zA-Z0-9]/g, '_')}_element_${i}.png`) 
                        });
                    } catch (screenshotError) {
                        console.log('   📸 Could not take screenshot of element');
                    }
                    
                    // SMART CLICKING with multiple strategies
                    let clickSuccessful = false;
                    
                    // Strategy 1: Regular click
                    try {
                        await interactiveElements[i].click({ timeout: 5000 });
                        clickSuccessful = true;
                        console.log('   ✅ Regular click successful');
                    } catch (clickError) {
                        console.log('   ⚠️  Regular click failed, trying force click');
                        
                        // Strategy 2: Force click
                        try {
                            await interactiveElements[i].click({ force: true, timeout: 5000 });
                            clickSuccessful = true;
                            console.log('   ✅ Force click successful');
                        } catch (forceError) {
                            console.log('   ⚠️  Force click failed, trying JavaScript click');
                            
                            // Strategy 3: JavaScript click
                            try {
                                await interactiveElements[i].evaluate(el => el.click());
                                clickSuccessful = true;
                                console.log('   ✅ JavaScript click successful');
                            } catch (jsError) {
                                console.log('   ❌ All click strategies failed');
                            }
                        }
                    }
                    
                    if (clickSuccessful) {
                        // Wait for download with progress indication
                        console.log('   ⏳ Waiting for download...');
                        for (let wait = 0; wait < 6; wait++) {
                            await this.page.waitForTimeout(2000);
                            process.stdout.write('.');
                            
                            // Check for new files
                            const currentFiles = fs.readdirSync(this.downloadsDir);
                            const newFiles = currentFiles.filter(f => 
                                !filesBeforeDownload.has(f) && 
                                (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'))
                            );
                            
                            if (newFiles.length > 0) {
                                console.log('\n');
                                downloadedCount++;
                                
                                // Handle the downloaded file
                                for (const newFile of newFiles) {
                                    console.log(`   ✅ Downloaded: ${newFile}`);
                                    
                                    // Rename file to include conversation name
                                    const newPath = path.join(this.downloadsDir, newFile);
                                    const fileExtension = path.extname(newFile);
                                    const renamedFile = `resume_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${fileExtension}`;
                                    const renamedPath = path.join(this.downloadsDir, renamedFile);
                                    
                                    if (fs.existsSync(newPath)) {
                                        fs.renameSync(newPath, renamedPath);
                                        console.log(`   📝 Renamed to: ${renamedFile}`);
                                    }
                                }
                                
                                break; // Stop after first successful download
                            }
                        }
                        
                        if (downloadedCount > 0) {
                            break; // Move to next conversation after successful download
                        } else {
                            console.log('\n   ⚠️  Click successful but no file downloaded');
                        }
                    }
                    
                } catch (error) {
                    console.log(`   ❌ Error with element ${i + 1}: ${error.message}`);
                }
            }
            
            // Update state
            if (!this.resumeState.processed.includes(name)) {
                this.resumeState.processed.push(name);
            }
            if (downloadedCount > 0) {
                if (!this.resumeState.downloaded.includes(name)) {
                    this.resumeState.downloaded.push(name);
                }
                console.log(`   🎉 Successfully downloaded ${downloadedCount} file(s) from ${name}`);
                return true;
            }
            
            console.log(`   ❌ Could not download from ${name}`);
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
            console.log('🏁 OPTIMIZED PROCESSING COMPLETE');
            console.log('='.repeat(60));
            console.log(`   • Total conversations: ${conversations.length}`);
            console.log(`   • Conversations processed: ${this.resumeState.processed.length}`);
            console.log(`   • New resumes downloaded: ${downloadedCount}`);
            
            const allFiles = fs.readdirSync(this.downloadsDir).filter(f => f.includes('resume_'));
            console.log(`   • Total resume files in folder: ${allFiles.length}`);
            
            if (downloadedCount === 0) {
                console.log('\n💡 TROUBLESHOOTING:');
                console.log('   • Check debug screenshots in downloads/resumes/ folder');
                console.log('   • Verify the elements being clicked are actual download buttons');
                console.log('   • Manually check if PDFs download when you click them');
                console.log('   • Some attachments might require additional steps to download');
            }
            
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
    const downloader = new OptimizedResumeDownloader();
    downloader.run();
} else {
    console.log('❌ Please run with --confirm=true to start the download process');
    process.exit(1);
}