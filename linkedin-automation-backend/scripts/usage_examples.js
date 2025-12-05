// === USAGE EXAMPLES ===

// Example 1: Name extraction only (for greeting fill and state save)
const { getRecipientNameAndConfirmSend } = require('./getRecipientNameAndConfirmSend');

// Get name (use same value for both greeting and state)
const { name } = await getRecipientNameAndConfirmSend(page, dialog, cardInfo);
const recipientName = name || 'there';
const greeting = `Hello ${recipientName},`;
// ... fill proposal with greeting ...
// ... save to state: { recipient: recipientName, ... } ...

// Example 2: Name extraction + send confirmation
const result = await getRecipientNameAndConfirmSend(page, dialog, cardInfo, {
  performSend: true,
  proposalText: greeting + '\n\n' + proposalBody,
  submitButtonSelector: 'button[aria-label*="Send proposal"]',
  maxWaitForClose: 8000,
  retryOnce: true
});

console.log(`Detected recipient: ${result.name || 'null'} — sendStatus: ${result.sendStatus} — debugFiles: [${result.debugFiles.join(', ')}]`);

// Example 3: Integration into existing script (minimal diff)
// BEFORE (two separate reads):
// const cardName = extractFromCard(card);
// const dialogName = detectNameFromDialog(page, dialog);
// const greeting = `Hello ${dialogName || 'there'},`;
// ... later ...
// state.push({ recipient: cardName, ... });

// AFTER (single unified read):
const { name } = await getRecipientNameAndConfirmSend(page, dialog, cardInfo);
const recipientName = name || 'there';
const greeting = `Hello ${recipientName},`;
// ... later ...
state.push({ recipient: recipientName, ... }); // Same value!
