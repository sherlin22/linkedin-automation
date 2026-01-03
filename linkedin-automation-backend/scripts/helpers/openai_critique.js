// scripts/helpers/openai_critique.js - UPGRADED TO MATCH YOUR FORMAT
const { parsePDF } = require('./resume-parser');

/**
 * Generate professional resume critique matching the exact format from examples
 * Uses structured, numbered critique with specific weak phrase identification
 */
async function generateResumeCritique(filePath, extension, candidateName) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return {
        success: false,
        error: 'OpenAI API key not configured in .env file'
      };
    }
    
    console.log(`🤖 Generating Professional Critique for: ${candidateName}`);
    
    // Parse resume text
    let resumeText = null;
    
    if (extension.toLowerCase() === '.pdf') {
      const result = await parsePDF(filePath);
      if (result.success) {
        resumeText = result.text;
      } else {
        return {
          success: false,
          error: 'Could not parse PDF: ' + result.error
        };
      }
    } else {
      return {
        success: false,
        error: 'Only PDF files are supported'
      };
    }
    
    if (!resumeText || resumeText.trim().length < 100) {
      return {
        success: false,
        error: 'Resume text too short or empty'
      };
    }
    
    console.log(`   📝 Resume: ${resumeText.length} characters`);

    // ========== SYSTEM PROMPT (Defines the expert role) ==========
    const systemPrompt = `You are an elite resume critic with 15+ years of experience as:
- A senior hiring manager who reviews 100+ resumes per month
- A career coach who has placed 500+ professionals in senior roles
- An ATS (Applicant Tracking System) optimization expert

Your critiques are:
- Direct, honest, and constructive (no sugar-coating)
- Structured with clear numbered points
- Specific to the candidate's actual resume content
- Focused on market reality and hiring psychology
- Written in professional but straightforward English

CRITICAL FORMATTING RULES:
1. Start with a harsh but fair opening paragraph explaining why this resume isn't working
2. Use numbered points (1., 2., 3., etc.) for each major weakness
3. Bold the key problem in each point using this format: **Problem Title**
4. Quote weak phrases from their actual resume using "quotation marks"
5. End with "Recommended Job" section listing 4-6 specific job titles
6. Keep the tone professional but brutally honest
7. Focus on what's WRONG, not what to do (that comes in the email)

DO NOT:
- Use markdown headers (###, ##)
- Say "this CV is good" or give excessive praise
- Provide rewriting suggestions (just identify problems)
- Use bullet points (•) - use numbered points only
- Mention "ATS keywords" unless truly critical`;

    // ========== USER PROMPT (Specific instructions for this resume) ==========
    const userPrompt = `Analyze this resume for ${candidateName} using the EXACT format from the examples provided.

RESUME CONTENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${resumeText.substring(0, 20000)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR TASK:

Write a resume critique that follows this EXACT structure:

[Opening Paragraph]
One harsh but honest paragraph (3-4 sentences) explaining:
- What domain/experience the resume shows
- The core problem preventing success
- Why recruiters would skip this resume
- Use phrases like "This CV shows X, but it is weakened by Y"

[Numbered Critique Points]
Create 6-9 numbered points covering:

1. **The CV Positions You as [Problem]**
   Explain positioning issue, quote weak phrases like "assisted," "supported," etc.

2. **No Clear Differentiation from [Peer Group]**
   What's missing that makes them forgettable

3. **[Key Experience] Is Undersold**
   Identify strong experience that's poorly communicated

4. **Skills Section Is [Problem]**
   What's wrong with how skills are listed

5. **[Tool/Technology] Is Mentioned but Not Proven**
   Credibility gaps in technical claims

6. **[Section Name] Section [Problem]**
   Issues with specific resume sections

7. **Missing [Advanced Signal Type]**
   What senior markers are absent

8. **[Formatting/Structure Issue]**
   Readability or organization problems

9. **Overall Impression**
   Use this exact structure:
   "The CV communicates:
   - [strength] ✔
   - [strength] ✔
   But it also communicates:
   - [weakness] ✘
   - [weakness] ✘"

[Closing Statement]
One sentence about the gap between potential and presentation.

Recommended Job

[List 4-6 specific job titles relevant to their experience level and domain]

CRITICAL RULES:
- Quote actual weak phrases from THEIR resume (e.g., "assisted," "gained exposure")
- Be specific about what's missing (metrics, scale, authority)
- Focus on positioning psychology, not just content
- Match the professional but direct tone of the examples
- Use the EXACT "Overall Impression" format shown above`;

    console.log(`   📡 Calling OpenAI GPT-4o-mini with upgraded prompt...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.75, // Slightly creative but consistent
        max_tokens: 4000,
        top_p: 0.9
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', response.status);
      console.error('   Details:', errorText.substring(0, 200));
      
      return {
        success: false,
        error: `OpenAI API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    let critique = data.choices?.[0]?.message?.content;
    
    if (!critique) {
      return {
        success: false,
        error: 'No response from OpenAI'
      };
    }
    
    // Clean up the critique (remove any markdown artifacts)
    critique = critique
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*\*/g, '') // Remove triple asterisks
      .trim();
    
    console.log(`   ✅ Professional Critique Generated (${critique.length} chars)`);
    console.log(`   📊 Tokens Used: ${data.usage?.total_tokens || 0}`);
    console.log(`   💰 Cost: ~$${((data.usage?.total_tokens || 0) * 0.00015 / 1000).toFixed(4)}`);
    
    return {
      success: true,
      critique: critique,
      tokens: data.usage?.total_tokens || 0,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      model: 'gpt-4o-mini',
      critiqueType: 'professional-structured-format'
    };
    
  } catch (error) {
    console.error('❌ Critique generation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick critique for testing (lightweight alternative)
 */
async function generateQuickCritique(filePath, extension, candidateName) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }
    
    console.log(`⚡ Generating Quick Test Critique for: ${candidateName}`);
    
    const result = await parsePDF(filePath);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    const resumeText = result.text;
    
    const systemPrompt = `You are a direct resume evaluator. Provide quick honest feedback.

Format:
TOP 3 PROBLEMS:
1. [specific issue with quote]
2. [specific issue with quote]
3. [specific issue with quote]

BIGGEST FIX: [one critical action]

Recommended Job: [2-3 titles]`;

    const userPrompt = `Quick critique for ${candidateName}:\n\n${resumeText.substring(0, 10000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    const critique = data.choices?.[0]?.message?.content;
    
    console.log(`   ⚡ Quick critique ready`);
    
    return {
      success: true,
      critique: critique.trim(),
      tokens: data.usage?.total_tokens || 0,
      critiqueType: 'quick-test'
    };
    
  } catch (error) {
    console.error('❌ Quick critique error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateResumeCritique,  // Production critique matching your format
  generateQuickCritique    // Testing/debugging only
};