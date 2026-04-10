// scripts/helpers/gmail_sent_checker.js
// Enhanced to search by candidate name in email body (Dear {name})

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GmailSentChecker {
  constructor() {
    this.gmail = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔍 Initializing Gmail Sent Checker...');

      const tokenPath = path.join(process.cwd(), 'google_token.json');

      if (!fs.existsSync(tokenPath)) {
        throw new Error('google_token.json not found');
      }

      let tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

      if (!clientId || !clientSecret) {
        throw new Error('Missing Google credentials');
      }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials(tokenData);

      oauth2Client.on('tokens', (tokens) => {
        tokenData.access_token = tokens.access_token;
        if (tokens.refresh_token) tokenData.refresh_token = tokens.refresh_token;
        if (tokens.expiry_date) tokenData.expiry_date = tokens.expiry_date;
        try {
          fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
        } catch (e) {
          console.warn('⚠️  Failed to save token');
        }
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      this.isInitialized = true;
      console.log('✅ Gmail Sent Checker initialized');
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Get email body content to verify it's OUR email
   */
  async getEmailBodyPreview(messageId) {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = message.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';

      // Get plain text body
      let body = '';

      if (message.data.payload.parts) {
        // Multipart message
        for (const part of message.data.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      } else if (message.data.payload.body && message.data.payload.body.data) {
        // Simple message
        body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
      }

      return {
        subject,
        from,
        body: body.substring(0, 2000) // First 2000 chars
      };
    } catch (error) {
      console.error('❌ Could not read email body:', error.message);
      return null;
    }
  }

  /**
   * Check if ANY email was sent to candidate in Sent folder
   */
  async hasAnySentEmail(candidateName) {
    try {
      if (!this.isInitialized) {
        throw new Error('Gmail checker not initialized');
      }

      const cleanName = candidateName.trim();

      // Try multiple search strategies
      const queries = [
        // Strategy 1: Exact name in subject or to
        `in:sent from:me subject:"${cleanName}"`,
        `in:sent from:me to:"${cleanName}"`,

        // Strategy 2: First name from candidate
        ...(cleanName.split(' ').length > 0
          ? [`in:sent from:me to:"${cleanName.split(' ')[0]}"`]
          : [])
      ];

      for (const query of queries) {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 5
        });

        if (response.data.messages && response.data.messages.length > 0) {
          const message = response.data.messages[0];
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Date', 'Subject', 'To']
          });

          const headers = fullMessage.data.payload.headers;

          console.log(`   ✅ Found sent email matching: ${cleanName}`);

          return {
            wasSent: true,
            messageId: message.id,
            subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
            sentDate: headers.find(h => h.name === 'Date')?.value,
            query: query
          };
        }
      }

      console.log(`   ⏭️  No sent email found for: ${cleanName}`);
      return { wasSent: false, reason: 'No email found in any search' };
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      return { wasSent: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Get all emails sent in last N hours
   */
  async getAllRecentSentEmails(hoursBack = 48) {
    try {
      if (!this.isInitialized) {
        throw new Error('Gmail checker not initialized');
      }

      const now = new Date();
      const pastDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
      const formattedDate = pastDate.toISOString().split('T')[0];

      const query = `in:sent from:me after:${formattedDate}`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      const messages = response.data.messages || [];

      const emailDetails = [];
      for (const msg of messages) {
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Date', 'Subject', 'To', 'From']
        });

        const headers = fullMessage.data.payload.headers;
        emailDetails.push({
          messageId: msg.id,
          subject: headers.find(h => h.name === 'Subject')?.value,
          to: headers.find(h => h.name === 'To')?.value,
          date: headers.find(h => h.name === 'Date')?.value
        });
      }

      return emailDetails;
    } catch (error) {
      console.error('❌ Bulk fetch failed:', error.message);
      return [];
    }
  }

  /**
   * ✅ NEW: Find email by candidate name in email body (searches for "Dear {name}")
   * This is the PRIMARY method for Step 10 and Step 11 follow-up verification
   *
   * @param {string} candidateName - Full name of the candidate
   * @param {string} candidateEmail - Optional: candidate's email address for strict verification
   * @returns {object} - { wasSent: boolean, messageId, subject, sentDate }
   */
  async findEmailByNameInBody(candidateName, candidateEmail = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('Gmail checker not initialized');
      }

      const cleanName = candidateName.trim();
      if (!cleanName || cleanName.length < 2) {
        console.log(`   ⚠️  Invalid name: "${candidateName}"`);
        return { wasSent: false, reason: 'Invalid name' };
      }

      console.log(`   🔍 Searching Gmail for email to: "${cleanName}"`);

      // Extract first name and last name for matching
      const nameParts = cleanName.split(' ').filter(part => part.length > 1);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      // Primary search: Search by email address (most accurate)
      if (candidateEmail) {
        console.log(`      Query: in:sent from:me to:${candidateEmail}`);
        const emailResponse = await this.gmail.users.messages.list({
          userId: 'me',
          q: `in:sent from:me to:${candidateEmail}`,
          maxResults: 10
        });

        if (emailResponse.data.messages && emailResponse.data.messages.length > 0) {
          const message = emailResponse.data.messages[0];
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Date', 'Subject', 'To', 'From']
          });

          const headers = fullMessage.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const to = headers.find(h => h.name === 'To')?.value || '';

          console.log(`   ✅ Found email sent to: ${candidateEmail}`);
          console.log(`      Subject: "${subject}"`);

          return {
            wasSent: true,
            messageId: message.id,
            subject: subject,
            sentDate: headers.find(h => h.name === 'Date')?.value,
            to: to,
            verifiedByEmail: true
          };
        }
      }

      // Secondary search: Search by subject pattern "Enhancement Proposal for {name}"
      console.log(`      Query: in:sent from:me "Enhancement Proposal for ${cleanName}"`);

      const subjectQuery = `in:sent from:me "Enhancement Proposal for ${cleanName}"`;
      const subjectResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: subjectQuery,
        maxResults: 10
      });

      if (subjectResponse.data.messages && subjectResponse.data.messages.length > 0) {
        const message = subjectResponse.data.messages[0];
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['Date', 'Subject', 'To', 'From']
        });

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const to = headers.find(h => h.name === 'To')?.value || '';

        console.log(`   ✅ Found email sent to: ${cleanName}`);
        console.log(`      Subject: "${subject}"`);
        console.log(`      To: ${to}`);

        return {
          wasSent: true,
          messageId: message.id,
          subject: subject,
          sentDate: headers.find(h => h.name === 'Date')?.value,
          to: to,
          verifiedByEmail: false
        };
      }

      // Fallback: Try searching by name in To field
      console.log(`      Query: in:sent from:me to:${cleanName}`);

      const toQueryResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: `in:sent from:me to:${cleanName}`,
        maxResults: 10
      });

      if (toQueryResponse.data.messages && toQueryResponse.data.messages.length > 0) {
        const message = toQueryResponse.data.messages[0];
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['Date', 'Subject', 'To', 'From']
        });

        const headers = fullMessage.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const to = headers.find(h => h.name === 'To')?.value || '';

        console.log(`   ✅ Found email sent to: ${cleanName}`);
        console.log(`      Subject: "${subject}"`);

        return {
          wasSent: true,
          messageId: message.id,
          subject: subject,
          sentDate: headers.find(h => h.name === 'Date')?.value,
          to: to,
          verifiedByEmail: false
        };
      }

      console.log(`   ⏭️  No sent email found for: ${cleanName}`);
      return { wasSent: false, reason: 'No email found with candidate name' };

    } catch (error) {
      console.error('❌ Search by name failed:', error.message);
      return { wasSent: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * ✅ NEW: Search for "Dear {candidateName}" in email body of recent sent emails
   * This is the MOST ACCURATE method for Step 10 and Step 11 follow-up verification
   * Gmail doesn't support direct body search via query, so we fetch and check manually
   *
   * @param {string} candidateName - Full name of the candidate (e.g., "Tanvi Goel")
   * @returns {object} - { wasSent: boolean, messageId, subject, sentDate }
   */
  async findEmailByDearNameInBody(candidateName) {
    try {
      if (!this.isInitialized) {
        throw new Error('Gmail checker not initialized');
      }

      const cleanName = candidateName.trim();
      if (!cleanName || cleanName.length < 2) {
        console.log(`   ⚠️  Invalid name: "${candidateName}"`);
        return { wasSent: false, reason: 'Invalid name' };
      }

      console.log(`   🔍 Searching Gmail body for "Dear ${cleanName}"...`);

      // Extract first name and last name for matching
      const nameParts = cleanName.split(' ').filter(part => part.length > 1);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      // Create variations of "Dear {name}" to search for
      const dearPatterns = [
        `Dear ${cleanName}`,
        `Dear ${cleanName.toLowerCase()}`,
        `Dear ${firstName}`,
        `Dear ${firstName.toLowerCase()}`,
        `Hi ${cleanName}`,
        `Hi ${cleanName.toLowerCase()}`,
        `Hi ${firstName}`,
        `Hello ${cleanName}`,
        `Hello ${firstName}`
      ];

      // ✅ INCREASED: Fetch more sent emails to find older candidates
      console.log(`      Fetching recent sent emails...`);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'in:sent from:me',
        maxResults: 500 // ✅ Increased from 100 to 500
      });

      const messages = response.data.messages || [];
      console.log(`      Checking ${messages.length} sent emails...`);

      if (messages.length === 0) {
        console.log(`   ⏭️  No sent emails found`);
        return { wasSent: false, reason: 'No sent emails found' };
      }

      // Check each email for "Dear {name}" pattern
      let checkedCount = 0;
      for (const msg of messages) {
        checkedCount++;

        try {
          const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          // Get email headers
          const headers = message.data.payload.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const to = headers.find(h => h.name === 'To')?.value || '';

          // Get email body
          let body = '';
          if (message.data.payload.parts) {
            for (const part of message.data.payload.parts) {
              if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                break;
              }
            }
          } else if (message.data.payload.body && message.data.payload.body.data) {
            body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
          }

          // Search for any of the "Dear {name}" patterns
          for (const pattern of dearPatterns) {
            if (body.toLowerCase().includes(pattern.toLowerCase())) {
              console.log(`   ✅ FOUND! "Dear ${cleanName}" in email`);
              console.log(`      Subject: "${subject}"`);
              console.log(`      To: ${to}`);
              console.log(`      MessageId: ${msg.id}`);

              return {
                wasSent: true,
                messageId: msg.id,
                subject: subject,
                sentDate: headers.find(h => h.name === 'Date')?.value,
                to: to,
                verifiedByBody: true,
                matchedPattern: pattern
              };
            }
          }

          // Also check if To field contains the candidate's email or name
          const toLower = to.toLowerCase();
          const cleanNameLower = cleanName.toLowerCase();
          const firstNameLower = firstName.toLowerCase();

          // Check if To contains the candidate name or a reasonable match
          if (toLower.includes(cleanNameLower) ||
              (firstName && toLower.includes(firstNameLower))) {
            // Check if subject contains our key patterns
            const subjectLower = subject.toLowerCase();
            const ourPatterns = [
              'enhancement proposal',
              'professional assessment',
              'resume & linkedin',
              'resume writing',
              'linkedin services',
              'resume critique'
            ];

            for (const pattern of ourPatterns) {
              if (subjectLower.includes(pattern)) {
                console.log(`   ✅ FOUND! Email to "${cleanName}" with our subject`);
                console.log(`      Subject: "${subject}"`);
                console.log(`      To: ${to}`);

                return {
                  wasSent: true,
                  messageId: msg.id,
                  subject: subject,
                  sentDate: headers.find(h => h.name === 'Date')?.value,
                  to: to,
                  verifiedBySubject: true,
                  matchedPattern: pattern
                };
              }
            }
          }

        } catch (msgError) {
          // Continue on individual message errors
          console.warn(`      Warning: Could not read message ${msg.id}: ${msgError.message}`);
        }

        // Rate limiting - be nice to Gmail API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`   ⏭️  Checked ${checkedCount} emails, no match found for: ${cleanName}`);
      return { wasSent: false, reason: 'No email found with "Dear {name}" pattern' };

    } catch (error) {
      console.error('❌ Body search failed:', error.message);
      return { wasSent: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Enhanced version that tries all methods and returns the best result
   * Use this for Step 10 and Step 11 follow-up verification
   *
   * @param {string} candidateName - Full name of the candidate
   * @param {string} candidateEmail - Optional email address
   * @returns {object} - { wasSent: boolean, messageId, subject, sentDate, ... }
   */
  async findOurEmail(candidateName, candidateEmail = null) {
    console.log(`\n   📧 findOurEmail: Searching for email to "${candidateName}"`);

    // Method 1: Try by email address first (most accurate)
    if (candidateEmail) {
      console.log(`   Method 1: Search by email address...`);
      const result = await this.findEmailByNameInBody(candidateName, candidateEmail);
      if (result.wasSent) return result;
    }

    // Method 2: Try by subject pattern
    console.log(`   Method 2: Search by subject pattern...`);
    const result2 = await this.findEmailByNameInBody(candidateName, null);
    if (result2.wasSent) return result2;

    // Method 3: Search by "Dear {name}" in body (most reliable for our use case)
    console.log(`   Method 3: Search by "Dear ${candidateName}" in body...`);
    const result3 = await this.findEmailByDearNameInBody(candidateName);
    if (result3.wasSent) return result3;

    // Method 4: ✅ NEW - Aggressive search by extracting potential email from name
    console.log(`   Method 4: Aggressive search by name patterns...`);
    const result4 = await this.aggressiveNameSearch(candidateName);
    if (result4.wasSent) return result4;

    // No email found
    console.log(`   ❌ No email found for: ${candidateName}`);
    return { wasSent: false, reason: 'Email not found using any method' };
  }

  /**
   * ✅ NEW: Aggressive search for emails when normal methods fail
   * Searches by various name patterns and common email formats
   *
   * @param {string} candidateName - Full name of the candidate
   * @returns {object} - { wasSent: boolean, messageId, subject, sentDate }
   */
  async aggressiveNameSearch(candidateName) {
    try {
      const nameParts = candidateName.trim().split(' ').filter(p => p.length > 1);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

      // Generate various search queries
      const searchQueries = [
        // First name only
        `in:sent from:me to:${firstName}`,
        `in:sent from:me to:${firstName.toLowerCase()}`,
        // First + last name
        `in:sent from:me to:"${firstName} ${lastName}"`,
        `in:sent from:me to:${firstName} ${lastName}`,
        // First name + common email providers
        `in:sent from:me to:${firstName}@gmail.com`,
        `in:sent from:me to:${firstName}@yahoo.com`,
        `in:sent from:me to:${firstName}@hotmail.com`,
        // Last name only
        `in:sent from:me to:${lastName}`,
        // Name variations with different formats
        `in:sent from:me to:${firstName}.${lastName}`,
        `in:sent from:me to:${firstName}_${lastName}`,
      ];

      for (const query of searchQueries) {
        try {
          const response = await this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 10
          });

          if (response.data.messages && response.data.messages.length > 0) {
            // Get the most recent message
            const message = response.data.messages[0];
            const fullMessage = await this.gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['Date', 'Subject', 'To', 'From']
            });

            const headers = fullMessage.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
            const to = headers.find(h => h.name === 'To')?.value || '';

            // Verify this is our critique email by checking subject
            const subjectCheck = this.verifyEmailSubject(subject);
            if (subjectCheck.isValid || subject.toLowerCase().includes('resume') || subject.toLowerCase().includes('linkedin')) {
              console.log(`   ✅ Found via aggressive search: "${query}"`);
              console.log(`      Subject: "${subject}"`);
              console.log(`      To: ${to}`);

              return {
                wasSent: true,
                messageId: message.id,
                subject: subject,
                sentDate: headers.find(h => h.name === 'Date')?.value,
                to: to,
                verifiedByAggressiveSearch: true
              };
            }
          }
        } catch (queryError) {
          // Continue to next query
        }

        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return { wasSent: false, reason: 'No match found in aggressive search' };

    } catch (error) {
      console.error('❌ Aggressive search failed:', error.message);
      return { wasSent: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * ✅ NEW: Verify email body contains our signature indicators
   * Used to confirm the email is OUR critique email (not just any email)
   *
   * @param {string} messageId - Gmail message ID
   * @param {Array} indicators - Array of signature indicators to look for
   * @returns {object} - { hasSignature: boolean, matchCount, bodyPreview }
   */
  async verifyEmailSignature(messageId, indicators = ['RESUME CRITIQUE', 'professional assessment', 'Enhancement Proposal', 'service offerings', 'Pls review']) {
    try {
      if (!this.isInitialized) {
        throw new Error('Gmail checker not initialized');
      }

      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      // Get email body
      let body = '';
      if (message.data.payload.parts) {
        for (const part of message.data.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      } else if (message.data.payload.body && message.data.payload.body.data) {
        body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
      }

      const bodyLower = body.toLowerCase();

      // Check for each indicator
      let matchCount = 0;
      const foundIndicators = [];

      for (const indicator of indicators) {
        if (bodyLower.includes(indicator.toLowerCase())) {
          matchCount++;
          foundIndicators.push(indicator);
        }
      }

      // Check for our signature (Deepa Rajan)
      const hasSignature = bodyLower.includes('deepa rajan') ||
                          bodyLower.includes('deepa') ||
                          bodyLower.includes('regards');

      return {
        hasSignature: hasSignature,
        matchCount: matchCount,
        foundIndicators: foundIndicators,
        bodyPreview: body.substring(0, 500)
      };

    } catch (error) {
      console.error('❌ Signature verification failed:', error.message);
      return { hasSignature: false, matchCount: 0, error: error.message };
    }
  }

  /**
   * ✅ NEW: Verify email subject matches our critique email pattern
   * Accepts various subject formats used in our emails
   *
   * @param {string} subject - Email subject line
   * @returns {object} - { isValid: boolean, reason }
   */
  verifyEmailSubject(subject) {
    if (!subject) return { isValid: false, reason: 'No subject' };

    const subjectLower = subject.toLowerCase();

    // Accept various patterns used in our emails
    const validPatterns = [
      'enhancement proposal',
      'professional assessment',
      'resume & linkedin',
      'resume writing',
      'linkedin services',
      'resume critique'
    ];

    for (const pattern of validPatterns) {
      if (subjectLower.includes(pattern)) {
        return { isValid: true, reason: 'Valid subject pattern' };
      }
    }

    return { isValid: false, reason: `Subject doesn't match our patterns: ${subject}` };
  }
}

module.exports = { GmailSentChecker };

