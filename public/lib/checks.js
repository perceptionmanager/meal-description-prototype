// Deterministic checks, shared by the browser and the serverless function.
// They run on whatever text is on screen, so they apply to AI drafts and to human edits alike.
// Known limit: the ingredient check works from a word list of common foods. It catches the
// usual invented additions ("with truffle") but not a rare ingredient that isn't on the list.
// On the AI path the function adds a second check: the model must report which ingredients it
// used, and every one has to match the input.

import { LIMITS } from './data.js';

const norm = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const words = (s) => norm(s).match(/[a-z]+/g) || [];
export const wordCount = (s) => (String(s).trim() ? String(s).trim().split(/\s+/).length : 0);

export const stem = (w) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/(es|s)$/, '') : w);
const variants = (w) => [w, stem(w)];

const FOOD = `beef pork bacon ham sausage chicken turkey duck lamb veal salmon shrimp crab lobster scallop tuna cod trout
fish egg butter cream milk cheese cheddar parmesan gruyere mozzarella feta mascarpone yogurt potato tomato onion shallot
garlic leek chive mushroom spinach kale asparagus bean pea carrot celery celeriac fennel cucumber radish pepper corn squash
pumpkin zucchini eggplant cauliflower broccoli cabbage beet olive caper lemon lime orange apple pear cherry berry
strawberry blueberry raspberry blackberry peach fig grape mango coconut almond pistachio walnut pecan hazelnut peanut rice
pasta noodle bread polenta quinoa couscous chocolate vanilla honey maple sugar basil thyme rosemary tarragon sage parsley
dill mint cilantro oregano paprika cumin saffron ginger truffle balsamic vinegar mustard mayo soy miso tofu lentil
chickpea cranberry pineapple avocado artichoke pomegranate caramel espresso coffee`.split(/\s+/);

const FOOD_SET = new Set(FOOD.flatMap(variants));

const CLAIMS = new RegExp(
  '\\b(' +
    [
      'gluten[- ]?free', 'dairy[- ]?free', 'nut[- ]?free', 'sugar[- ]?free', 'vegan', 'vegetarian', 'plant[- ]?based',
      'allergen\\w*', 'allerg\\w*', 'keto', 'low[- ]?carb', 'low[- ]?fat', 'low[- ]?calorie', 'healthy', 'healthful',
      'nutritious', 'organic', 'non[- ]?gmo', 'halal', 'kosher', 'heart[- ]?healthy', 'sustainabl\\w+',
      'locally[- ]?sourced', 'farm[- ]?to[- ]?table', 'wild[- ]?caught', 'free[- ]?range', 'grass[- ]?fed',
      'house[- ]?made', 'handcrafted', 'chef\\w*', 'award[- ]?winning', 'world[- ]?class', 'finest', 'best',
    ].join('|') +
    ')\\b',
  'gi'
);

const GRAPES = ['cabernet', 'chardonnay', 'pinot', 'champagne', 'prosecco', 'port', 'riesling', 'merlot', 'sauvignon', 'syrah', 'malbec', 'sparkling', 'brut'];

function tokenSet(list) {
  return new Set(list.flatMap((item) => words(item).flatMap(variants)));
}

function unlisted(text, allowedTokens) {
  const seen = new Set();
  for (const w of words(text)) {
    if (!variants(w).some((v) => FOOD_SET.has(v))) continue;
    if (variants(w).some((v) => allowedTokens.has(v))) continue;
    seen.add(w);
  }
  return [...seen];
}

function claimsIn(text) {
  return [...new Set((String(text).match(CLAIMS) || []).map((m) => m.toLowerCase()))];
}

const row = (id, label, ok, detail = '') => ({ id, label, ok, detail });

export function checkDescription(text, ingredients) {
  const [min, max] = LIMITS.descriptionWords;
  const n = wordCount(text);
  const extra = unlisted(text, tokenSet(ingredients));
  const claims = claimsIn(text);
  return [
    row('length', `${min} to ${max} words`, n >= min && n <= max, `${n} words`),
    row('ingredients', 'Only the listed ingredients', extra.length === 0, extra.length ? `Not in the list: ${extra.join(', ')}` : ''),
    row('claims', 'No dietary, health, sourcing or chef claims', claims.length === 0, claims.length ? `Remove: ${claims.join(', ')}` : ''),
  ];
}

export function checkPairing({ wine, reasons, description, ingredients }) {
  if (!wine) return [row('selection', 'No pairing selected', true, 'The menu goes out without a wine pairing.')];
  const text = reasons.join(' ');
  const [a, b] = reasons;
  const lengthOk = Boolean(a && b) && reasons.every((r) => wordCount(r) >= 3 && wordCount(r) <= LIMITS.reasonWords);

  const allowed = tokenSet([...ingredients, description, wine.notes, wine.name]);
  const extra = unlisted(text, allowed);

  const own = new Set(words(`${wine.name} ${wine.style} ${wine.notes}`).flatMap(variants));
  const wrongWine = GRAPES.filter((g) => words(text).includes(g) && !own.has(g));

  const claims = claimsIn(text);
  return [
    row('reasons', `Two reasons, each up to ${LIMITS.reasonWords} words`, lengthOk, lengthOk ? '' : 'Write two short reasons.'),
    row('grounded', 'Mentions only the dish and this wine', extra.length === 0 && wrongWine.length === 0,
      [extra.length ? `Not in the dish or wine notes: ${extra.join(', ')}` : '', wrongWine.length ? `Names another wine: ${wrongWine.join(', ')}` : ''].filter(Boolean).join('. ')),
    row('claims', 'No dietary, health, sourcing or chef claims', claims.length === 0, claims.length ? `Remove: ${claims.join(', ')}` : ''),
  ];
}

export const allPass = (rows) => rows.every((r) => r.ok);

// The AI must report the ingredients it used. Each one has to overlap with the input list.
export function reportedIngredientsOk(reported, ingredients) {
  const allowed = tokenSet(ingredients);
  return (reported || []).every((item) => words(item).some((w) => variants(w).some((v) => allowed.has(v))));
}
