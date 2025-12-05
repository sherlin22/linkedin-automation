# Stage 3: Resume Processing & Email Automation

This script automates the final stage of your LinkedIn workflow: processing resume attachments, getting AI-powered critiques, and drafting personalized emails with dynamic pricing.

## Overview

The automation:
1. **Finds conversations** with resume attachments from prospects who received your proposal
2. **Downloads resumes** from LinkedIn messages
3. **Extracts metadata** (name, email, years of experience) from the resume
4. **Gets AI critique** using ChatGPT/AIPRM with your custom prompt
5. **Calculates pricing** dynamically based on experience level
6. **Drafts personalized emails** with critique and pricing

## Prerequisites

### 1. OpenAI API Key (Required)
You need an OpenAI API key to get resume critiques from ChatGPT.

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

Or pass it directly:
```bash
node scripts/step9_resume_to_email_loop.js --openaiKey="sk-your-key-here"
```

### 2. Google Drive API (Optional)
For uploading resumes to Drive, you'll need Google Drive credentials.

Place your `drive_credentials.json` in the project root.

## Usage

### Dry Run (Test Mode)
First, test without actually creating email drafts:

```bash
node scripts/step9_resume_to_email_loop.js \
  --auth=auth_state.json \
  --headful=true
```

### Live Run (Create Email Drafts)
When ready, add `--confirm=true` to actually create drafts:

```bash
node scripts/step9_resume_to_email_loop.js \
  --auth=auth_state.json \
  --headful=true \
  --confirm=true
```

### All Options

| Option | Default | Description |
|--------|---------|-------------|
| `--auth` | `auth_state.json` | LinkedIn authentication state file |
| `--state` | `resume_processing_state.json` | Tracks processed conversations |
| `--headful` | `true` | Show browser window (use `false` for headless) |
| `--confirm` | `false` | Actually create email drafts (dry-run if false) |
| `--max` | `10` | Maximum resumes to process per run |
| `--openaiKey` | `$OPENAI_API_KEY` | OpenAI API key for ChatGPT |
| `--browser` | `chromium` | Browser type (chromium/firefox/webkit) |
| `--slowMo` | `0` | Slow down automation (milliseconds) |

## Pricing Logic

The script automatically calculates pricing based on years of experience:

| Experience | Resume Writing | LinkedIn Optimization |
|-----------|---------------|---------------------|
| < 2 years | ₹2,000 | ₹2,000 |
| 2-4 years | ₹3,000 | ₹2,500 |
| 5-9 years | ₹4,000 | ₹3,500 |
| 10+ years | ₹5,000 | ₹4,000 |

## Email Template

The generated email includes:
- Personalized greeting with candidate name
- Dynamic pricing based on experience
- AI-powered resume critique (7-12 bullet points)
- Clear next steps and payment details
- LinkedIn Glossary Sheet reference

## Resume Critique Format

The ChatGPT prompt generates critiques with these sections:
- **Profile Headline** - Suggested improvement
- **Core Strengths & Skills** - Key areas to enhance
- **Experience** - Impact and achievements focus
- **Metrics & Evidence** - Data-driven improvements
- **Formatting & Readability** - Visual improvements
- **ATS & Keywords** - Applicant Tracking System optimization
- **Quick Wins** - 3 actionable steps for immediate improvement

## Output

### Email Drafts
Email drafts are saved to `/tmp/email_draft_*.txt` files containing:
- Recipient email (extracted from resume)
- Subject line with candidate name
- Full email body with critique and pricing

### State File
Processed conversations are tracked in `resume_processing_state.json` to avoid duplicates.

## Troubleshooting

### No OpenAI API Key
```
⚠️ No OpenAI API key provided. Skipping critique.
```
**Solution:** Set `OPENAI_API_KEY` environment variable or use `--openaiKey` flag.

### Email Not Found
```
• Email: Not found
• To: MANUAL_ENTRY_REQUIRED
```
**Solution:** The script couldn't extract an email from the resume. The draft is created but you'll need to manually add the recipient.

### Resume Download Failed
```
❌ Failed to download resume
```
**Solution:** The attachment link might be broken or require additional authentication. Try manually downloading first.

## Integration with Gmail (Future Enhancement)

Currently, email drafts are saved as text files. To integrate with Gmail API:

1. Enable Gmail API in Google Cloud Console
2. Download OAuth credentials
3. Update the `createGmailDraft` function to use Gmail API
4. Authenticate with Gmail

## Example Run

```bash
$ node scripts/step9_resume_to_email_loop.js --auth=auth_state.json --confirm=true

Using browser: chromium
Opening LinkedIn Messaging...
Found 15 conversation threads to check.

📋 Checking conversation with: Rahul Sharma
   ✓ Found resume attachment
   ✓ Downloaded resume: linkedin_resume_1234567890_Rahul_Resume.pdf
   • Name: Rahul Sharma
   • Email: rahul.sharma@email.com
   • Experience: 8 years
   • Pricing: Resume ₹4,000, LinkedIn ₹3,500
   • Getting resume critique from ChatGPT...
   ✅ Email draft created

==================================================
Run complete!
- Threads checked: 15
- Resumes processed: 8
```

## Notes

- The script respects previously processed conversations (won't duplicate)
- Add 2-4 second delays between conversations to appear human-like
- Resume parsing works best with text-based PDFs and DOCX files
- Scanned PDFs may not extract metadata correctly (manual review needed)

## Next Steps

After email drafts are created:
1. Review each draft in `/tmp/email_draft_*.txt`
2. Manually send via Gmail or your email client
3. Attach your proposal PDF to each email
4. Include the LinkedIn Glossary Sheet as mentioned in the email
