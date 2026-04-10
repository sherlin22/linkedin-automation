// scripts/helpers/validation-helpers.js - IMPROVED FOR INTERNATIONAL NAMES AND INITIALS

function isValidCandidateName(name) {
  // Defensive checks
  if (!name) return false;
  if (typeof name !== 'string') {
    console.warn('isValidCandidateName: name is not a string, got ' + typeof name + ': ' + name);
    return false;
  }

  var trimmed = name.trim();

  // Length checks
  if (trimmed.length < 2) return false;
  if (trimmed.length > 100) return false;

  // Exact invalid matches (case-insensitive check for these)
  var invalidNames = [
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
  var lowerTrimmed = trimmed.toLowerCase();
  for (var i = 0; i < invalidNames.length; i++) {
    if (lowerTrimmed === invalidNames[i].toLowerCase()) {
      console.log('   ⚠️  Rejected (invalid name list): "' + trimmed + '"');
      return false;
    }
  }

  // Pattern-based rejection (applied to lowercase version for flexibility)
  var invalidPatterns = [
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

  for (var p = 0; p < invalidPatterns.length; p++) {
    if (invalidPatterns[p].test(trimmed)) {
      console.log('   ⚠️  Rejected (pattern match): "' + trimmed + '" matches ' + invalidPatterns[p]);
      return false;
    }
  }

  // Split into words (handle multiple spaces)
  var words = trimmed.split(/\s+/).filter(function(w) { return w.length > 0; });

  // Word count check: 2-3 words
  if (words.length < 2 || words.length > 3) {
    console.log('   ⚠️  Rejected (word count ' + words.length + '): "' + trimmed + '"');
    return false;
  }

  // IMPROVED: More flexible name validation for international names, hyphens, and mixed caps
  // A valid name word can be:
  // 1. "John" - Capital + lowercase
  // 2. "JOHN" - All caps (e.g., from LinkedIn display)
  // 3. "O" - Single capital letter (initials, e.g., "BISOLA O")
  // 4. "O." - Single letter with period
  // 5. ".M" - Period-prefixed initial (e.g., "Sabesh .M" - space before period)
  // 6. "DSouza" - Mixed caps (camelCase like names - common in Indian names)
  // 7. "Cruz-Nuñez" - Hyphenated with accents (international names)
  // 8. "McDonald" - Prefix-style names
  // 9. "ashik" - Single lowercase word (if from LinkedIn, may be valid)

  // More permissive patterns for international names and initials
  var validWordPatterns = [
    /^[A-Z][a-zÀ-ÿ]+$/, // Normal: Capital + lowercase with accents
    /^[A-Z]+$/, // All caps (JOHN, SURAJ) - needs at least 1 letter
    /^[A-Z]\.?$/, // Single letter with optional period (O, O.)
    /^\.[A-Z]$/, // Period-prefixed initial (.M) - for names like "Sabesh .M"
    /^[A-Z][a-zÀ-ÿ]*[A-Z][a-zÀ-ÿ]*$/, // Mixed caps: McDonald, DSouza, LaCase
    /^[a-zÀ-ÿ]+$/ // All lowercase (ashik) - LinkedIn sometimes shows lowercase
  ];

  var invalidWords = words.filter(function(word) {
    // Check if word matches any valid pattern
    var isValid = validWordPatterns.some(function(pattern) { return pattern.test(word); });
    return !isValid;
  });

  // Allow hyphenated names like "Cruz-Nuñez" or "Mary-Jane"
  // and apostrophe names like "O'Brien"
  var trulyInvalid = invalidWords.filter(function(word) {
    var hasHyphen = word.indexOf('-') >= 0;
    var hasApostrophe = word.indexOf("'") >= 0;
    
    // If the word has hyphen or apostrophe, validate each part
    if (hasHyphen || hasApostrophe) {
      var parts = word.split(/[-']/);
      // Check each part of the hyphenated/apostrophe name
      return !parts.every(function(part) {
        if (part.length === 0) return true;
        // Each part should match one of the valid patterns
        return validWordPatterns.some(function(pattern) { return pattern.test(part); });
      });
    }
    return true; // Keep it as invalid if no hyphen/apostrophe
  });

  if (trulyInvalid.length > 0) {
    console.log('   ⚠️  Rejected (invalid word format): "' + trimmed + '" - invalid words: ' + trulyInvalid.join(', '));
    return false;
  }

  // No pure numbers as entire words
  var hasOnlyNumbers = words.some(function(word) { return /^\d+$/.test(word); });
  if (hasOnlyNumbers) {
    console.log('   ⚠️  Rejected (contains only numbers): "' + trimmed + '"');
    return false;
  }

  // Reject words with invalid special characters (only allow hyphen, apostrophe, period)
  var invalidCharPattern = /[!@#$%^&*()_+=,\[\]{};:"\\|/<>?`~]/;
  if (invalidCharPattern.test(trimmed)) {
    console.log('   ⚠️  Rejected (invalid characters): "' + trimmed + '"');
    return false;
  }
  
  if (trimmed === '=' || trimmed === '2' || trimmed === '1') {
    console.log('   ⚠️  Rejected (invalid symbol/number): "' + trimmed + '"');
    return false;
  }

  // Check minimum word length (at least one meaningful word)
  var hasMeaningfulLength = words.some(function(word) { return word.length >= 2; });
  if (!hasMeaningfulLength) {
    console.log('   ⚠️  Rejected (too short): "' + trimmed + '"');
    return false;
  }

  console.log('   ✅ Valid name: "' + trimmed + '"');
  return true;
}

function isValidProposalRecipient(name) {
  if (!isValidCandidateName(name)) return false;

  var businessTerms = [
    'For Business',
    'Small Business',
    'Large Business',
    'Enterprise',
    'Startup'
  ];

  for (var i = 0; i < businessTerms.length; i++) {
    if (name.toLowerCase() === businessTerms[i].toLowerCase()) {
      console.log('   ⚠️  Rejected (business term): "' + name + '"');
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
  var n1 = normalizeName(name1);
  var n2 = normalizeName(name2);

  if (n1 === n2) return true;
  if (n1.indexOf(n2) >= 0 || n2.indexOf(n1) >= 0) return true;

  var parts1 = n1.split(/\s+/);
  var parts2 = n2.split(/\s+/);

  if (parts1.length >= 2 && parts2.length >= 2) {
    if (parts1[0] === parts2[0] && parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
      return true;
    }
  }

  return false;
}

function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  var words = fullName.trim().split(/\s+/);
  return words[0] || '';
}

function getLastName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  var words = fullName.trim().split(/\s+/);
  return words[words.length - 1] || '';
}

// Test function to validate multiple names
function testNames(namesToTest) {
  namesToTest = namesToTest || [
    'John Smith',           // Normal
    'SURAJ SUNIL',          // All caps
    'LAXMI NARAYAN',        // All caps
    'BISOLA O.',            // Name with initial
    'JM Thennavan',         // Initials + name
    'Mary-Jane Watson',     // Hyphenated
    "Jean O'Brien",         // Apostrophe
    'Dylan DSouza',         // Mixed caps
    'Zinnia Cruz-Nuñez',    // Hyphenated with accent
    'Md ashik',             // Lowercase word
    'UNKNOWN',              // Invalid
    'For Business',         // Invalid
    'Resume Writing',       // Invalid
    'John',                 // Single word
    'A B C',                // Too many single letters
    '123 456'               // Numbers
  ];

  console.log('\n📋 NAME VALIDATION TEST');
  console.log('============================================================');
  
  for (var i = 0; i < namesToTest.length; i++) {
    var testName = namesToTest[i];
    var result = isValidCandidateName(testName);
    var status = result ? '✅ VALID' : '❌ INVALID';
    console.log(status + ': "' + testName + '"');
  }
  
  console.log('============================================================\n');
}

module.exports = {
  isValidCandidateName: isValidCandidateName,
  isValidProposalRecipient: isValidProposalRecipient,
  normalizeName: normalizeName,
  namesAreSimilar: namesAreSimilar,
  getFirstName: getFirstName,
  getLastName: getLastName,
  testNames: testNames
};

