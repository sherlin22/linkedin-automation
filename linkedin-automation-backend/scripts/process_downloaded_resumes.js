/**
 * Process Downloaded Resumes
 * Parses resumes and applies your custom critique template
 * 
 * Usage: node scripts/process_downloaded_resumes.js
 * 
 * This script:
 * 1. Reads resumes from downloads/resumes/
 * 2. Parses PDF/DOCX files
 * 3. Applies custom critique template
 * 4. Saves critiques to critiques/ folder
 */

const groq = require('./helpers/groq-client');
const { parsePDF } = require('./helpers/resume-parser');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  resumesDir: 'downloads/resumes',
  critiquesDir: 'critiques',
  outputJson: 'critiques/summary.json',
  useAI: false  // Set true to use Groq AI instead of template
};

/**
 * Get all resume files from downloads directory
 */
function getResumeFiles() {
  if (!fs.existsSync(CONFIG.resumesDir)) {
    console.log(`❌ Directory not found: ${CONFIG.resumesDir}`);
    return [];
  }

  const files = fs.readdirSync(CONFIG.resumesDir);
  return files
    .filter(f => f.match(/\.(pdf|docx|txt)$/i))
    .map(f => path.join(CONFIG.resumesDir, f));
}

/**
 * Parse resume file based on extension
 */
async function parseResume(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.pdf') {
      const result = await parsePDF(filePath);
      return result.success ? result.text : null;
    } else if (ext === '.docx') {
      // For DOCX, you could use mammoth
      // For now, return null and skip
      console.log(`   ⚠️  DOCX parsing not implemented, skipping: ${path.basename(filePath)}`);
      return null;
    } else {
      // Try to read as text
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.log(`   ❌ Error parsing ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

/**
 * Process a single resume
 */
async function processResume(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📄 Processing: ${filename}`);

  // Parse resume
  const resumeText = await parseResume(filePath);
  if (!resumeText) {
    return {
      success: false,
      filename,
      error: 'Failed to parse resume'
    };
  }

  console.log(`   ✅ Parsed ${resumeText.length} characters`);

  // Extract candidate info
  const candidateName = groq.extractCandidateName(resumeText);
  const yearsExperience = groq.extractExperienceYears(resumeText);
  
  console.log(`   👤 Candidate: ${candidateName}`);
  console.log(`   📅 Experience: ${yearsExperience} years`);

  // Generate critique
  let critique;
  if (CONFIG.useAI) {
    console.log(`   🤖 Using Groq AI for critique...`);
    const aiResult = await groq.analyzeWithAI(resumeText, candidateName);
    if (aiResult.success) {
      critique = aiResult.content;
    } else {
      console.log(`   ⚠️  AI failed, falling back to template`);
      critique = groq.generateResumeCritique(resumeText, candidateName);
    }
  } else {
    console.log(`   📝 Using template-based critique...`);
    critique = groq.generateResumeCritique(resumeText, candidateName);
  }

  // Save critique
  const critiquePath = groq.saveCritique(candidateName, critique, CONFIG.critiquesDir);
  console.log(`   💾 Saved: ${path.basename(critiquePath)}`);

  return {
    success: true,
    filename,
    candidateName,
    yearsExperience,
    critiquePath,
    resumeLength: resumeText.length
  };
}

/**
 * Generate summary report
 */
function generateSummaryReport(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    candidates: results
      .filter(r => r.success)
      .map(r => ({
        name: r.candidateName,
        experience: r.yearsExperience,
        critiqueFile: path.basename(r.critiquePath)
      }))
  };

  // Save summary JSON
  fs.writeFileSync(CONFIG.outputJson, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Summary saved to: ${CONFIG.outputJson}`);

  return summary;
}

/**
 * Display results in console
 */
function displayResults(results) {
  console.log('\n' + '='.repeat(60));
  console.log('PROCESSING COMPLETE');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   • ${r.candidateName} (${r.yearsExperience} yrs) -> ${path.basename(r.critiquePath)}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   • ${r.filename}: ${r.error}`);
    });
  }

  console.log(`\n📁 Critiques saved to: ${CONFIG.critiquesDir}/`);
  console.log(`📊 Summary: ${CONFIG.outputJson}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('RESUME CRITIQUE PROCESSOR');
  console.log(`Mode: ${CONFIG.useAI ? 'AI-Powered' : 'Template-Based'}`);
  console.log('='.repeat(60));

  // Get resume files
  const files = getResumeFiles();
  
  if (files.length === 0) {
    console.log(`\n❌ No resume files found in ${CONFIG.resumesDir}`);
    console.log('   Add PDF or DOCX files to this directory and run again.');
    return;
  }

  console.log(`\n📁 Found ${files.length} resume(s)`);

  // Create critiques directory
  if (!fs.existsSync(CONFIG.critiquesDir)) {
    fs.mkdirSync(CONFIG.critiquesDir, { recursive: true });
  }

  // Process all resumes
  const results = [];
  for (const file of files) {
    const result = await processResume(file);
    results.push(result);
  }

  // Generate and display summary
  const summary = generateSummaryReport(results);
  displayResults(results);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  processResume,
  getResumeFiles,
  parseResume,
  CONFIG
};

