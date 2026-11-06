'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual shipped module. Expose its input validator only inside this
// isolated VM; no testing API is added to the browser application.
const source = fs.readFileSync(path.join(__dirname, '..', 'notes.js'), 'utf8');
const exportLine = 'window.Notes = { init, questions, buildNote };';
assert.equal(source.split(exportLine).length, 2, 'Locate the module export exactly once');
const context = vm.createContext({ window: {} });
vm.runInContext(source.replace(exportLine, 'window.Notes = { init, questions, buildNote, cleanDraft };'), context);
const { questions, buildNote, cleanDraft } = context.window.Notes;
const plain = value => JSON.parse(JSON.stringify(value));

const expected = [
  ['goal', 'What Was Your Goal For This Call?', [
    'Solve an Issue', 'Activate a Product', 'Discover Growth Opportunity',
    'Improve Menu', 'Provide Active Campaign Visibility', 'Scheduled Check In',
    'Requested Call or Returning Missed Call'
  ]],
  ['priority', 'Priority For This Call', [
    'P1 - Support - Immediate Blocker', 'P2 - Marketing - Growth Opportunity',
    'P3 - Optimization - Improve Setup', 'P4 - No Growth Opportunity'
  ]],
  ['growth', 'Growth Opportunity Identified or Discussed', ['Yes', 'No']],
  ['education', 'MXP AI Assistant Education', [
    'MX Educated During The Call', 'MX Was Educated On a Previous Interaction',
    'Failed To Educate', 'Not Applicable'
  ]],
  ['marketingReason', 'If Marketing Was Not Discussed, Why?', [
    'Marketing Was Discussed', 'Not Relevant Today', 'Support Needed First',
    'Menu Help Needed First', 'No Decision-Maker', 'No Portal Access',
    'Follow-Up Requested', 'Merchant Declined'
  ]],
  ['solution', 'Marketing Solution Discussed', [
    'Ads For Visibility', 'Promotions For Orders', 'Loyalty For Repeat Customers',
    'More Than One Solution', 'No Marketing Solution Discussed'
  ]],
  ['cofunding', 'Co-Funding Status', [
    'No Co-Funding Offered', 'Co-Funding Offered - Denied',
    'Co-Funding Offered - Negotiating', 'Co-Funding Offered - Accepted', 'Co-Funding Activated'
  ]],
  ['action', 'What Did You Do?', [
    'Resolved It', 'Created or Escalated Case', 'Helped With Activation',
    'Presented Marketing Option', 'Updated or Recommended Menu Change',
    'Scheduled Follow-Up', 'No Action Required'
  ]],
  ['result', 'Result', [
    'Updated or Activated Campaign', 'Merchant Will Complete Action', 'Merchant Declined',
    'Discussed Marketing', 'Follow-Up Needed (Identified Marketing Need)',
    'Presented Solution (No Marketing)', 'Follow-Up Needed (No Marketing)',
    'Could Not Complete', 'Not Applicable'
  ]],
  ['achieved', 'Did You Achieve Your Goal', ['Yes', 'Partially', 'No', 'Follow-Up Needed', 'Not Applicable']],
  ['blocker', 'If Not Achieved, What Stopped It?', [
    'Nothing Stopped It', 'No Decision Maker', 'No Portal Access or Technical Issue',
    'Merchant Timing', 'Priority Changed', 'Program Not Available', 'Other'
  ]]
];

assert.equal(questions.length, 11);
assert.deepEqual(plain(questions.map(([id, label, options]) => [id, label, options.map(([value]) => value)])), expected,
  'Every question and response must match the supplied call template, in order');
for (const [id, , options] of questions) {
  assert.equal(new Set(options.map(([value]) => value)).size, options.length, id + ' has unique response values');
  for (const [value, guidance] of options) {
    assert.ok(typeof guidance === 'string' && guidance.length > 20, 'Contextual guidance exists for ' + value);
  }
}

const blank = cleanDraft(null);
assert.equal(buildNote(blank), '', 'Empty draft must not create phantom note content');
assert.equal(buildNote(cleanDraft({ merchant: '  ', caseId: '\n', details: '\t', answers: {} })), '');

const selected = Object.fromEntries(expected.map(([id, , options]) => [id, options[0]]));
const completed = cleanDraft({ merchant: 'Example Restaurant', caseId: 'CASE-123', answers: selected, details: 'Call back Tuesday.' });
const completedNote = buildNote(completed);
assert.equal(completedNote,
  'Merchant: Example Restaurant\nCase / store ID: CASE-123\n\n' +
  expected.map(([id, label]) => label + ': ' + selected[id]).join('\n') +
  '\n\nAdditional details / next steps:\nCall back Tuesday.');
for (const [, label] of expected) {
  assert.equal(completedNote.split(label + ': ').length - 1, 1, 'No omitted or repeated label: ' + label);
}

// Every allowed response must survive draft validation and enter the note under
// the correct label. This also catches choices whose spelling drifts from the UI.
for (const [id, label, options] of expected) for (const value of options) {
  const draft = cleanDraft({ answers: { [id]: value } });
  assert.equal(buildNote(draft), label + ': ' + value);
}
const multiline = cleanDraft({
  merchant: '  Name <script>alert(1)</script>\nSecond line  ',
  caseId: ' CASE-42 ',
  answers: { result: 'Merchant Will Complete Action' },
  details: '  First step\nSecond step & <b>literal text</b>  '
});
assert.equal(buildNote(multiline),
  'Merchant: Name <script>alert(1)</script>\nSecond line\nCase / store ID: CASE-42\n\n' +
  'Result: Merchant Will Complete Action\n\nAdditional details / next steps:\nFirst step\nSecond step & <b>literal text</b>',
  'Multiline merchant and details remain literal text without stripping or executing content');

const malformed = cleanDraft({
  id: 123, merchant: { name: 'bad type' }, caseId: null, details: ['bad type'], updated: false,
  answers: { goal: 'Invented answer', priority: 'P1 - Support - Immediate Blocker', result: '<img onerror=alert(1)>', unknown: 'Yes', achieved: 1 }
});
assert.deepEqual(plain(malformed), {
  id: '', merchant: '', caseId: '', details: '', answers: { priority: 'P1 - Support - Immediate Blocker' }, updated: ''
}, 'Discard unknown choices, unknown answer keys, and non-string persisted fields');
assert.equal(buildNote(cleanDraft({ answers: { goal: 'Unknown answer' } })), '', 'Invalid persisted answers cannot create a note');
for (const value of [undefined, null, [], 'invalid draft', 5]) assert.deepEqual(plain(cleanDraft(value)), plain(blank));
for (const answers of [null, undefined, 7, 'not an answer map', []]) assert.deepEqual(plain(cleanDraft({ answers }).answers), {});
const long = cleanDraft({ id: 'x'.repeat(700), merchant: 'm'.repeat(700), caseId: 'c'.repeat(700), updated: 'u'.repeat(700), details: 'd'.repeat(35000) });
for (const field of ['id', 'merchant', 'caseId', 'updated']) assert.equal(long[field].length, 500, field + ' length bound');
assert.equal(long.details.length, 30000, 'Details length bound');

console.log('PASS notes unit: exact 11-question template, every response and guidance, complete/blank/multiline notes, persisted-data validation and length bounds.');
