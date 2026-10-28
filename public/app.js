import { MEALS, WINES, SLOTS, PEOPLE } from './lib/data.js';
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

const SLOT_IDS = SLOTS.map((s) => s.id);
const slotLabel = (slot) => SLOTS.find((s) => s.id === slot).label;
const presets = (slot) => MEALS.filter((m) => m.slot === slot);

// ---------- state ----------
const mealBlank = (slot) => {
  const m = presets(slot)[0];
  return { mealId: m.id, name: m.name, ingredientsText: m.ingredients.join('\n'), description: '', aiDescription: '', descSource: '', approved: null };
};
const pairBlank = () => ({ wineId: 'none', reasons: ['', ''], note: '', source: '', ai: null, shown: false, approved: null });
const blank = () => ({ step: 1, meals: { main: mealBlank('main'), second: mealBlank('second') }, pair: pairBlank() });
let S = blank();
const R = {}; // review card elements, by slot

// ---------- helpers ----------
const ingredients = (slot) => {
  const t = S.meals[slot].ingredientsText.trim();
  const parts = /[\n;]/.test(t) ? t.split(/[\n;]+/) : t.split(',');
  return parts.map((p) => p.trim()).filter(Boolean);
};
const wineById = (id) => WINES.find((w) => w.id === id) || null;
const when = (d) => d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const say = (msg) => { $('status').textContent = ''; setTimeout(() => { $('status').textContent = msg; }, 30); };
const bothApproved = () => SLOT_IDS.every((s) => S.meals[s].approved);

function showAlert(node, msg) {
  node.textContent = msg || '';
  node.hidden = !msg;
}

function renderChecks(ul, rows) {
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
const stepDone = (n) => (n === 1 ? bothApproved() : n === 2 ? Boolean(S.pair.approved) : false);
const reachable = (n) => n === 1 || (n === 2 && bothApproved()) || (n === 3 && bothApproved() && Boolean(S.pair.approved));

function paintNav() {
  document.querySelectorAll('.mp-progress__item').forEach((b) => {
    const i = Number(b.dataset.step);
    b.disabled = !reachable(i);
    if (i === S.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.dataset.done = String(stepDone(i));
  });
  $('continue').disabled = !bothApproved();
  $('continue-hint').hidden = bothApproved();
}

function setStep(n, focus = true) {
  S.step = n;
  for (const i of [1, 2, 3]) $(`panel-${i}`).hidden = i !== n;
  if (n === 2) renderStep2();
  if (n === 3) renderStep3();
  paintNav();
  if (focus) {
    const h = $(`h-${n}`);
    h.focus({ preventScroll: true });
    h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
}

// Called whenever the text a reviewer approved has changed.
function invalidate(slot) {
  const m = S.meals[slot];
  const had = Boolean(m.approved) || (slot === 'main' && (S.pair.approved || S.pair.shown));
  m.approved = null;
  if (slot === 'main') S.pair = pairBlank();
  if (had) say('Approval cleared because the text changed. Approve it again to continue.');
  paintStatus(slot);
  updateDescription(slot);
  paintNav();
}

// ---------- step 1: meal table ----------
function renderTable() {
  const rows = SLOTS.map((slot) => {
    const m = S.meals[slot.id];
    const custom = m.mealId === 'custom';
    const sel = el('select', { class: 'mp-input mp-select', 'data-slot': slot.id, 'data-field': 'meal', 'aria-label': `${slot.label}: meal` },
      ...presets(slot.id).map((p) => el('option', { value: p.id, text: p.name, selected: m.mealId === p.id })),
      el('option', { value: 'custom', text: 'Enter your own…', selected: custom }));
    const name = custom
      ? el('input', { class: 'mp-input', type: 'text', maxlength: '60', autocomplete: 'off', value: m.name, 'data-slot': slot.id, 'data-field': 'name', 'aria-label': `${slot.label}: meal name`, placeholder: 'Meal name' })
      : null;
    const ing = el('textarea', { class: 'mp-input mp-textarea', rows: '5', maxlength: '600', 'data-slot': slot.id, 'data-field': 'ingredients', 'aria-label': `${slot.label}: ingredients, one per line` });
    ing.value = m.ingredientsText;
    return el('tr', { 'data-slot': slot.id },
      el('th', { scope: 'row', 'data-label': 'Course', text: slot.label }),
      el('td', { 'data-label': 'Meal' }, el('div', { class: 'mp-stack' }, sel, name)),
      el('td', { 'data-label': 'Ingredients' }, ing, el('p', { class: 'mp-hint', text: 'One per line' })),
      el('td', { 'data-label': 'Wine pairing' }, el('span', { class: 'pm-tag', text: slot.pairing ? 'Menu owner chooses' : 'None for this course' })));
  });
  $('meal-rows').replaceChildren(...rows);
}

function bindTable() {
  const body = $('meal-rows');
  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.field !== 'meal') return;
    const slot = t.dataset.slot;
    const m = S.meals[slot];
    const p = MEALS.find((x) => x.id === t.value);
    m.mealId = t.value;
    m.name = p ? p.name : '';
    m.ingredientsText = p ? p.ingredients.join('\n') : '';
    resetDescription(slot);
    invalidate(slot);
    showAlert(R[slot].alert, '');
    renderTable();
    paintMealNames();
    if (!p) body.querySelector(`[data-slot="${slot}"][data-field="name"]`)?.focus();
    else body.querySelector(`[data-slot="${slot}"][data-field="meal"]`)?.focus();
  });
  body.addEventListener('input', (e) => {
    const t = e.target;
    const slot = t.dataset.slot;
    if (!slot) return;
    const m = S.meals[slot];
    if (t.dataset.field === 'name') m.name = t.value;
    else if (t.dataset.field === 'ingredients') m.ingredientsText = t.value;
    else return;
    paintMealNames();
    invalidate(slot);
  });
}

function paintMealNames() {
  for (const slot of SLOT_IDS) R[slot].mealname.textContent = S.meals[slot].name || 'No meal name yet';
}

// ---------- step 1: review cards ----------
function buildCards() {
  const tpl = $('tpl-review');
  const out = SLOTS.map((slot) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const q = (r) => node.querySelector(`[data-role="${r}"]`);
    const r = { root: node };
    for (const k of ['title', 'mealname', 'status', 'draft', 'own', 'alert', 'block', 'desc-label', 'source', 'desc', 'checks', 'approve', 'regen', 'reject']) r[k] = q(k);
    r.descLabel = r['desc-label'];
    node.setAttribute('aria-labelledby', `rt-${slot.id}`);
    r.title.id = `rt-${slot.id}`;
    r.title.textContent = slot.label;
    r.desc.id = `rd-${slot.id}`;
    r.descLabel.htmlFor = r.desc.id;
    r.desc.setAttribute('aria-describedby', `rc-${slot.id}`);
    r.checks.id = `rc-${slot.id}`;
    R[slot.id] = r;
    bindCard(slot.id);
    return node;
  });
  $('reviews').replaceChildren(...out);
  paintMealNames();
}

function resetDescription(slot) {
  const m = S.meals[slot];
  m.description = ''; m.aiDescription = ''; m.descSource = '';
  R[slot].desc.value = '';
  R[slot].block.hidden = true;
}

function showDescription(slot, text, source) {
  const m = S.meals[slot];
  m.description = text; m.descSource = source;
  R[slot].desc.value = text;
  R[slot].block.hidden = false;
  updateDescription(slot);
}

function updateDescription(slot) {
  const m = S.meals[slot];
  const r = R[slot];
  r.source.textContent = m.descSource;
  if (r.block.hidden) return;
  const rows = checkDescription(m.description, ingredients(slot), m.name);
  renderChecks(r.checks, rows);
  const ok = allPass(rows);
  r.desc.setAttribute('aria-invalid', String(!ok && m.description.length > 0));
  r.approve.disabled = !ok || Boolean(m.approved);
  r.approve.textContent = m.approved ? 'Approved' : 'Approve description';
}

function paintStatus(slot) {
  const m = S.meals[slot];
  R[slot].status.textContent = m.approved ? `Approved by ${PEOPLE.reviewer}` : m.description ? 'Awaiting approval' : 'Not reviewed';
}

function validInputs(slot) {
  if (!S.meals[slot].name.trim() || ingredients(slot).length === 0) {
    showAlert(R[slot].alert, 'Add a meal name and at least one ingredient in the table first.');
    return false;
  }
  showAlert(R[slot].alert, '');
  return true;
}

async function draft(slot, btn) {
  if (!validInputs(slot)) return;
  const m = S.meals[slot];
  busy(btn, true, 'Drafting…');
  try {
    const j = await post({ task: 'description', name: m.name.trim(), ingredients: ingredients(slot) });
    m.aiDescription = j.description;
    showDescription(slot, j.description, 'AI drafted');
    invalidate(slot);
    say(`${slotLabel(slot)} draft ready. Review it and the checks below.`);
    R[slot].desc.focus();
  } catch (e) {
    showAlert(R[slot].alert, e.message);
  } finally {
    busy(btn, false);
  }
}

function bindCard(slot) {
  const r = R[slot];
  const m = () => S.meals[slot];
  r.draft.addEventListener('click', (e) => draft(slot, e.currentTarget));
  r.regen.addEventListener('click', (e) => draft(slot, e.currentTarget));
  r.own.addEventListener('click', () => {
    if (!validInputs(slot)) return;
    showDescription(slot, '', 'Written by reviewer');
    invalidate(slot);
    r.desc.focus();
  });
  r.desc.addEventListener('input', (e) => {
    m().description = e.target.value;
    if (m().aiDescription) m().descSource = m().description.trim() === m().aiDescription ? 'AI drafted' : 'AI drafted, edited by reviewer';
    invalidate(slot);
  });
  r.reject.addEventListener('click', () => {
    resetDescription(slot);
    invalidate(slot);
    say('Draft rejected and discarded.');
    r.draft.focus();
  });
  r.approve.addEventListener('click', () => {
    m().approved = { at: new Date(), source: m().descSource, text: m().description };
    paintStatus(slot);
    updateDescription(slot);
    paintNav();
    say(bothApproved() ? 'Both descriptions approved. You can send them to the menu owner.' : `${slotLabel(slot)} description approved.`);
    if (bothApproved()) $('continue').focus();
  });
}

function bindStep1() {
  $('continue').addEventListener('click', () => {
    setStep(2);
    say('Descriptions approved. Now choose a pairing for the main course.');
  });
}

// ---------- step 2 ----------
function renderStep2() {
  const m = S.meals.main;
  $('s2-name').textContent = m.name;
  $('s2-desc').textContent = m.approved?.text || m.description;
  $('s2-by').textContent = m.approved ? `Approved by ${PEOPLE.reviewer}, ${when(m.approved.at)}. ${m.approved.source}.` : '';
  $('s2-second').textContent = `Second meal: ${S.meals.second.name} goes out without a wine pairing.`;
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
  const rows = checkPairing({ wine, reasons: S.pair.reasons, description: S.meals.main.approved?.text || S.meals.main.description, ingredients: ingredients('main') });
  renderChecks($('pair-checks'), rows);
  $('approve-2').disabled = !allPass(rows);
  renderWines();
}

function showPair() { S.pair.shown = true; $('pair-block').hidden = false; updatePair(); }

async function suggest(btn) {
  const m = S.meals.main;
  busy(btn, true, 'Thinking…');
  try {
    const j = await post({ task: 'pairing', name: m.name.trim(), ingredients: ingredients('main'), description: m.approved.text });
    S.pair.ai = { wineId: j.wineId || 'none', reasons: j.reasons, note: j.note };
    S.pair.wineId = j.wineId || 'none';
    S.pair.reasons = [j.reasons[0] || '', j.reasons[1] || ''];
    S.pair.note = j.note || '';
    S.pair.source = 'AI suggested';
    showAlert($('alert-2'), '');
    $('pair-select').value = S.pair.wineId;
    $('reason-1').value = S.pair.reasons[0];
    $('reason-2').value = S.pair.reasons[1];
    showPair();
    say(j.wineId ? 'Pairing suggested. Review it before approving.' : 'The AI found no good match on this list. You can still pick a wine yourself.');
    $('pair-select').focus();
  } catch (e) {
    showAlert($('alert-2'), e.message);
  } finally {
    busy(btn, false);
  }
}

function markPairEdited() {
  if (S.pair.ai) {
    const same = S.pair.wineId === S.pair.ai.wineId && S.pair.reasons.every((r, i) => r.trim() === (S.pair.ai.reasons[i] || ''));
    S.pair.source = same ? 'AI suggested' : 'AI suggested, edited by menu owner';
  } else S.pair.source = 'Chosen by menu owner';
  S.pair.approved = null;
  paintNav();
}

function bindStep2() {
  $('suggest').addEventListener('click', (e) => suggest(e.currentTarget));
  $('manual-pair').addEventListener('click', () => {
    S.pair = { ...pairBlank(), source: 'Chosen by menu owner', shown: true };
    showAlert($('alert-2'), '');
    renderStep2();
    paintNav();
    $('pair-select').focus();
  });
  $('pair-select').addEventListener('change', (e) => { S.pair.wineId = e.target.value; S.pair.note = ''; markPairEdited(); updatePair(); });
  for (const [i, id] of [[0, 'reason-1'], [1, 'reason-2']]) {
    $(id).addEventListener('input', (e) => { S.pair.reasons[i] = e.target.value; markPairEdited(); updatePair(); });
  }
  $('approve-2').addEventListener('click', () => {
    S.pair.approved = { at: new Date(), source: S.pair.source || 'Chosen by menu owner' };
    setStep(3);
    say('Menu published.');
  });
  $('back-1').addEventListener('click', () => setStep(1));
}

// ---------- step 3 ----------
const isAi = (s) => String(s).startsWith('AI');

function renderStep3() {
  const wine = wineById(S.pair.wineId);
  const main = S.meals.main;
  const second = S.meals.second;

  const tagFor = (slot) => {
    if (slot === 'main') {
      const names = `${PEOPLE.reviewer} and ${PEOPLE.owner}`;
      return isAi(main.approved.source) || (wine && isAi(S.pair.approved.source)) ? `AI drafted, approved by ${names}` : `Written and approved by ${names}`;
    }
    return isAi(second.approved.source) ? `AI drafted, approved by ${PEOPLE.reviewer}` : `Written and approved by ${PEOPLE.reviewer}`;
  };

  const section = (slot, m, pairLine) =>
    el('section', { class: 'mp-menu__section', 'aria-labelledby': `mc-${slot}` },
      el('h3', { class: 'mp-menu__course', id: `mc-${slot}`, text: slotLabel(slot) }),
      el('p', { class: 'mp-menu__name', text: m.name }),
      el('p', { text: m.approved.text }),
      pairLine ? el('p', { class: 'mp-menu__pair', text: pairLine }) : null,
      el('span', { class: 'pm-tag mp-menu__tag' }, svgIcon('sparkle'), ` ${tagFor(slot)}`));

  $('out-menu').replaceChildren(
    section('main', main, wine ? `Pairs with ${wine.name}.` : null),
    section('second', second, null)
  );

  $('provenance').replaceChildren(
    el('li', { text: `Main course description: ${main.approved.source}, approved by ${PEOPLE.reviewer} (menu reviewer), ${when(main.approved.at)}.` }),
    el('li', { text: `Main course pairing: ${wine ? S.pair.approved.source : 'none selected'}, approved by ${PEOPLE.owner} (menu owner), ${when(S.pair.approved.at)}.` }),
    el('li', { text: `Second meal description: ${second.approved.source}, approved by ${PEOPLE.reviewer} (menu reviewer), ${when(second.approved.at)}. No wine pairing for this course.` })
  );

  $('out-read').replaceChildren(
    el('p', { class: 'mp-small' }, el('strong', { text: `${main.name}, ingredients: ` }), document.createTextNode(ingredients('main').join(', '))),
    el('p', { class: 'mp-small' }, el('strong', { text: `${second.name}, ingredients: ` }), document.createTextNode(ingredients('second').join(', '))),
    wine ? el('p', { class: 'mp-small' }, el('strong', { text: `${wine.name}: ` }), document.createTextNode(wine.notes)) : el('p', { class: 'mp-small', text: 'No wine was paired.' }),
    wine ? el('p', { class: 'mp-small' }, el('strong', { text: 'Why this pairing: ' }), document.createTextNode(S.pair.reasons.join(' '))) : null
  );
}

function svgIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'pm-icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#pm-icon-${name}`);
  svg.append(use);
  return svg;
}

function bindStep3() {
  $('restart').addEventListener('click', () => {
    S = blank();
    renderTable();
    for (const slot of SLOT_IDS) { resetDescription(slot); showAlert(R[slot].alert, ''); paintStatus(slot); }
    paintMealNames();
    showAlert($('alert-2'), '');
    setStep(1);
    say('Started over.');
  });
  $('back-2').addEventListener('click', () => setStep(2));
}

// ---------- shell ----------
function bindShell() {
  $('reviewer-pill').textContent = `Menu reviewer: ${PEOPLE.reviewer}`;
  $('owner-pill').textContent = `Menu owner: ${PEOPLE.owner}`;
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

buildCards();
renderTable();
bindTable();
bindShell();
bindStep1();
bindStep2();
bindStep3();
for (const slot of SLOT_IDS) paintStatus(slot);
setStep(1, false);
loadIcons();
