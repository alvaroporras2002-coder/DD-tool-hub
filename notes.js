(function () {
  'use strict';
  const KEY = 'ddhub.notes.v1';
  const questions = [
    ['goal', 'What Was Your Goal For This Call?', [
      ['Solve an Issue', 'Use when the call focuses on resolving a merchant support issue.'],
      ['Activate a Product', 'Use when helping the merchant activate a product or feature.'],
      ['Discover Growth Opportunity', 'Use when exploring how the merchant can grow their business.'],
      ['Improve Menu', 'Use when reviewing menu content, photos, pricing, or structure.'],
      ['Provide Active Campaign Visibility', 'Use when explaining performance or status of an existing campaign.'],
      ['Scheduled Check In', 'Use for a planned account check-in without another primary goal.'],
      ['Requested Call or Returning Missed Call', 'Use when responding to a merchant request or returning a missed call.']
    ]],
    ['priority', 'Priority For This Call', [
      ['P1 - Support - Immediate Blocker', 'Use for an issue that immediately prevents the merchant from operating or taking action.'],
      ['P2 - Marketing - Growth Opportunity', 'Use when the main priority is a marketing opportunity to grow sales.'],
      ['P3 - Optimization - Improve Setup', 'Use when improving the merchant setup, menu, or account configuration.'],
      ['P4 - No Growth Opportunity', 'Use when no growth opportunity is relevant to this interaction.']
    ]],
    ['growth', 'Growth Opportunity Identified or Discussed', [
      ['Yes', 'Use when you identified or discussed a specific opportunity for growth.'],
      ['No', 'Use when no growth opportunity was identified or discussed.']
    ]],
    ['education', 'MXP AI Assistant Education', [
      ['MX Educated During The Call', 'Use when you explained the Merchant Portal AI Assistant during this call.'],
      ['MX Was Educated On a Previous Interaction', 'Use when the merchant received this education in a previous interaction.'],
      ['Failed To Educate', 'Use when education was relevant but you were unable to provide it.'],
      ['Not Applicable', 'Use when AI Assistant education does not apply to this interaction.']
    ]],
    ['marketingReason', 'If Marketing Was Not Discussed, Why?', [
      ['Marketing Was Discussed', 'Use when marketing was part of the conversation.'],
      ['Not Relevant Today', 'Use when marketing was not relevant to the purpose of this call.'],
      ['Support Needed First', 'Use when a support issue needed attention before marketing.'],
      ['Menu Help Needed First', 'Use when menu work needed attention before marketing.'],
      ['No Decision-Maker', 'Use when the person authorized to make marketing decisions was unavailable.'],
      ['No Portal Access', 'Use when missing portal access prevented the marketing discussion.'],
      ['Follow-Up Requested', 'Use when the merchant asked to discuss marketing in a later interaction.'],
      ['Merchant Declined', 'Use when the merchant declined to discuss marketing.']
    ]],
    ['solution', 'Marketing Solution Discussed', [
      ['Ads For Visibility', 'Use when you discussed advertising to increase store visibility.'],
      ['Promotions For Orders', 'Use when you discussed a promotion to encourage orders.'],
      ['Loyalty For Repeat Customers', 'Use when you discussed loyalty to encourage customers to return.'],
      ['More Than One Solution', 'Use when the discussion covered more than one marketing solution.'],
      ['No Marketing Solution Discussed', 'Use when no marketing solution was discussed.']
    ]],
    ['cofunding', 'Co-Funding Status', [
      ['No Co-Funding Offered', 'Use when no co-funding offer was made.'],
      ['Co-Funding Offered - Denied', 'Use when the merchant declined a co-funding offer.'],
      ['Co-Funding Offered - Negotiating', 'Use when an offer is still being discussed or negotiated.'],
      ['Co-Funding Offered - Accepted', 'Use when the merchant accepted an offer that is not yet activated.'],
      ['Co-Funding Activated', 'Use when the co-funded campaign was activated.']
    ]],
    ['action', 'What Did You Do?', [
      ['Resolved It', 'Use when you resolved the issue during the call.'],
      ['Created or Escalated Case', 'Use when you created a case or escalated an issue for further support.'],
      ['Helped With Activation', 'Use when you assisted with activating a product or campaign.'],
      ['Presented Marketing Option', 'Use when you presented a marketing option to the merchant.'],
      ['Updated or Recommended Menu Change', 'Use when you changed the menu or recommended a menu improvement.'],
      ['Scheduled Follow-Up', 'Use when your main action was scheduling the next interaction.'],
      ['No Action Required', 'Use when no additional action was needed.']
    ]],
    ['result', 'Result', [
      ['Updated or Activated Campaign', 'Use when a campaign was updated or activated.'],
      ['Merchant Will Complete Action', 'Use when the merchant agreed to complete the next action.'],
      ['Merchant Declined', 'Use when the merchant declined the proposed action or solution.'],
      ['Discussed Marketing', 'Use when you discussed marketing without a more specific completed outcome.'],
      ['Follow-Up Needed (Identified Marketing Need)', 'Use when a marketing need was identified and needs a follow-up.'],
      ['Presented Solution (No Marketing)', 'Use when you presented a solution unrelated to marketing.'],
      ['Follow-Up Needed (No Marketing)', 'Use when a non-marketing issue needs a follow-up.'],
      ['Could Not Complete', 'Use when you could not complete the planned action.'],
      ['Not Applicable', 'Use when no listed outcome applies.']
    ]],
    ['achieved', 'Did You Achieve Your Goal', [
      ['Yes', 'Use when the goal for this call was fully achieved.'],
      ['Partially', 'Use when part of the goal was achieved and work remains.'],
      ['No', 'Use when the goal was not achieved.'],
      ['Follow-Up Needed', 'Use when another interaction is needed to achieve the goal.'],
      ['Not Applicable', 'Use when goal achievement does not apply to this interaction.']
    ]],
    ['blocker', 'If Not Achieved, What Stopped It?', [
      ['Nothing Stopped It', 'Use when no blocker prevented you from achieving the goal.'],
      ['No Decision Maker', 'Use when the decision maker was unavailable.'],
      ['No Portal Access or Technical Issue', 'Use when access or a technical issue prevented completion.'],
      ['Merchant Timing', 'Use when the merchant did not have time or preferred a later date.'],
      ['Priority Changed', 'Use when a different issue became the priority during the call.'],
      ['Program Not Available', 'Use when the required program or product was unavailable.'],
      ['Other', 'Use for another blocker; explain it in additional details.']
    ]]
  ];
  function emptyDraft() { return { id: '', merchant: '', caseId: '', details: '', answers: {}, updated: '' }; }
  function cleanDraft(value) {
    const d = emptyDraft();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return d;
    for (const k of ['id', 'merchant', 'caseId', 'details', 'updated']) if (typeof value[k] === 'string') d[k] = value[k].slice(0, k === 'details' ? 30000 : 500);
    for (const [key, , options] of questions) if (options.some(([v]) => v === value.answers?.[key])) d.answers[key] = value.answers[key];
    return d;
  }
  let root, state, H;
  const esc = value => H.escape(String(value ?? ''));
  const count = d => questions.filter(([key]) => d.answers[key]).length;
  const hasWork = d => !!(d.merchant.trim() || d.caseId.trim() || d.details.trim() || count(d));
  function buildNote(d) {
    if (!hasWork(d)) return '';
    const lines = [];
    if (d.merchant.trim()) lines.push('Merchant: ' + d.merchant.trim());
    if (d.caseId.trim()) lines.push('Case / store ID: ' + d.caseId.trim());
    if (lines.length) lines.push('');
    for (const [key, label] of questions) if (d.answers[key]) lines.push(label + ': ' + d.answers[key]);
    if (d.details.trim()) lines.push('', 'Additional details / next steps:', d.details.trim());
    return lines.join('\n');
  }
  function persist() {
    state.draft.updated = new Date().toISOString();
    const saved = H.save(KEY, state);
    root.querySelector('[data-notes-autosave]').textContent = saved === false ? 'No se pudo guardar. Descarga tu nota.' : 'Borrador guardado en este navegador';
    window.dispatchEvent(new Event('hub-data'));
    return saved !== false;
  }
  function update() {
    const n = count(state.draft), note = buildNote(state.draft);
    root.querySelector('[data-notes-count]').textContent = n + ' / 11 completed';
    root.querySelector('[data-notes-progress]').value = n;
    root.querySelector('[data-notes-preview]').value = note;
    root.querySelector('[data-notes-status]').textContent = n === 11 ? 'Ready to copy' : n ? 'Draft · ' + (11 - n) + ' responses remaining' : 'Your note updates automatically';
    root.querySelector('[data-notes-save]').disabled = !hasWork(state.draft);
    root.querySelector('[data-notes-copy]').disabled = !note;
    root.querySelector('[data-notes-download]').disabled = !note;
    root.querySelector('[data-notes-followup]').disabled = !note;
    for (const [key, , options] of questions) {
      const help = options.find(([v]) => v === state.draft.answers[key]);
      root.querySelector('[data-notes-help="' + key + '"]').textContent = help ? help[1] : 'Choose a response above to see when to use it.';
      root.querySelector('[data-notes-question="' + key + '"]').classList.toggle('notes-answered', !!help);
    }
  }
  function fillDraft() {
    for (const [key] of questions) root.querySelector('[data-notes-answer="' + key + '"]').value = state.draft.answers[key] || '';
    for (const key of ['merchant', 'caseId', 'details']) root.querySelector('[data-notes-field="' + key + '"]').value = state.draft[key];
    update();
  }
  function renderHistory() {
    const area = root.querySelector('[data-notes-history]');
    root.querySelector('[data-notes-history-count]').textContent = state.history.length;
    area.innerHTML = state.history.length ? state.history.map(d => {
      const date = new Date(d.updated);
      return '<article class="notes-history-item"><div><strong>' + esc(d.merchant || 'Untitled call') + '</strong><p class="muted">' + esc(Number.isNaN(date.valueOf()) ? '' : date.toLocaleString()) + ' · ' + count(d) + '/11' + (d.caseId ? ' · ' + esc(d.caseId) : '') + '</p></div><div class="notes-history-actions"><button class="btn" type="button" data-notes-open="' + esc(d.id) + '">Abrir</button><button class="btn notes-delete" type="button" data-notes-delete="' + esc(d.id) + '" aria-label="Eliminar nota de ' + esc(d.merchant || 'llamada') + '">Eliminar</button></div></article>';
    }).join('') : '<div class="notes-history-empty muted">Tus notas guardadas aparecerán aquí. El borrador se guarda automáticamente mientras escribes.</div>';
  }
  async function copyNote() {
    const note = buildNote(state.draft);
    if (!note) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(note);
      else {
        const area = root.querySelector('[data-notes-preview]');
        area.focus(); area.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      }
      H.toast('Nota copiada.');
    } catch { H.toast('Selecciona el texto de la nota y cópialo, o descárgalo.'); }
  }
  function saveNote() {
    if (!hasWork(state.draft)) return;
    const before = JSON.parse(JSON.stringify(state));
    if (!state.draft.id) state.draft.id = 'note-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
    state.draft.updated = new Date().toISOString();
    const record = cleanDraft(state.draft);
    state.history = [record, ...state.history.filter(d => d.id !== record.id)].slice(0, 200);
    if (!persist()) { state = before; H.toast('No se pudo guardar. Descarga la nota para conservarla.'); return; }
    renderHistory(); H.toast('Nota guardada en el historial.');
  }
  function init(element) {
    root = element; H = window.Hub;
    const loaded = H.load(KEY, {});
    state = { draft: cleanDraft(loaded?.draft), history: [] };
    const ids = new Set();
    if (Array.isArray(loaded?.history)) for (const value of loaded.history.slice(0, 200)) {
      const d = cleanDraft(value);
      if (d.id && !ids.has(d.id) && hasWork(d)) { state.history.push(d); ids.add(d.id); }
    }
    root.innerHTML = '<div class="notes-layout"><section class="card notes-form"><div class="notes-heading"><div><span class="notes-eyebrow">CALL DOCUMENTATION</span><h2>Document your call</h2><p class="muted">Choose one response per question. Your note updates automatically.</p></div><span class="badge" data-notes-count>0 / 11 completed</span></div><progress class="notes-progress" max="11" value="0" data-notes-progress aria-label="Call documentation completion"></progress><div class="notes-context"><label class="field"><span>Merchant / account</span><input class="control" data-notes-field="merchant" maxlength="500" placeholder="Merchant name" autocomplete="organization"></label><label class="field"><span>Case / store ID <small class="muted">(optional)</small></span><input class="control" data-notes-field="caseId" maxlength="500" placeholder="Case or store ID"></label></div><div class="notes-questions">' + questions.map(([key, label, options], i) => '<div class="notes-question" data-notes-question="' + key + '"><label for="notes-' + key + '"><span class="notes-number">' + String(i + 1).padStart(2, '0') + '</span><span>' + esc(label) + '</span></label><select class="control" id="notes-' + key + '" data-notes-answer="' + key + '" aria-describedby="notes-help-' + key + '"><option value="">Select one response…</option>' + options.map(([v]) => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('') + '</select><div class="notes-help"><span>When to use</span><p id="notes-help-' + key + '" data-notes-help="' + key + '">Choose a response above to see when to use it.</p></div></div>').join('') + '</div><label class="field notes-details"><span>Additional details / next steps <small class="muted">(optional)</small></span><textarea class="control" rows="5" maxlength="30000" data-notes-field="details" placeholder="Merchant concerns, case ID, commitments, follow-up date…"></textarea></label><div class="notes-bottom"><span class="muted" data-notes-autosave>Borrador en este navegador</span><button class="btn" type="button" data-notes-reset>Nueva llamada</button></div></section><aside class="notes-side"><section class="card notes-preview-card"><div class="notes-preview-heading"><div><span class="notes-eyebrow">LIVE NOTE</span><h2>Tu nota, lista</h2></div><span class="notes-live-dot" aria-hidden="true"></span></div><p class="muted" data-notes-status>Your note updates automatically</p><label class="notes-preview-label" for="notes-preview">Nota generada</label><textarea id="notes-preview" class="control notes-preview" rows="18" data-notes-preview readonly placeholder="Selecciona las respuestas para construir tu nota de llamada."></textarea><div class="notes-preview-actions"><button class="btn primary" type="button" data-notes-copy>Copiar nota</button><button class="btn" type="button" data-notes-save>Guardar nota</button><button class="btn" type="button" data-notes-download>Descargar .txt</button><button class="btn notes-followup" type="button" data-notes-followup>Crear seguimiento ↗</button></div><p class="muted notes-storage-note">Tus notas se conservan en este navegador. Puedes descargarlas para tener una copia.</p></section><section class="card notes-history-card"><div class="notes-history-heading"><h2>Historial de notas</h2><span class="badge" data-notes-history-count>0</span></div><div data-notes-history></div></section></aside></div>';
    root.addEventListener('input', event => {
      const target = event.target;
      if (target.dataset.notesField) { state.draft[target.dataset.notesField] = target.value; persist(); update(); }
    });
    root.addEventListener('change', event => {
      const key = event.target.dataset.notesAnswer;
      if (key) { if (event.target.value) state.draft.answers[key] = event.target.value; else delete state.draft.answers[key]; persist(); update(); }
    });
    root.addEventListener('click', event => {
      const b = event.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-notes-copy')) copyNote();
      if (b.hasAttribute('data-notes-save')) saveNote();
      if (b.hasAttribute('data-notes-download')) H.download('call-note-' + (state.draft.merchant.trim().replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || 'draft') + '.txt', buildNote(state.draft), 'text/plain;charset=utf-8');
      if (b.hasAttribute('data-notes-followup')) window.dispatchEvent(new CustomEvent('hub-followup', { detail: { merchant: state.draft.merchant, notes: buildNote(state.draft) } }));
      if (b.hasAttribute('data-notes-reset') && (!hasWork(state.draft) || confirm('¿Comenzar una nueva llamada? El borrador actual se reemplazará. Guarda la nota en el historial si deseas conservarla.'))) { state.draft = emptyDraft(); persist(); fillDraft(); }
      if (b.dataset.notesOpen) {
        const note = state.history.find(d => d.id === b.dataset.notesOpen);
        if (note && (buildNote(note) === buildNote(state.draft) || !hasWork(state.draft) || confirm('¿Abrir esta nota y reemplazar el borrador actual?'))) { state.draft = cleanDraft(note); persist(); fillDraft(); H.toast('Nota abierta. Puedes editarla y volver a guardarla.'); }
      }
      if (b.dataset.notesDelete && confirm('¿Eliminar esta nota del historial?')) {
        const before = state.history; state.history = state.history.filter(d => d.id !== b.dataset.notesDelete);
        if (!persist()) { state.history = before; H.toast('No se pudo eliminar la nota guardada.'); } else { renderHistory(); H.toast('Nota eliminada del historial.'); }
      }
    });
    fillDraft(); renderHistory();
  }
  window.Notes = { init, questions, buildNote };
})();
