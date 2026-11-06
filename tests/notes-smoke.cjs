const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<main id="notes"></main>');
    await page.evaluate(() => {
      window.recorded = {};
      window.Hub = {
        load: () => ({}),
        save: (key, value) => { window.recorded[key] = JSON.parse(JSON.stringify(value)); return true; },
        toast: () => {},
        escape: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        download: () => {}
      };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '..', 'notes.js'), 'utf8') });
    await page.evaluate(() => Notes.init(document.querySelector('#notes')));
    assert.equal(await page.locator('select').count(), 11);
    await page.locator('[data-notes-field="merchant"]').fill('<script>alert(1)</script>');
    await page.locator('[data-notes-field="caseId"]').fill('12345');
    const options = await page.evaluate(() => Notes.questions.map(([id, , opts]) => ({ id, value: opts[0][0] })));
    for (const { id, value } of options) await page.locator('[data-notes-answer="' + id + '"]').selectOption(value);
    assert.equal(await page.locator('[data-notes-count]').textContent(), '11 / 11 completed');
    const preview = await page.locator('[data-notes-preview]').inputValue();
    assert.match(preview, /What Was Your Goal For This Call\?: Solve an Issue/);
    assert.match(preview, /Co-Funding Status: No Co-Funding Offered/);
    assert.equal(await page.evaluate(() => Object.keys(window.recorded['ddhub.notes.v1'].draft.answers).length), 11);
    await page.locator('[data-notes-save]').click();
    assert.equal(await page.locator('[data-notes-history-count]').textContent(), '1');
    assert.equal(await page.locator('.notes-history-item script').count(), 0);
    await page.locator('[data-notes-field="details"]').fill('Call back tomorrow');
    await page.locator('[data-notes-save]').click();
    assert.equal(await page.locator('[data-notes-history-count]').textContent(), '1');
    await page.evaluate(() => { window.followUp = null; window.addEventListener('hub-followup', e => { window.followUp = e.detail; }); });
    await page.locator('[data-notes-followup]').click();
    assert.equal(await page.evaluate(() => window.followUp.notes.includes('Call back tomorrow')), true);
    page.on('dialog', d => d.accept());
    await page.locator('[data-notes-reset]').click();
    assert.equal(await page.locator('[data-notes-preview]').inputValue(), '');
    await page.locator('[data-notes-open]').click();
    assert.match(await page.locator('[data-notes-preview]').inputValue(), /Call back tomorrow/);
    await page.locator('[data-notes-delete]').click();
    assert.equal(await page.locator('[data-notes-history-count]').textContent(), '0');
    assert.deepEqual(errors, []);
    console.log('PASS notes: questions, progress, live note, persistence, history escaping, save/update, follow-up, reset/open/delete.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
