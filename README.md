# seven-team-web

AI interior planner. The user uploads a photo of a room, optionally describes what they want and sets a budget, and gets links to real IKEA US furniture that fits the space, each with a short explanation. Nothing is generated: the result is a list of existing products.

Built for the AI Product Engineering School 2026 hackathon (Next.js, React, Tailwind CSS, shadcn/ui and the Anthropic SDK).

## The problem

When furnishing a room people struggle to tell whether furniture will fit and look right together, so they measure by hand, browse several sites and risk buying something that does not fit. Returns of bulky furniture are expensive for retailers: one source estimates $55 to $108 per large return (vendor figure, not independently verified).

## How it works

```
photo ──► POST /api/space ──► Claude vision ──► room type, estimated size, doors/windows, style cues
                                     │
                     user confirms or edits dimensions
                                     ▼
 budget, categories, note ──► POST /api/recommend
                                     │
              catalog filter (size, budget, style) ── code
                                     │
              Claude ranks candidates and explains each pick
              (may only choose listed articleNos; validated, one retry, deterministic fallback)
                                     │
              budget and fit checks ── code
                                     ▼
                      links to IKEA US products + reasons
```

Where the AI is needed: reading a photo into structure, understanding free-text wishes, judging style fit and writing the explanation, and building the product catalog (classifying category, style and colors from product pages). Where code is deliberately used: size and budget checks, validating that every recommended article exists, building links.

Without dimensions the app still works: it estimates the visible area from the photo, treats the estimate conservatively (15% smaller) and tells the user the size is approximate.

## Run it

```bash
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY; keep MOCK_API=true to use fixtures instead of the AI
npm run dev
```

Open http://localhost:3000. `MOCK_API=true` returns fixture responses without calling the AI, which is what the frontend can use while developing.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm test` | Run the unit tests once |
| `npm run evals` | Run the AI evals against the real API (about $0.35, 2 minutes) |
| `npm run build` | Production build |

Catalog scripts (see `docs/features/interior-planner.md`): `node scripts/collect-ikea.mts`, then `node --env-file=.env.local scripts/ingest-catalog.mts normalize | classify | write`.

## Evals

24 scenarios, run with `npm run evals`. Latest results are in `evals/results/recommend-latest.md`.

- Every recommended article exists in the catalog, links match the article, requested categories are returned or reported as unmatched, primary picks fit the room, and the budget is respected or over-budget is reported: 100% of cases.
- Explanations grounded in product data, judged by a second model: 94.1% (83.5% before the ranking prompt forbade comparisons between products).
- Latency median 7.8 s, p90 10.7 s. Cost about $0.002 per recommendation request with the ranking model (the judge adds the rest of the $0.015 per eval case).

Not measured yet: the accuracy of room size estimated from photos. The harness is ready (`evals/space-cases/README.md`) but needs photos with measured dimensions. Cost of the photo analysis call is also not measured yet.

The judge is itself a model, so 94.1% is an estimate, not ground truth.

## Architecture and decisions

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui. Backend as Next.js route handlers.
- **Stateless backend, no database.** The catalog is JSON loaded into memory (294 products, 295 listings). Registration, if present, is client-side only. A database is a planned next step for catalog updates and run logs.
- **Models:** Claude Sonnet 5.5 reads photos, Claude Haiku 5.5 ranks and explains. Both are configurable through `ANTHROPIC_VISION_MODEL` and `ANTHROPIC_RANKING_MODEL`.
- **Honesty over guessing:** photo size estimates are capped at 0.7 confidence and flagged, the model can only pick from candidates, and categories with nothing that fits are reported instead of filled with a bad match.
- **Safety:** upload type and size limits (4 MB), per-client and global rate limits, request timeouts, and customer text treated as data rather than instructions (a prompt injection scenario is part of the evals).

### Trade-offs and limits

- **Catalog:** a sample of IKEA US (294 products), collected from public product pages and classified by Claude. Prices and availability can change, and stock and delivery depend on the ZIP code and are not tracked. Product links point to ikea.com. IKEA's terms restrict automated data collection in some countries, so this catalog is for the hackathon demo; scaling it needs an affiliate feed or partnership.
- **Rate limits are in memory.** On serverless hosting each instance counts separately, so they reduce abuse but are not a hard guarantee.
- **Photo-only first iteration.** Floor plan upload is not supported yet (`kind=plan` returns 400).
- **Size from a photo is approximate** and unvalidated against real rooms so far.
- **Single market (US)** and English only.

### Costs

Measured: about $0.002 per recommendation request (ranking model, around 8k input and 2k output tokens). Not measured yet: the photo analysis request. Pricing used for estimates comes from the model price table in `lib/anthropic.ts`.

## Documentation

- `docs/features/interior-planner.md`: API, flow, contracts, honesty rules and catalog data.
- `AGENTS.md` and `docs/`: engineering conventions.

## Team, process and AI tools

Roles: _fill in the team's roles here._

Process: we picked the niche from market data (accessibility, chargebacks, returns and others were compared) and settled on an interior planner, built the data contracts first so frontend and backend could work in parallel, then the catalog, the deterministic logic, the AI steps and the evals.

AI tools: Claude Code was used for research, planning, code, tests and the catalog collection scripts. Claude models power the product itself (photo analysis, ranking and explanations, catalog classification) and the evals judge.
