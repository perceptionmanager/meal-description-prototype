# Menu copy review (prototype)

A prototype of a two-step human review for AI-written menu copy.

1. **Review the description.** AI drafts a customer-facing description from a meal name and ingredient list. The reviewer edits, redrafts, rejects, or writes their own. Approval is the first gate.
2. **Choose the pairing.** AI suggests a wine from a fixed wine list, with two reasons, or says none fits. The menu owner edits, picks another wine, or chooses none. Approval is the second gate.
3. **Published menu.** A digital menu card and a pre-select card with expandable "Why?" reasons.

All meals and wines are fictional. The prototype is not connected to any airline or menu system.

## Run it locally

```
npm run dev:mock   # no API key; canned answers, full flow works
npm run dev        # real model calls; needs ANTHROPIC_API_KEY
npm test           # checks and API handler, mock mode, no network
```

Open http://localhost:3000 (set `PORT` to change it).

## Environment variables

| Name | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Enables AI drafting. Without it the API returns 503 and the manual paths ("Write it myself", "Choose it myself") still work. | none |
| `ANTHROPIC_MODEL` | Model id | `claude-haiku-5-5` |
| `MOCK_AI` | `1` returns canned answers | off |
| `RATE_LIMIT_PER_IP` | Requests per IP per 10 minutes | 10 |
| `RATE_LIMIT_PER_DAY` | Requests per day, whole site | 300 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared rate-limit counters across instances | none |

Without Upstash, counts live in one serverless instance's memory. That slows casual abuse but is not a hard cap. Set a spend limit on the API key as well.

## How it limits what the AI can say

- The wine list lives on the server. The browser never sends one.
- Deterministic checks run on every description and pairing, AI-written or human-edited: word count, only the listed ingredients, no dietary/health/sourcing/chef claims, no wine outside the list. The approve buttons stay disabled until they pass.
- On the AI path the model must also report which ingredients it used, and the server verifies them against the input. A draft that fails is retried once, then returned as an error.
- Input is length-capped and stripped of angle brackets. Model output is rendered as text only.

## Known limits

- The ingredient check uses a word list of common foods. It catches usual invented additions ("with truffle") but not a rare ingredient that is not on the list.
- Live model calls have not been tested in the build environment (no API key there). Mock mode and the checks are tested.
- Out of scope for now: image generation and ingredient normalization from the original flow.

## Design system

`public/ds/` holds vendored copies of the design system's `tokens.css`, `components.css` and `icons.svg`. Update them by copying from the design system's `dist/`; do not edit them here.
Form styles (`.mp-input`, `.mp-textarea`, `.mp-select`, `.mp-choice`, `.mp-checks`) are local in `public/styles.css` and use only semantic tokens, so they can be promoted into the design system later.

## Deploy

Static files in `public/` plus one function, `api/generate.js` (see `vercel.json`). Deploy to a preview first, review, then promote.
