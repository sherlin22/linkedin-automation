// config.js
// Central config for LinkedIn automation

module.exports = {
  // Daily limits
  DAILY_LIMIT: process.env.DAILY_LIMIT || 20,
  
  // Timing configuration (in milliseconds)
  TYPING_SPEED_MIN: 20,
  TYPING_SPEED_MAX: 120,
  ACTION_DELAY_MIN: 1200,
  ACTION_DELAY_MAX: 4500,
  FOLLOWUP_DELAY_HOURS: process.env.FOLLOWUP_DELAY_HOURS || 5,
  SUBMIT_CONFIRMATION_TIMEOUT: 8000,
  
  // File paths
  PAUSE_FILE: '/tmp/linkedin_pause',
  PID_LOCK_FILE: '/tmp/linkedin_automation.pid',
  DEBUG_ARTIFACTS_DIR: './debug_artifacts',
  
  // Pricing bands (experience years -> prices in INR)
  PRICING_BANDS: [
    { min: 0,  resume_price: 2500, linkedin_price: 2000 }, // 0-3 yrs
    { min: 4,  resume_price: 3000, linkedin_price: 2500 }, // 4-6 yrs
    { min: 6,  resume_price: 4000, linkedin_price: 2500 }, // 6-8 yrs
    { min: 8,  resume_price: 6000, linkedin_price: 3000 }, // 8-10 yrs
    { min: 10, resume_price: 7000, linkedin_price: 3500 }, // 10-12 yrs
    { min: 12, resume_price: 8000, linkedin_price: 4000 }  // 12+ yrs
  ],
  
  // LinkedIn selectors (update these if LinkedIn UI changes)
  SELECTORS: {
    requestCard: '[data-view-name="service-marketplace-request-card"]',
    ctaButton: 'button[aria-label*="proposal"], button:has-text("Submit proposal")',
    dialog: '[role="dialog"], .artdeco-modal',
    dialogEditor: 'textarea, div[contenteditable="true"]',
    submitButton: 'button[aria-label*="Send proposal"], button:has-text("Send")',
    messageInput: 'div[contenteditable="true"][role="textbox"]',
    attachmentLink: 'a[href*="download"], a[href*=".pdf"], a[href*=".doc"]'
  },
  
  // n8n webhook URLs (set via environment variables)
  N8N_WEBHOOK_PROPOSAL_SUBMITTED: process.env.N8N_WEBHOOK_PROPOSAL_SUBMITTED || 'http://localhost:5678/webhook/proposal-submitted',
  N8N_WEBHOOK_RESUME_RECEIVED: process.env.N8N_WEBHOOK_RESUME_RECEIVED || 'http://localhost:5678/webhook/resume-received',
  
  // OpenAI configuration
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',  // Fast and affordable model, falls back to gpt-3.5-turbo
  OPENAI_PROJECT_ID: process.env.OPENAI_PROJECT_ID,
  OPENAI_CRITIQUE_PROMPT: 'Give a powerful critique of the CV without using the keyword "summary".',
  CRITIQUE_START_DELIMITER: 'RESUME_CRITIQUE_START',
  CRITIQUE_END_DELIMITER: 'RESUME_CRITIQUE_END',
  
  // Google Drive configuration
  DRIVE_ROOT_FOLDER: 'LinkedIn_Automation',
  DRIVE_RESUMES_SUBFOLDER: 'Resumes',
  
  // Gmail configuration
  GMAIL_ATTACHMENT_PATH: './attachments/Linkedin Services_Glossary_2025.docx',
  
  // Google Sheet ID
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || '12u_5JfhijaYED8C1eYmtAkgwf-tR-z-9Sgl1-bVGoqs',
  
  // Proposal template
  PROPOSAL_TEMPLATE: `Hello {name},

Greetings!!!

Are you tired of your resume getting lost in the shuffle?

Did you know that 85% of resumes are rejected by Applicant Tracking Systems (ATS)?

As a seasoned career coach with 15+ years of experience, I help ambitious professionals like you craft ATS-friendly resumes and LinkedIn profiles that showcase your strengths and achievements.

Whether you're a C-level executive, leadership aspirant, or mid-career professional, my expert services will help you:

• Stand out in a competitive job market
• Increase your visibility to recruiters and hiring managers
• Boost your confidence and career growth

Ready to transform your career?

Let's get started!

Share your resume and contact details, and I'll be in touch to discuss how my personalized services can help you achieve your career goals.

Services Offered:
• Resume Writing
• LinkedIn Profile Optimization
• Career Coaching
• Interview Preparation

Looking forward to empowering your career success!

Cheers,
Deepa Rajan
Ph: 9036846673
Write to: deeparajan890@gmail.com`,

  FOLLOWUP_TEMPLATE: 'Pls share your Resume to proceed with further discussion',
  
  EMAIL_SUBJECT_TEMPLATE: 'Proposal & Resume Review — Next Steps for {candidate_name}',

  EMAIL_BODY_TEMPLATE: `Dear {candidate_name},

Greetings!!!

PFA the proposal attached with the details needed to proceed further with the services.

Pls share a confirmation on the services you opt-in for:
Resume Writing – Rs {resume_price}/- INR – (As per the Experience, Customised Resume with a Result Oriented approach attracting opportunities)
LinkedIn Optimisation – Rs {linkedin_price}/- INR – (Help you Position yourself and will make you stand out from the crowd)

To proceed, I've reviewed your resume and noticed areas for improvement that can significantly enhance its impact:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Profile Summary: Areas of improvement

RESUME_CRITIQUE_START
{resume_critique_text}
RESUME_CRITIQUE_END
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Steps

To proceed, kindly:
1. Confirm which services you would like to avail
2. Make an 80% advance payment to the details below:
   UPI: deepas2093@sbi
3. Fill out and return the attached LinkedIn Glossary Sheet

Excited to support your leadership journey and help you unlock high-level opportunities across IT infrastructure, service delivery, and enterprise systems.

Let's get started!

To Your Success,
Deepa Rajan
+91 9036846673`
};
