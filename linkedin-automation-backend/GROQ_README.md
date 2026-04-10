# Groq AI Integration for LinkedIn Automation

This module provides Groq API integration for your LinkedIn automation backend. Groq offers **FREE, fast inference** using Llama models.

## Quick Start

### 1. Get Your Groq API Key

1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up/Login with your Google or GitHub account
3. Click "Create API Key"
4. Copy your API key

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your API key
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Test the Integration

```bash
node scripts/test_groq.js
```

## Usage

### Basic Chat

```javascript
const groq = require('./scripts/helpers/groq-client');

// Simple chat
const result = await groq.chat(
  'You are a helpful assistant.',
  'Summarize this resume...'
);

if (result.success) {
  console.log(result.content);
}
```

### Resume Critique (Template-Based)

```javascript
const groq = require('./scripts/helpers/groq-client');

// Your custom critique template
const critique = groq.generateResumeCritique(resumeText, 'John Doe');

console.log(critique);
```

### AI-Powered Critique

```javascript
// Use Groq AI instead of template
const result = await groq.analyzeWithAI(resumeText, 'John Doe');
console.log(result.content);
```

### Batch Processing

```javascript
const resumes = [
  { name: 'John', text: '...', path: '/path/to/resume.pdf' },
  { name: 'Jane', text: '...', path: '/path/to/resume2.pdf' }
];

const results = await groq.batchProcessResumes(resumes, false);
```

## Available Models

| Model | Best For | Context |
|-------|----------|---------|
| `llama-3.3-70b-versatile` | Complex reasoning, detailed analysis | 128K |
| `llama-3.1-70b-versatile` | Balanced performance | 128K |
| `llama-3.1-8b-instant` | Quick responses, simple tasks | 128K |
| `llama-3.2-90b-vision-preview` | Image analysis | 128K |
| `llama-3.2-11b-vision-preview` | Lightweight vision tasks | 128K |

## Scripts

### Test Groq API

```bash
node scripts/test_groq.js
```

### Process Downloaded Resumes

```bash
node scripts/process_downloaded_resumes.js
```

This will:
1. Read resumes from `downloads/resumes/`
2. Parse PDF files
3. Apply your custom critique template
4. Save critiques to `critiques/` folder

## Custom Resume Critique Template

Your critique template includes 8 key evaluation points:

1. **Strong Experience, Weak Positioning** - Overall value proposition
2. **Lack of Clear Professional Branding** - Opening summary effectiveness
3. **Achievements Are Present but Not Highlighted** - Accomplishment visibility
4. **Overemphasis on Responsibilities Instead of Results** - Impact vs duties
5. **Leadership and Initiative Are Underrepresented** - Leadership signals
6. **Length and Information Density Reduce Effectiveness** - Clarity and focus
7. **Supporting Content Lacks Strategic Context** - Relevance of extras
8. **Overall Narrative Needs Strategic Alignment** - Career story coherence

Plus:
- **Final Assessment** - Overall evaluation
- **Key Recommendations** - Actionable improvements
- **Conclusion** - Summary statement

## Process Flow

```
Resume Downloaded
       ↓
[PDF/DOCX Parser]
       ↓
[Resume Text Extracted]
       ↓
[Groq Client Module]
       ↓
┌──────┴──────┐
↓             ↓
Template    AI-Powered
Critique    Critique
       ↓          ↓
       └────┬─────┘
            ↓
     [Critique Saved]
            ↓
    [Summary Report Generated]
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Your Groq API key |
| `OPENAI_API_KEY` | No | OpenAI (optional fallback) |
| `GOOGLE_CLIENT_ID` | No | Google Sheets logging |
| `PORT` | No | Server port (default: 3000) |

## Troubleshooting

### "GROQ_API_KEY not configured"

1. Get API key from https://console.groq.com
2. Add to `.env` file: `GROQ_API_KEY=your_key`
3. Restart your script

### API Rate Limiting

Groq has generous limits, but if you hit issues:
- Reduce batch size
- Add delays between requests
- Use `llama-3.1-8b-instant` for simpler tasks

### Resume Parsing Fails

- Ensure PDF is not password protected
- Check file is not corrupted
- Try converting DOCX to PDF first

## Benefits of Using Groq

✅ **100% FREE** - No costs for API usage  
✅ **Extremely Fast** - Sub-second response times  
✅ **High Quality** - Llama 3.3 70B is excellent for analysis  
✅ **No Rate Limits** - Generous free tier  
✅ **Easy Setup** - Simple API key authentication  

## Comparison: Groq vs OpenAI

| Feature | Groq | OpenAI |
|---------|------|--------|
| Cost | FREE | $0.01-0.06/1K tokens |
| Speed | Very Fast | Fast |
| Model | Llama 3.3 70B | GPT-4o-mini |
| Ease of Use | Same API format | Same API format |

**Recommendation**: Use Groq as your primary AI, with OpenAI as fallback if needed.

