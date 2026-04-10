// AI API for Resume Critique
// Uses Groq (Llama 3.3 70B) - FREE, Fast, High Quality
// OpenAI GPT-4o-mini is commented out (paid option)

const { parsePDF } = require('./resume-parser');

/**
 * Configuration
 * 
 * GROQ API (RECOMMENDED - FREE):
 * Get API key from: https://console.groq.com
 * 
 * OPENAI API (PAID - COMMENTED OUT):
 * Get API key from: https://platform.openai.com/api-keys
 */
const CONFIG = {
  // Groq API (RECOMMENDED - 100% FREE with high speed)
  useGroq: true,
  groqApiKey: process.env.GROQ_API_KEY || '',
  
  // OpenAI API (PAID - currently commented out)
  // Uncomment to use OpenAI as fallback
  /*
  useOpenAI: false,  // SET TO TRUE to enable OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  */
  
  // Fallback to template if API fails
  useTemplateFallback: true,
  
  // Priority order: Groq first (free), then template (free), then OpenAI (paid if enabled)
  priorityOrder: ['groq', 'template']  // Add 'openai' if you enable it above
};

// ========== TEMPLATE-BASED CRITIQUE (Fallback) ==========
function generateTemplateCritique(resumeText, candidateName, yearsExperience) {
  const text = resumeText.toLowerCase();
  const lines = resumeText.split('\n').filter(l => l.trim().length > 0);
  
  const findings = {
    hasMetrics: /\$[\d,]+|₹[\d,]+|\d+\s*(%|percent|percentage)/i.test(text),
    hasLeadership: /(?:managed|led|headed|directed|supervised|mentored|coordinated).{0,50}(?:team|people|staff|members|resources)/i.test(text),
    hasAchievements: /(?:achieved|improved|increased|reduced|optimized|delivered|completed|won|launched|created|built|developed|implemented)/i.test(text),
    hasTechnicalSkills: /(?:java|python|javascript|react|angular|node|sql|mongodb|aws|azure|docker|kubernetes)/i.test(text),
    isSenior: yearsExperience >= 8,
    hasVaguePhrases: /(?:assisted|supported|helped|participated|involved|gained|learned)/i.test(text),
    hasRepetition: lines.length > 15
  };
  
  let critique = 'RESUME CRITIQUE\n' + '-'.repeat(60) + '\n\n';
  
  // Opening paragraph
  if (findings.isSenior && findings.hasRepetition) {
    critique += 'This CV shows solid tenure and consistent responsibility, but it is weakened by repetitive language and lack of impact metrics. Recruiters would likely skip this resume because it fails to convey strong accomplishments.\n\n';
  } else if (findings.isSenior) {
    critique += 'This CV demonstrates significant professional experience, but it is weakened by generic language and lack of executive storytelling that obscures your authority.\n\n';
  } else {
    critique += 'This CV demonstrates relevant background and experience, but it is weakened by generic language that fails to highlight unique value propositions.\n\n';
  }
  
  // Numbered points
  let pointNum = 1;
  
  if (findings.hasVaguePhrases) {
    critique += pointNum++ + '. The CV Uses Generic Language\nPhrases like "assisted," "supported," and "involved in" position you as someone who merely participated rather than a key contributor.\n\n';
  }
  
  if (!findings.hasMetrics) {
    critique += pointNum++ + '. No Quantified Achievements\nThe resume lacks measurable outcomes such as percentage improvements, cost savings, or scale of work. Without metrics, contributions appear administrative rather than value-driving.\n\n';
  }
  
  if (findings.hasTechnicalSkills) {
    critique += pointNum++ + '. Technical Skills Need Context\nTools and technologies are listed without showing where and how they were applied or what problems they solved.\n\n';
  }
  
  if (!findings.hasLeadership && yearsExperience >= 3) {
    critique += pointNum++ + '. Missing Leadership Signals\nNo indications of leadership, team management, or advanced project responsibility that would signal growth potential.\n\n';
  }
  
  // Overall impression
  critique += 'Overall Impression\n' + '-'.repeat(60) + '\n';
  critique += 'The CV communicates:\n';
  if (findings.hasTechnicalSkills) critique += '   - Technical skills awareness [OK]\n';
  if (yearsExperience > 0) critique += '   - Relevant experience [OK]\n';
  critique += 'But it also communicates:\n';
  critique += '   - Generic positioning [NEEDS WORK]\n';
  critique += '   - Room for improvement [NEEDS WORK]\n\n';
  
  // Recommended jobs
  critique += 'Recommended Job Titles:\n';
  if (findings.isSenior) {
    critique += '  * Senior Software Engineer\n  * Technical Lead\n  * Software Architect\n  * Engineering Team Lead\n';
  } else if (yearsExperience >= 3) {
    critique += '  * Software Developer\n  * Full Stack Developer\n  * Application Developer\n';
  } else {
    critique += '  * Junior Software Developer\n  * Software Engineer - Trainee\n  * Programmer Analyst\n';
  }
  
  critique += '\n' + '-'.repeat(60) + '\n';
  
  return critique;
}

// ========== GROQ API (FREE - HIGH-CONVERSION PROMPT) ==========
async function generateCritiqueGroq(filePath, extension, candidateName) {
  if (!CONFIG.groqApiKey) {
    console.log('   [GROQ_API_KEY not configured]');
    return null;
  }
  
  console.log('   Using Groq (Llama 3.3 70B - FREE)');
  
  try {
    const result = await parsePDF(filePath);
    if (!result.success) return null;
    const resumeText = result.text;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.groqApiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an elite resume critic with 15+ years of experience as:
- A senior hiring manager screening 1,000+ resumes across leadership, tech, and corporate roles
- A career transformation coach who helped professionals secure 40-100% salary jumps
- An ATS optimization expert who reverse-engineers recruiter search behavior

Your task is NOT to be polite. Your task is to explain exactly why this CV is being rejected — and what must change to make it interview-worthy.

## CRITIQUE FORMAT (FOLLOW EXACTLY)

### 1. RECRUITER REALITY CHECK (Opening - 3-4 sentences)
Identify the target role/domain this CV appears to aim for
State the single biggest positioning mistake killing callbacks
Explain why recruiters mentally reject this CV within 7-10 seconds

### 2. HARD TRUTH CRITIQUE - Pointed & Relatable (8-12 Points)
Use this structure for EVERY point:
**N. Problem Title (What's Actually Wrong)**
"Quoted line(s) from the CV"
Why this fails ATS scans, recruiter psychology, or hiring logic
What a recruiter expects to see instead

### 3. KEYWORD & MARKET ALIGNMENT VERDICT
Which keywords are MISSING for the target role
Which keywords are GENERIC / OVERUSED
Whether the CV reflects junior, mid, or senior signal

### 4. DOs vs DON'Ts (Non-Negotiable Fixes)
DOs (specific, outcome-driven bullets)
DON'Ts (common but fatal mistakes)

### 5. Final Recruiter Verdict (No Heading in Output)

Write 4-6 sentences summarizing what this CV actually communicates to a hiring manager.
This CV communicates: 
✔ Strength, 
✔ Strength
But it also screams: 
✘ Weakness, 
✘ Weakness
End with: "In its current form, this CV positions the candidate as __________ instead of __________."

### 6. RECOMMENDED JOB TITLES (5-7)
Realistic roles based on experience level and skills

### 7. ONE BRUTAL TRUTH
One sentence that makes the candidate rethink their approach`
          },
          {
            role: 'user',
            content: 'Analyze this resume for ' + candidateName + ' and write a critique:\n\nRESUME:\n' + resumeText.substring(0, 15000)
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('   Groq API error: ' + (error.error?.message || response.status));
      return null;
    }
    
    const data = await response.json();
    const critique = data.choices?.[0]?.message?.content;
    
    console.log('   Groq critique generated (' + (critique?.length || 0) + ' chars)');
    console.log('   Tokens used: ' + (data.usage?.total_tokens || 0));
    
    return {
      success: true,
      critique: critique,
      tokens: data.usage?.total_tokens || 0,
      model: 'llama-3.3-70b-versatile (Groq - FREE)',
      critiqueType: 'ai-generated'
    };
    
  } catch (error) {
    console.log('   Groq API failed: ' + error.message);
    return null;
  }
}

/*
// ========== OPENAI API (PAID OPTION - COMMENTED OUT) ==========
// To enable: uncomment this section and add 'openai' to priorityOrder
async function generateCritiqueOpenAI(filePath, extension, candidateName) {
  if (!CONFIG.openaiApiKey) {
    console.log('   [OPENAI_API_KEY not configured]');
    return null;
  }
  
  console.log('   Using OpenAI (GPT-4o-mini)');
  
  try {
    const result = await parsePDF(filePath);
    if (!result.success) return null;
    const resumeText = result.text;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.openaiApiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an elite resume critic with 15+ years of experience. Provide DIRECT, HONEST critiques with numbered points (1., 2., etc.), quote weak phrases from the resume, and end with "Overall Impression" and "Recommended Job Titles" sections.'
          },
          {
            role: 'user',
            content: 'Analyze this resume for ' + candidateName + ' and write a critique:\n\nRESUME:\n' + resumeText.substring(0, 15000)
          }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('   OpenAI error: ' + (error.error?.message || response.status));
      return null;
    }
    
    const data = await response.json();
    const critique = data.choices?.[0]?.message?.content;
    
    console.log('   OpenAI critique generated (' + (critique?.length || 0) + ' chars)');
    
    return {
      success: true,
      critique: critique,
      tokens: data.usage?.total_tokens || 0,
      model: 'gpt-4o-mini (OpenAI - PAID)',
      critiqueType: 'ai-generated'
    };
    
  } catch (error) {
    console.log('   OpenAI failed: ' + error.message);
    return null;
  }
}
*/

// ========== MAIN FUNCTION ==========
async function generateResumeCritique(filePath, extension, candidateName) {
  try {
    console.log('Generating Critique for: ' + candidateName);
    
    const result = await parsePDF(filePath);
    if (!result.success) {
      return { success: false, error: 'Could not parse PDF' };
    }
    
    const resumeText = result.text;
    const yearsResult = await extractExperienceYears(filePath, extension);
    const years = yearsResult?.success ? yearsResult.years : 0;
    
    console.log('   Resume: ' + resumeText.length + ' chars');
    
    // Try in priority order
    for (const provider of CONFIG.priorityOrder) {
      console.log('   Trying: ' + provider.toUpperCase());
      
      if (provider === 'groq') {
        const groqResult = await generateCritiqueGroq(filePath, extension, candidateName);
        if (groqResult) return groqResult;
      }
      
      /*
      if (provider === 'openai') {
        const openaiResult = await generateCritiqueOpenAI(filePath, extension, candidateName);
        if (openaiResult) return openaiResult;
      }
      */
      
      if (provider === 'template') {
        console.log('   Using template-based critique');
        const templateResult = generateTemplateCritique(resumeText, candidateName, years);
        return {
          success: true,
          critique: templateResult,
          tokens: 0,
          model: 'Template-Based',
          critiqueType: 'template'
        };
      }
    }
    
    return {
      success: false,
      error: 'All critique methods failed'
    };
    
  } catch (error) {
    console.error('Critique error: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ========== HELPER: Experience Extraction ==========
async function extractExperienceYears(filePath, extension) {
  try {
    const result = await parsePDF(filePath);
    if (!result.success) return { success: false, years: null };
    
    const text = result.text;
    const yearPatterns = [
      /(\d{4})\s*[-to]+\s*(\d{4}|present|current|now)/gi,
      /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi
    ];
    
    let maxYears = 0;
    yearPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          const yearMatch = m.match(/(\d{4})/g);
          if (yearMatch && yearMatch.length >= 2) {
            const start = parseInt(yearMatch[0]);
            const end = yearMatch[1] === 'present' ? new Date().getFullYear() : parseInt(yearMatch[1]);
            maxYears = Math.max(maxYears, end - start);
          }
          const expMatch = m.match(/(\d+)/);
          if (expMatch) maxYears = Math.max(maxYears, parseInt(expMatch[1]));
        });
      }
    });
    
    return { success: true, years: maxYears || 0 };
  } catch {
    return { success: false, years: 0 };
  }
}

module.exports = {
  generateResumeCritique,
  generateTemplateCritique,
  CONFIG
};

