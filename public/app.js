import { MEALS, WINES } from './lib/data.js';
import { checkDescription, checkPairing, allPass } from './lib/checks.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c != null && n.append(c));
  return n;
};

const blank = () => ({
  step: 1,
  mealId: MEALS[0].id,
  name: MEALS[0].name,
  course: MEALS[0].course,
  ingredientsText: MEALS[0].ingredients.join('\n'),
  description: '',
  aiDescription: '',
  descSource: '',
  pair: { wineId: 'none', reasons: ['', ''], note: '', source: '', ai: null, shown: false },
  approved: { 1: null, 2: null },
});
let S = blank();

// ---------- helpers ----------
const ingredients = () => {
  const t = S.ingredientsText.trim();
  const parts = /[\n;]/.test(t) ? t.split(/[\n;]+/) : t.split(',');
  return parts.map((p) => p.trim()).filter(Boolean);
};
const wineById = (id) => WINES.find((w) => w.id === id) || null;
const when = (d) => d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const say = (msg) => { $('status').textContent = ''; setTimeout(() => { $('status').textContent = msg; }, 30); };

function showAlert(id, msg) {
  const a = $(id);
  a.textContent = msg || '';
  a.hidden = !msg;
}

function renderChecks(listId, rows) {
  const ul = $(listId);
  ul.replaceChildren(
    ...rows.map((r) =>
      el('li', { 'data-ok': String(r.ok) },
        el('span', { class: 'mp-checks__mark', 'aria-hidden': 'true', text: r.ok ? '✓' : '!' }),
        el('span', {},
          el('span', { text: `${r.label}${r.ok ? '' : ' (needs attention)'}` }),
          r.detail ? el('span', { class: 'mp-checks__detail', text: r.detail }) : null))
    )
  );
}

async function post(payload) {
  const r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  let j = null;
  try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || !j?.ok) throw new Error(j?.message || 'Something went wrong. Try again, or write it yourself.');
  return j;
}

function busy(btn, on, label) {
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  if (on) {
    btn.dataset.html = btn.innerHTML;
    btn.replaceChildren(el('span', { class: 'mp-spin', 'aria-hidden': 'true' }), el('span', { text: label }));
  } else if (btn.dataset.html) {
    btn.innerHTML = btn.dataset.html; // static markup from index.html, not user text
    delete btn.dataset.html;
  }
}

// ---------- steps ----------
function reachable(n) { return n === 1 || (n === 2 && S.approved[1]) || (n === 3 && S.approved[2]); }

function setStep(n, focus = true) {
  S.step = n;
  for (const i of [1, 2, 3]) $(`panel-${i}`).hidden = i !== n;
  document.querySelectorAll('.mp-progress__item').forEach((b) => {
    const i = Number(b.dataset.step);
    b.disabled = !reachable(i);
    if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.dataset.done = String(Boolean(S.approved[i]));
  });
  if (n === 2) renderStep2();
  if (n === 3) renderStep3();
  if (focus) {
    const h = $(`h-${n}`);
    h.focus({ preventScroll: true });
    h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
}

function invalidate(from) {
  if (!S.approved[from] && !S.approved[2]) return;
  if (from <= 1) { S.approved[1] = null; S.pair = { wineId: 'none', reasons: ['', ''], note: '', source: '', ai: null, shown: false }; }
  S.approved[2] = null;
  say('Approval cleared because the text changed. Approve it again to continue.');
  setStep(S.step, false);
}

// ---------- step 1 ----------
function renderMeals() {
  const box = $('meal-choices');
  const items = [...MEALS.map((m) => ({ id: m.id, name: m.name, meta: m.course })), { id: 'custom', name: 'Enter your own', meta: 'Type a meal and ingredients' }];
  box.replaceChildren(...items.map((m) =>
    el('label', { class: 'mp-choice' },
      el('input', { type: 'radio', name: 'meal', value: m.id, checked: m.id === S.mealId }),
      el('span', { class: 'mp-choice__body' }, el('span', { class: 'mp-choice__name', text: m.name }), el('span', { class: 'mp-choice__meta', text: m.meta })))
  ));
}

function bindMeals() {
  $('meal-choices').addEventListener('change', (e) => {
    if (e.target.name !== 'meal') return;
    S.mealId = e.target.value;
    const m = MEALS.find((x) => x.id === S.mealId);
    if (m) { S.name = m.name; S.course = m.course; S.ingredientsText = m.ingredients.join('\n'); }
    else { S.name = ''; S.course = 'Main course'; S.ingredientsText = ''; }
    $('meal-name').value = S.name;
    $('ingredients').value = S.ingredientsText;
    resetDescription();
    invalidate(1);
    showAlert('alert-1', '');
    if (!m) $('meal-name').focus();
  });
}

function resetDescription() {
  S.description = ''; S.aiDescription = ''; S.descSource = '';
  $('description').value = '';
  $('desc-block').hidden = true;
}

function showDescription(text, source) {
  S.description = text; S.descSource = source;
  $('description').value = text;
  $('desc-block').hidden = false;
  updateDescription();
}

function updateDescription() {
  $('desc-source').textContent = S.descSource;
  const rows = checkDescription(S.description, ingredients());
  renderChecks('desc-checks', rows);
  const ok = allPass(rows);
  $('description').setAttribute('aria-invalid', String(!ok && S.description.length > 0));
  $('approve-1').disabled = !ok;
}

function validInputs() {
  if (!S.name.trim() || ingredients().length === 0) {
    showAlert('alert-1', 'Add a meal name and at least one ingredient first.');
    return false;
  }
  showAlert('alert-1', '');
  return true;
}

async function draft(btn) {
  if (!validInputs()) return;
  busy(btn, true, 'Drafting…');
  try {
    const j = await post({ task: 'description', name: S.name.trim(), ingredients: ingredients() });
    S.aiDescription = j.description;
    showDescription(j.description, 'AI drafted');
    invalidate(1);
    say('Draft ready. Review it and the checks below.');
    $('description').focus();
  } catch (e) {
    showAlert('alert-1', e.message);
  } finally {
    busy(btn, false);
  }
}

function bindStep1() {
  $('meal-name').value = S.name;
  $('ingredients').value = S.ingredientsText;
  $('meal-name').addEventListener('input', (e) => { S.name = e.target.value; invalidate(1); if (S.description) updateDescription(); });
  $('ingredients').addEventListener('input', (e) => { S.ingredientsText = e.target.value; invalidate(1); if (S.description) updateDescription(); });
  $('draft').addEventListener('click', (e) => draft(e.currentTarget));
  $('regen').addEventListener('click', (e) => draft(e.currentTarget));
  $('own').addEventListener('click', () => {
    if (!validInputs()) return;
    showDescription('', 'Written by reviewer');
    $('description').focus();
  });
  $('description').addEventListener('input', (e) => {
    S.description = e.target.value;
    if (S.aiDescription) S.descSource = S.description.trim() === S.aiDescription ? 'AI drafted' : 'AI drafted, edited by reviewer';
    invalidate(1);
    updateDescription();
  });
  $('reject').addEventListener('click', () => { resetDescription(); invalidate(1); say('Draft rejected and discarded.'); $('draft').focus(); });
  $('approve-1').addEventListener('click', () => {
    S.approved[1] = { at: new Date(), source: S.descSource, text: S.description };
    setStep(2);
    say('Description approved. Now choose a pairing.');
  });
}

// ---------- step 2 ----------
function renderStep2() {
  $('s2-name').textContent = S.name;
  $('s2-desc').textContent = S.approved[1]?.text || S.description;
  $('s2-by').textContent = S.approved[1] ? `Approved by the menu reviewer, ${when(S.approved[1].at)}. ${S.approved[1].source}.` : '';
  renderWines();
  const sel = $('pair-select');
  sel.replaceChildren(el('option', { value: 'none', text: 'No pairing' }), ...WINES.map((w) => el('option', { value: w.id, text: `${w.name} (${w.style})` })));
  sel.value = S.pair.wineId;
  $('reason-1').value = S.pair.reasons[0];
  $('reason-2').value = S.pair.reasons[1];
  $('pair-block').hidden = !S.pair.shown;
  updatePair();
}

function renderWines() {
  $('wine-list').replaceChildren(...WINES.map((w) =>
    el('li', { class: 'mp-wine', 'data-picked': String(S.pair.wineId === w.id) },
      el('div', { class: 'mp-wine__top' }, el('span', { class: 'mp-wine__name', text: w.name }), el('span', { class: 'pm-tag', text: w.style })),
      el('p', { class: 'mp-wine__notes', text: w.notes }))
  ));
}

function updatePair() {
  const wine = wineById(S.pair.wineId);
  $('pair-source').textContent = S.pair.source;
  $('reasons-block').hidden = !wine;
  const note = $('pair-note');
  note.textContent = !wine && S.pair.note ? S.pair.note : '';
  note.hidden = !(!wine && S.pair.note);
  const rows = checkPairing({ wine, reasons: S.pair.reasons, description: S.approved[1]?.text || S.description, ingredients: ingredients() });
  renderChecks('pair-checks', rows);
  $('approve-2').disabled = !allPass(rows);
  renderWines();
}

function showPair() { S.pair.shown = true; $('pair-block').hidden = false; updatePair(); }

async function suggest(btn) {
  busy(btn, true, 'Thinking…');
  try {
    const j = await post({ task: 'pairing', name: S.name.trim(), ingredients: ingredients(), description: S.approved[1].text });
    S.pair.ai = { wineId: j.wineId || 'none', reasons: j.reasons, note: j.note };
    S.pair.wineId = j.wineId || 'none';
    S.pair.reasons = [j.reasons[0] || '', j.reasons[1] || ''];
    S.pair.note = j.note || '';
    S.pair.source = 'AI suggested';
    showAlert('alert-2', '');
    $('pair-select').value = S.pair.wineId;
    $('reason-1').value = S.pair.reasons[0];
    $('reason-2').value = S.pair.reasons[1];
    showPair();
    say(j.wineId ? 'Pairing suggested. Review it before approving.' : 'The AI found no good match on this list. You can still pick a wine yourself.');
    $('pair-select').focus();
  } catch (e) {
    showAlert('alert-2', e.message);
  } finally {
    busy(btn, false);
  }
}

function markPairEdited() {
  if (S.pair.ai) {
    const same = S.pair.wineId === S.pair.ai.wineId && S.pair.reasons.every((r, i) => r.trim() === (S.pair.ai.reasons[i] || ''));
    S.pair.source = same ? 'AI suggested' : 'AI suggested, edited by menu owner';
  } else S.pair.source = 'Chosen by menu owner';
  S.approved[2] = null;
}

function bindStep2() {
  $('suggest').addEventListener('click', (e) => suggest(e.currentTarget));
  $('manual-pair').addEventListener('click', () => {
    S.pair = { wineId: 'none', reasons: ['', ''], note: '', source: 'Chosen by menu owner', ai: null, shown: true };
    showAlert('alert-2', '');
    renderStep2();
    $('pair-select').focus();
  });
  $('pair-select').addEventListener('change', (e) => { S.pair.wineId = e.target.value; S.pair.note = ''; markPairEdited(); updatePair(); });
  for (const [i, id] of [[0, 'reason-1'], [1, 'reason-2']]) {
    $(id).addEventListener('input', (e) => { S.pair.reasons[i] = e.target.value; markPairEdited(); updatePair(); });
  }
  $('approve-2').addEventListener('click', () => {
    S.approved[2] = { at: new Date(), source: S.pair.source || 'Chosen by menu owner' };
    setStep(3);
    say('Menu published.');
  });
  $('back-1').addEventListener('click', () => setStep(1));
}

// ---------- step 3 ----------
function renderStep3() {
  const wine = wineById(S.pair.wineId);
  const desc = S.approved[1].text;
  $('provenance').textContent = `Description: ${S.approved[1].source}, approved by the menu reviewer ${when(S.approved[1].at)}. Pairing: ${wine ? S.approved[2].source : 'none selected'}, approved by the menu owner ${when(S.approved[2].at)}.`;

  $('out-menu').replaceChildren(
    el('p', { class: 'mp-menu__course', text: S.course }),
    el('p', { class: 'mp-menu__choice', text: 'Choice of' }),
    el('p', { class: 'mp-menu__name', text: S.name }),
    el('p', { text: desc }),
    wine ? el('p', { class: 'mp-menu__pair', text: `Pairs with ${wine.name}.` }) : null
  );

  $('out-select').replaceChildren(
    el('div', { class: 'mp-select-card__row' },
      el('span', { class: 'mp-radio', 'aria-hidden': 'true' }),
      el('div', {},
        el('p', { class: 'mp-menu__name', text: S.name }),
        el('p', { text: desc }),
        wine ? el('p', { class: 'mp-select-card__pair', text: `Pairs well with ${wine.name}.` }) : null,
        wine ? el('details', {}, el('summary', { text: 'Why?' }), el('ul', {}, S.pair.reasons.map((r) => el('li', { text: r })))) : null))
  );

  $('out-read').replaceChildren(
    el('p', { class: 'mp-small' }, el('strong', { text: 'Ingredients: ' }), document.createTextNode(ingredients().join(', '))),
    wine ? el('p', { class: 'mp-small' }, el('strong', { text: `${wine.name}: ` }), document.createTextNode(wine.notes)) : el('p', { class: 'mp-small', text: 'No wine was paired.' })
  );
}

function bindStep3() {
  $('restart').addEventListener('click', () => {
    S = blank();
    $('meal-name').value = S.name;
    $('ingredients').value = S.ingredientsText;
    renderMeals();
    resetDescription();
    showAlert('alert-1', ''); showAlert('alert-2', '');
    setStep(1);
    say('Started over.');
  });
  $('back-2').addEventListener('click', () => setStep(2));
}

// ---------- shell ----------
function bindShell() {
  document.querySelectorAll('.mp-progress__item').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.step);
    if (reachable(n)) setStep(n);
  }));
  const theme = $('theme');
  const paint = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    theme.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    theme.querySelector('use').setAttribute('href', light ? '#pm-icon-moon' : '#pm-icon-sun');
  };
  theme.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mp-theme', next); } catch { /* storage can be blocked */ }
    paint();
  });
  paint();
}

async function loadIcons() {
  try {
    const t = await (await fetch('ds/icons.svg')).text();
    document.body.insertAdjacentHTML('afterbegin', t);
  } catch { /* icons are decorative */ }
}

renderMeals();
bindMeals();
bindShell();
bindStep1();
bindStep2();
bindStep3();
setStep(1, false);
loadIcons();
