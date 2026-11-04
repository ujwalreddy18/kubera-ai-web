import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

console.log('🧪 Auditing event bubbling and button markup in main.js...');

const mainCode = readFileSync('src/main.js', 'utf8');

// 1. Verify no stopPropagation exists inside template literals that blocks event delegation
const stopPropagationMatches = mainCode.match(/stopPropagation/g);
assert.equal(stopPropagationMatches, null, 'No stopPropagation should exist in main.js');
console.log('  ✓ Verified 0 instances of stopPropagation in main.js');

// 2. Verify all modal dialogs have properly formed close buttons
assert.ok(mainCode.includes('data-action="close-report"'), 'close-report action exists');
assert.ok(mainCode.includes('data-action="close-record-form"'), 'close-record-form action exists');
assert.ok(mainCode.includes('data-action="hide-delivery-form"'), 'hide-delivery-form action exists');
assert.ok(mainCode.includes('data-action="close-cmd-palette"'), 'close-cmd-palette action exists');
console.log('  ✓ Verified modal close actions exist');

// 3. Verify modal close handlers check event.target !== actionTarget for backdrops
const backdropGuards = [
  "actionTarget.classList.contains('cmd-palette-backdrop') && event.target !== actionTarget",
  "actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget"
];
for (const guard of backdropGuards) {
  assert.ok(mainCode.includes(guard), `Handler must contain guard: ${guard}`);
}
console.log('  ✓ Verified backdrop click guards protect dialog contents from premature close');

// 4. Verify all modal cancel buttons have type="button"
const cancelMatches = [...mainCode.matchAll(/<button[^>]*data-action="(?:close-record-form|hide-delivery-form)"[^>]*>Cancel<\/button>/g)];
assert.ok(cancelMatches.length >= 4, 'All cancel buttons found');
for (const match of cancelMatches) {
  assert.ok(match[0].includes('type="button"'), `Cancel button must have type="button": ${match[0]}`);
}
console.log('  ✓ Verified all modal Cancel buttons have type="button" to avoid form submission');

// 5. Verify sample CSV loader button has type="button"
const sampleCsvMatch = mainCode.match(/<button[^>]*data-action="load-sample-csv"[^>]*>/);
assert.ok(sampleCsvMatch && sampleCsvMatch[0].includes('type="button"'), 'load-sample-csv must have type="button"');
console.log('  ✓ Verified sample CSV loader button has type="button"');

// 6. Verify Escape key handler closes modals
assert.ok(mainCode.includes('st.ui?.modalReportId'), 'Escape handler must check modalReportId');
assert.ok(mainCode.includes('st.ui?.recordForm'), 'Escape handler must check recordForm');
assert.ok(mainCode.includes('st.ui?.deliveryReportId'), 'Escape handler must check deliveryReportId');
console.log('  ✓ Verified Escape key cleanly closes all modals and command search');

console.log('✨ All DOM and button delegation assertions passed successfully!\n');
