/**
 * Groq AI Client Module
 * Commands Groq API for LinkedIn Automation
 * 
 * Available Models (FREE via Groq):
 * - llama-3.3-70b-versatile (Recommended for complex tasks)
 * - llama-3.1-8b-instant (Fast, cost-effective)
 * - llama-3.2-11b-vision-preview (Vision support)
 * - llama-3.2-90b-vision-preview (High-quality vision)
 * 
 * Documentation: https://console.groq.com/docs/quickstart
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

/**
 * Groq Client Configuration
 */
const GROQ_CONFIG = {
  apiKey: process.env.GROQ_API_KEY || '',
  baseUrl: 'https://api.groq.com/openai/v1',
  models: {
    large: 'llama-3.3-70b-versatile',      // Complex reasoning, detailed analysis
    medium: 'llama-3.1-70b-versatile',      // Balanced performance
    fast: 'llama-3.1-8b-instant',           // Quick responses, simple tasks
    vision: 'llama-3.2-90b-vision-preview', // Image analysis
    smallVision: 'llama-3.2-11b-vision-preview'
  },
  defaultModel: 'llama-3.3-70b-versatile',
  maxTokens: 4000,
  temperature: 0.7
};

/**
 * Initialize Groq Client
 */
function initialize() {
  if (!GROQ_CONFIG.apiKey) {
    console.log('⚠️  GROQ_API_KEY not set in environment');
    console.log('   Get your API key from: https://console.groq.com');
    return false;
  }
  console.log('✅ Groq Client initialized with API key');
  return true;
}

/**
 * Make a chat completion request to Groq
 * @param {string} systemPrompt - System instruction
 * @param {string} userMessage - User input
 * @param {object} options - Additional options
 * @returns {object} Response with success status
 */
async function chat(systemPrompt, userMessage, options = {}) {
  const {
    model = GROQ_CONFIG.defaultModel,
    maxTokens = GROQ_CONFIG.maxTokens,
    temperature = GROQ_CONFIG.temperature,
    stream = false
  } = options;

  if (!GROQ_CONFIG.apiKey) {
    return {
      success: false,
      error: 'GROQ_API_KEY not configured',
      message: 'Get API key from https://console.groq.com'
    };
  }

  try {
    const response = await fetch(`${GROQ_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'API request failed',
        status: response.status
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0].message.content,
      usage: data.usage,
      model: model
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate resume critique using your custom template
 * @param {string} resumeText - Parsed resume text
 * @param {string} candidateName - Name of candidate
 * @returns {string} Formatted critique
 */
function generateResumeCritique(resumeText, candidateName = 'Candidate') {
  const text = resumeText.toLowerCase();
  
  // Analyze resume characteristics
  const analysis = {
    hasMetrics: /\$[\d,]+|₹[\d,]+|\d+\s*(%|percent|percentage)/i.test(text),
    hasLeadership: /(?:managed|led|headed|directed|supervised|mentored|coordinated).{0,50}(?:team|people|staff|members)/i.test(text),
    hasAchievements: /(?:achieved|improved|increased|reduced|optimized|delivered|completed|won|launched|created|built|developed|implemented)/i.test(text),
    hasTechnicalSkills: /(?:java|python|javascript|react|angular|node|sql|mongodb|aws|azure|docker|kubernetes|.net|c#|php|ruby|go|rust)/i.test(text),
    hasVaguePhrases: /(?:assisted|supported|helped|participated|involved|gained|learned)/i.test(text),
    isSenior: /(?:senior|lead|principal|staff|architect|head|director|manager|vp|chief)/i.test(text),
    hasBranding: /(?:summary|objective|profile|overview)/i.test(text),
    bulletCount: (resumeText.match(/[•\-\*]/g) || []).length,
    lineCount: resumeText.split('\n').filter(l => l.trim()).length
  };

  // Build critique based on template
  let critique = `${candidateName.toUpperCase()}\n`;
  critique += '─'.repeat(60) + '\n\n';

  // Point 1: Experience vs Positioning
  critique += `1. Strong Experience, Weak Positioning\n`;
  critique += `The résumé contains ${analysis.hasAchievements ? 'meaningful' : 'some'} experience, but the overall positioning does not clearly communicate the candidate's value. Instead of presenting a compelling professional narrative, the document reads like a record of activities and responsibilities. Recruiters and hiring managers look for impact, decision-making, and outcomes, which are currently ${analysis.hasMetrics ? 'partially' : 'under-'}emphasized.\n\n`;

  // Point 2: Professional Branding
  critique += `2. Lack of Clear Professional Branding\n`;
  critique += `The résumé ${analysis.hasBranding ? 'has a summary section but it' : 'does not'} establish a strong professional identity in the opening section. Without a clear headline or summary that defines expertise, strengths, and direction, the candidate's profile feels ${analysis.hasBranding ? 'generic' : 'undefined'} and difficult to differentiate.\n\n`;

  // Point 3: Achievements
  critique += `3. Achievements Are Present but Not Highlighted\n`;
  critique += `There are ${analysis.hasAchievements ? 'valuable accomplishments throughout' : 'limited standout accomplishments'} the résumé, but they are embedded within long paragraphs or routine job descriptions. Key outcomes such as improvements, optimizations, innovations, or contributions are ${analysis.hasMetrics ? 'partially' : 'not'} visually or structurally emphasized.\n\n`;

  // Point 4: Results vs Responsibilities
  critique += `4. Overemphasis on Responsibilities Instead of Results\n`;
  critique += `Most sections focus on what the candidate was responsible for rather than what was achieved. This creates the impression of passive involvement instead of ownership and accountability. ${analysis.hasMetrics ? 'There is some evidence of quantified results.' : 'Quantified results are missing.'}\n\n`;

  // Point 5: Leadership
  critique += `5. Leadership and Initiative Are Underrepresented\n`;
  critique += `The résumé ${analysis.hasLeadership ? 'shows some leadership signals' : 'does not clearly articulate'} leadership behaviors such as ownership, initiative, collaboration, or influence. ${analysis.isSenior ? 'Given the senior title, leadership should be more explicitly stated.' : 'Leadership experience may exist but is not clearly stated.'}\n\n`;

  // Point 6: Length
  critique += `6. Length and Information Density Reduce Effectiveness\n`;
  critique += `The résumé ${analysis.lineCount > 40 ? 'includes more information than necessary' : 'has reasonable length'}, which ${analysis.lineCount > 40 ? 'reduces clarity and focus' : 'generally maintains focus'}. Extended descriptions or repetitive content ${analysis.bulletCount > 25 ? 'can overwhelm the reader' : 'are generally managed'}\n\n`;

  // Point 7: Supporting Content
  critique += `7. Supporting Content Lacks Strategic Context\n`;
  critique += `Sections such as projects, publications, certifications, or additional work are listed without always explaining their relevance or impact. Without context, these elements appear informational rather than valuable.\n\n`;

  // Point 8: Overall Narrative
  critique += `8. Overall Narrative Needs Strategic Alignment\n`;
  critique += `The résumé ${analysis.isSenior ? 'should clearly guide the reader toward senior-level opportunities' : 'does not clearly guide the reader toward the candidate\'s next logical role'}. There is no strong storyline connecting skills, experience, and future potential.\n\n`;

  // Final Assessment
  critique += `FINAL ASSESSMENT\n`;
  critique += `─`.repeat(60) + '\n';
  critique += `This résumé reflects ${analysis.hasTechnicalSkills ? 'technical capability' : 'some capability'} and ${analysis.hasAchievements ? 'meaningful' : 'varying'} experience but lacks strategic presentation. Due to ${analysis.hasMetrics ? 'partial' : 'weak'} positioning, ${analysis.lineCount > 40 ? 'dense content' : 'variable density'}, and ${analysis.hasLeadership ? 'some' : 'limited'} emphasis on outcomes and leadership, the candidate's potential is ${analysis.hasMetrics ? 'partially' : 'not'} fully visible.\n\n`;

  // Key Recommendations
  critique += `KEY RECOMMENDATIONS\n`;
  critique += `─`.repeat(60) + '\n';
  critique += `• Introduce a strong opening summary that clearly defines professional value\n`;
  critique += `• Shift from responsibility-based descriptions to impact-driven achievements\n`;
  critique += `• Highlight leadership, ownership, and cross-functional collaboration\n`;
  critique += `• Reduce length and remove low-impact or repetitive content\n`;
  critique += `• Structure the résumé to tell a clear, forward-looking career story\n\n`;

  // Conclusion
  critique += `CONCLUSION\n`;
  critique += `─`.repeat(60) + '\n';
  critique += `This résumé does not suffer from a lack of experience or skill, but from how that experience is communicated. With improved structure, clarity, and outcome-focused storytelling, the same profile can compete more effectively and unlock higher-quality opportunities.\n`;

  return critique;
}

/**
 * Extract experience years from resume
 * @param {string} resumeText - Raw resume text
 * @returns {number} Years of experience
 */
function extractExperienceYears(resumeText) {
  const patterns = [
    /(\d{4})\s*[-–to]+\s*(\d{4}|present|current|now)/gi,
    /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi,
    /experience[:\s]*(\d+)\s*[-–to]*\s*(\d+)?/gi
  ];

  let maxYears = 0;

  patterns.forEach(pattern => {
    const matches = resumeText.match(pattern);
    if (matches) {
      matches.forEach(m => {
        const yearMatch = m.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 2) {
          const start = parseInt(yearMatch[0]);
          const end = yearMatch[1].toLowerCase() === 'present' || yearMatch[1].toLowerCase() === 'current' || yearMatch[1].toLowerCase() === 'now' 
            ? new Date().getFullYear() 
            : parseInt(yearMatch[1]);
          maxYears = Math.max(maxYears, end - start);
        }
        const expMatch = m.match(/(\d+)/);
        if (expMatch) maxYears = Math.max(maxYears, parseInt(expMatch[1]));
      });
    }
  });

  return maxYears || 0;
}

/**
 * Extract candidate name from resume
 * @param {string} resumeText - Raw resume text
 * @returns {string} Candidate name
 */
function extractCandidateName(resumeText) {
  const lines = resumeText.split('\n').filter(l => l.trim().length > 0);
  // First non-empty line is often the name
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Simple heuristic: name is short and doesn't contain special chars
    if (firstLine.length > 2 && firstLine.length < 50 && !/[@•\-\d]/.test(firstLine)) {
      return firstLine;
    }
  }
  return 'Candidate';
}

/**
 * Save critique to file
 * @param {string} candidateName - Name of candidate
 * @param {string} critique - Generated critique
 * @param {string} outputDir - Output directory
 */
function saveCritique(candidateName, critique, outputDir = 'critiques') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitizedName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  const filePath = path.join(outputDir, `critique_${sanitizedName}_${timestamp}.txt`);

  fs.writeFileSync(filePath, critique);
  return filePath;
}

/**
 * Command Groq to analyze resume (AI-powered alternative)
 * @param {string} resumeText - Parsed resume text
 * @param {string} candidateName - Name of candidate
 * @returns {object} Response with success status
 */
async function analyzeWithAI(resumeText, candidateName) {
  const systemPrompt = `You are an elite resume critic with 15+ years of experience as:
- A senior hiring manager reviewing 100+ resumes monthly
- A career coach who placed 500+ professionals in senior roles
- An ATS optimization expert

Provide DIRECT, HONEST critiques following this EXACT format:

1. **Opening Paragraph** (2-3 sentences)
   - What domain/experience the resume shows
   - The core problem preventing success
   - Why recruiters would skip this resume

2. **Numbered Critique Points** (6-10 points)
   Use this format:
   **N. Problem Title**
   - Quote weak phrases from resume with "quotation marks"
   - Explain why this is a problem
   - Be specific and honest

3. **Overall Impression**
The CV communicates:
   - [strength] ✔
   - [strength] ✔
   But it also communicates:
   - [weakness] ✘
   - [weakness] ✘

4. **Recommended Job Titles** (5-7 titles)
   • Job Title 1
   • Job Title 2
   • etc.

Keep each point brief but actionable. Be harsh but fair.`;

  const userPrompt = `Analyze this resume for ${candidateName}:

${resumeText.substring(0, 15000)}`;

  return await chat(systemPrompt, userPrompt);
}

/**
 * Batch process multiple resumes
 * @param {Array} resumes - Array of {name, text, path}
 * @param {boolean} useAI - Use AI for critique instead of template
 * @returns {Array} Results with critiques
 */
async function batchProcessResumes(resumes, useAI = false) {
  const results = [];

  for (const resume of resumes) {
    console.log(`Processing: ${resume.name}`);

    const critique = useAI 
      ? await analyzeWithAI(resume.text, resume.name)
      : generateResumeCritique(resume.text, resume.name);

    const filePath = saveCritique(resume.name, critique.content || critique, 'critiques');

    results.push({
      name: resume.name,
      path: resume.path,
      critiquePath: filePath,
      success: true
    });
  }

  return results;
}

/**
 * Test Groq API connection
 */
async function testConnection() {
  console.log('Testing Groq API connection...');
  
  if (!GROQ_CONFIG.apiKey) {
    return {
      success: false,
      error: 'GROQ_API_KEY not configured'
    };
  }

  const result = await chat(
    'You are a helpful assistant.',
    'Say "Groq API is working correctly!" if you receive this message.'
  );

  if (result.success) {
    console.log('✅ Groq API connected successfully');
    console.log(`   Model: ${result.model}`);
    console.log(`   Response: ${result.content.substring(0, 50)}...`);
  } else {
    console.log('❌ Groq API connection failed');
    console.log(`   Error: ${result.error}`);
  }

  return result;
}

/**
 * Get available models from Groq
 */
function getAvailableModels() {
  return {
    'llama-3.3-70b-versatile': {
      description: 'Large, versatile model for complex reasoning',
      bestFor: 'Detailed analysis, complex summarization, coding',
      context: '128K tokens'
    },
    'llama-3.1-70b-versatile': {
      description: 'Balanced performance and speed',
      bestFor: 'General purpose tasks',
      context: '128K tokens'
    },
    'llama-3.1-8b-instant': {
      description: 'Fast, cost-effective model',
      bestFor: 'Quick responses, simple classifications',
      context: '128K tokens'
    },
    'llama-3.2-90b-vision-preview': {
      description: 'High-quality vision model',
      bestFor: 'Image analysis, document understanding',
      context: '128K tokens'
    },
    'llama-3.2-11b-vision-preview': {
      description: 'Lightweight vision model',
      bestFor: 'Simple image tasks',
      context: '128K tokens'
    }
  };
}

module.exports = {
  GROQ_CONFIG,
  initialize,
  chat,
  generateResumeCritique,
  extractExperienceYears,
  extractCandidateName,
  saveCritique,
  analyzeWithAI,
  batchProcessResumes,
  testConnection,
  getAvailableModels
};

