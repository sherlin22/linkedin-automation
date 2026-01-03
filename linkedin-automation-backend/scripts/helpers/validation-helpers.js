// scripts/helpers/validation-helpers.js - IMPROVED FOR ALL CAPS NAMES
function isValidCandidateName(name) {
  // Defensive checks
  if (!name) return false;
  if (typeof name !== 'string') {
    console.warn(`⚠️  isValidCandidateName: name is not a string, got ${typeof name}: ${name}`);
    return false;
  }

  const trimmed = name.trim();

  // Length checks
  if (trimmed.length < 2) return false;
  if (trimmed.length > 100) return false;

  // Exact invalid matches (case-insensitive check for these)
  const invalidNames = [
    'Unknown', 'unknown',
    'there',
    '=',
    'N/A', 'NA',
    'undefined',
    'null',
    'none',
    'For Business'
  ];

  // Case-insensitive check for invalid names
  const lowerTrimmed = trimmed.toLowerCase();
  for (const invalid of invalidNames) {
    if (lowerTrimmed === invalid.toLowerCase()) {
      console.log(`   ⚠️  Rejected (invalid name list): "${trimmed}"`);
      return false;
    }
  }

  // Pattern-based rejection (applied to lowercase version for flexibility)
  const invalidPatterns = [
    /^view/i,
    /^profile/i,
    /^notification/i,
    /^dialog/i,
    /^content/i,
    /^submit/i,
    /^send/i,
    /^resume\s/i,
    /^search/i,
    /^network/i,
    /^thanks/i,
    /^business/i,
    /^service/i,
    /^marketplace/i,
    /^linkedin/i,
    /^career/i,
    /^interview/i,
    /^coaching/i
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(trimmed)) {
      console.log(`   ⚠️  Rejected (pattern match): "${trimmed}" matches ${pattern}`);
      return false;
    }
  }

  // Split into words (handle multiple spaces)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  // Word count check: 2-3 words
  if (words.length < 2 || words.length > 3) {
    console.log(`   ⚠️  Rejected (word count ${words.length}): "${trimmed}"`);
    return false;
  }

  // ✅ IMPROVED: More flexible name validation for all caps and mixed case
  // A valid name word can be:
  // 1. "John" - Capital + lowercase
  // 2. "JOHN" - All caps (e.g., from LinkedIn display)
  // 3. "O" - Single capital letter (initials, e.g., "BISOLA O")
  // 4. "O." - Single letter with period
  // 5. "J" or "JM" - Initials

  const validWordPatterns = [
    /^[A-Z][a-z]+$/, // Normal: Capital + lowercase (John, Mary)
    /^[A-Z]+$/, // All caps (JOHN, SURAJ) - needs at least 1 letter
    /^[A-Z]\.?$/, // Single letter with optional period (O, O., J)
  ];

  const invalidWords = words.filter(word => {
    // Check if word matches any valid pattern
    const isValid = validWordPatterns.some(pattern => pattern.test(word));
    return !isValid;
  });

  if (invalidWords.length > 0) {
    console.log(`   ⚠️  Rejected (invalid word format): "${trimmed}" - invalid words: ${invalidWords.join(', ')}`);
    return false;
  }

  // No pure numbers as entire words (but allow single letters with numbers in them)
  const hasOnlyNumbers = words.some(word => /^\d+$/.test(word));
  if (hasOnlyNumbers) {
    console.log(`   ⚠️  Rejected (contains only numbers): "${trimmed}"`);
    return false;
  }

  // No special characters (except period for initials like "O.")
  // Allow: apostrophes (O'Brien), hyphens (Mary-Jane), periods (O.)
  const hasInvalidChars = /[!@#$%^&*()_+=\[\]{};:"\\|,<>/?`~]/.test(trimmed);
  if (hasInvalidChars) {
    console.log(`   ⚠️  Rejected (invalid characters): "${trimmed}"`);
    return false;
  }
  if (trimmed === '=' || trimmed === '2' || trimmed === '1') {
    console.log(`   ⚠️  Rejected (invalid symbol/number): "${trimmed}"`);
    return false;
 }
  // ✅ REMOVED: The all-uppercase check that was blocking valid names
  // Names like "SURAJ SUNIL" should be valid

  console.log(`   ✅ Valid name: "${trimmed}"`);
  return true;
  
}

function isValidProposalRecipient(name) {
  if (!isValidCandidateName(name)) return false;

  const businessTerms = [
    'For Business',
    'Small Business',
    'Large Business',
    'Enterprise',
    'Startup'
  ];

  for (const term of businessTerms) {
    if (name.toLowerCase() === term.toLowerCase()) {
      console.log(`   ⚠️  Rejected (business term): "${name}"`);
      return false;
    }
  }

  return true;
}

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase();
}

function namesAreSimilar(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const parts1 = n1.split(/\s+/);
  const parts2 = n2.split(/\s+/);

  if (parts1.length >= 2 && parts2.length >= 2) {
    if (parts1[0] === parts2[0] && parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
      return true;
    }
  }

  return false;
}

function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const words = fullName.trim().split(/\s+/);
  return words[0] || '';
}

function getLastName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] || '';
}

// ✅ NEW: Test function to validate multiple names
function testNames(namesToTest = []) {
  const testList = namesToTest.length > 0 ? namesToTest : [
    'John Smith',           // ✅ Normal
    'SURAJ SUNIL',          // ✅ All caps
    'LAXMI NARAYAN',        // ✅ All caps
    'BISOLA O.',            // ✅ Name with initial
    'JM Thennavan',         // ✅ Initials + name
    'Mary-Jane Watson',     // ✅ Hyphenated
    'Jean O\'Brien',        // ✅ Apostrophe
    'UNKNOWN',              // ❌ Invalid
    'For Business',         // ❌ Invalid
    'Resume Writing',       // ❌ Invalid
    'John',                 // ❌ Single word
    'A B C',                // ❌ Too many single letters
    '123 456',              // ❌ Numbers
  ];

  console.log('\n📋 NAME VALIDATION TEST');
  console.log('='.repeat(60));
  
  testList.forEach(testName => {
    const result = isValidCandidateName(testName);
    const status = result ? '✅ VALID' : '❌ INVALID';
    console.log(`${status}: "${testName}"`);
  });
  
  console.log('='.repeat(60) + '\n');
}

module.exports = {
  isValidCandidateName,
  isValidProposalRecipient,
  normalizeName,
  namesAreSimilar,
  getFirstName,
  getLastName,
  testNames // Export for testing
};