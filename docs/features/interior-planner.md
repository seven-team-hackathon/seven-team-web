# Interior planner

Users upload a photo of a room (or part of it), optionally describe what they want and set a budget, and receive links to real IKEA US furniture with a short explanation for each pick. Nothing is generated: the result is a list of existing products.

Status: the real pipeline is implemented. With `MOCK_API` unset or not `true` and `ANTHROPIC_API_KEY` set, `/api/space` analyzes the photo with Claude and `/api/recommend` picks products from the catalog and explains each pick. With `MOCK_API=true` both endpoints return fixtures.

## Scope of the first iteration

- **Photo or floor plan.** `kind=photo` estimates the visible area of one room. `kind=plan` finds the rooms on a floor plan, so the user can pick one (see "Floor plans").
- **Dimensions are optional.** The photo analysis returns an estimate of the visible area. The user may accept it or enter real dimensions.
- **Be honest about estimates.** When dimensions are only estimated from the photo, the backend is more conservative and the UI must say so (see "Honesty rules").

## Contracts

All request and response shapes live in `lib/contracts/` as zod schemas with inferred types. The frontend should import types from there:

- `space.ts`: `SpaceDraft`, `ConfirmedSpace`, `DimensionsBasis`
- `preferences.ts`: `Preferences`
- `recommendation.ts`: `RecommendRequest`, `RecommendationResponse`
- `api-error.ts`: error codes and HTTP statuses
- `markets.ts`, `room-type.ts`, `furniture-category.ts`: shared enums
- `fixtures.ts`: example payloads for UI work

All dimensions are centimeters and all prices are USD. The only market is `us`.

## Suggested flow

1. The user uploads a photo. Call `POST /api/space`.
2. Show the detected room type, the estimated dimensions and, if `needsUserInput` is not empty, ask the user to confirm them. The user either accepts the estimate (send `dimensionsBasis: "estimated"`) or edits it (send `dimensionsBasis: "user"`).
3. The user enters a budget, picks furniture categories and may add a free text description ("light colors, we have a cat"). Room type and style are optional: they are taken from the photo when omitted.
4. Call `POST /api/recommend` and show the results with the reasons.
5. If `meta.dimensionsBasis` is `"estimated"`, show a notice (see below).

The Room step is skipped for a photo when the analysis returns dimensions. "Try a sample photo" always skips it: the analysis result is used as is, and any missing room type, dimensions or openings fall back to `SAMPLE_PHOTO_SPACE` (living room, 420 x 380 cm, 250 cm ceiling, one 150 cm window). A skipped step stays visible in the step indicator but cannot be opened.

## Mock mode

Add `MOCK_API=true` to `.env.local` to get fixture responses without calling the AI. Without it the endpoints use the real pipeline and return `model_failed` (502) when `ANTHROPIC_API_KEY` is missing.

Mock responses are always the same:

- `/api/space` returns `spaceDraftPhotoFixture`.
- `/api/recommend` returns `recommendationFixture` (sofa, coffee table, TV unit) regardless of the requested categories. `meta.dimensionsBasis` mirrors the request.
- Product names end with "(mock)" and links point to the IKEA US home page.

Input validation is real, so error states can be tested now. `recommendRequestEstimatedFixture` is an example request without room type and style and with estimated dimensions.

## POST /api/space

Multipart form data:

- `kind`: `photo` or `plan`
- `file`: image, JPEG, PNG or WebP, at most 4 MB

Resize the image on the client (about 1600 px on the long side) before upload.

Response 200: `SpaceDraft`:

- `roomType`: detected room type, may be missing.
- `dimensions`: estimate of the visible area (`widthCm`, `lengthCm`, optional `ceilingHeightCm`) with `source` (`estimated` for a photo) and `confidence` between 0 and 1.
- `openings`: detected doors and windows.
- `styleHints`: short style cues from the photo, for example "light walls". Pass them back in `space.styleHints`.
- `needsUserInput`: what the user should confirm: `dimensions`, `ceiling-height`, `openings`, `room-type`. It is a recommendation to ask, not a hard block: the user may accept the estimate.

```ts
const form = new FormData()
form.set("kind", "photo")
form.set("file", file)

const response = await fetch("/api/space", { method: "POST", body: form })
```

In React Native append the file as `{ uri, name, type }` and do not set the `content-type` header manually.

## Floor plans

With `kind=plan` the response is a `SpaceDraft` with `kind: "plan"` and a `rooms` array. Each room has:

- `id`: `room-1`, `room-2`, ... in reading order.
- `bounds`: the rectangle of the room as fractions of the whole image (`x`, `y` is the top-left corner, `width` and `height` follow, all between 0 and 1). Use it to highlight the room over the uploaded image.
- `roomType` (optional) and `dimensions` (optional): `widthCm` is the left-right size as drawn on the image and `lengthCm` the top-bottom size. `dimensions.source` is `plan-labels` when the sizes were read from text on the plan (feet, inches and meters are converted to centimeters) or `estimated` when they were inferred. Rooms such as kitchens and bathrooms come without `roomType`.

Rules for the UI:

- `rooms` can be empty, for example when the model could not find any room. Then let the user draw the room on the image and enter the sizes. The same applies to a room without `dimensions`.
- When exactly one room is found, `roomType` and `dimensions` are also set at the top level of the draft.
- `needsUserInput` contains `dimensions` when at least one room has no size.
- Bounds and sizes are read by a model and can be wrong. Always let the user move the rectangle and edit the sizes. Send `dimensionsBasis: "user"` once the user has seen and confirmed the sizes in the room form (the current UI does this), and `"estimated"` when sizes from a photo are used without that confirmation: only then does the backend apply its 15% safety margin.
- A non-plan image returns `422` with `unreadable_space`.
- `rooms` is part of the shared `spaceDraftSchema` in `lib/contracts/space.ts` (`detectedRoomSchema`, `imageBoundsSchema`), so parsing the response with that schema keeps it. Before this change zod dropped the field.

Resize the plan on the client with care: small text needs enough pixels to be read, so do not go below about 1600 px on the long side.

## POST /api/recommend

JSON body `RecommendRequest`:

- `space` (`ConfirmedSpace`): `roomType` (required), `dimensions`, `openings`, optional `dimensionsBasis` (`"user"` or `"estimated"`, default `"user"`) and optional `styleHints` from the photo analysis.
- `preferences`: `market`, `household` (send `false` for both flags when unknown), `budget` in USD, `categories` (at least one), optional `note` (up to 500 characters), and optional `roomType` and `style`. When `roomType` or `style` are omitted the backend uses the room type of the space and the style cues from the photo and the note.

Response 200: `RecommendationResponse` with `items` (one entry per category with a `primary` product and up to 3 `alternatives`), `totals`, `fit`, `usage` and `meta` (`rankedBy`, `dimensionsBasis` and optional `unmatchedCategories`).

`meta.unmatchedCategories` lists requested categories for which no product fits the room and the budget. Those categories are missing from `items`: show an empty state for them, for example "Nothing fits this budget and space, try a higher budget". `items` can be empty.

## POST /api/visualize

Generates a photo of the user's room with the recommended products added. Only for the photo flow (the user needs a room photo). Multipart form data:

- `file`: the room photo, JPEG, PNG or WebP, at most 4 MB (the same file that was sent to `/api/space`).
- `articleNo`: the `articleNo` of a product from the recommendations. Repeat the field to add several products (1 to 4). The backend looks every product up in the catalog and uses its real size, colors and its IKEA product photo as extra references for the image model, and the model arranges the pieces in the room. Unknown articles return `400`.

Response 200: `{ mediaType, imageBase64, model, costUsd? }`. Show it with `data:${mediaType};base64,${imageBase64}`.

Notes for the UI:

- A request takes about 20 seconds (up to a couple of minutes in bad cases) and costs about $0.05. Show a loading state while it runs (the "See it in your room" step starts the request when it opens and keeps the result while the user stays in the flow).
- Always label the result as an AI illustration: colors, details and size may differ from the real product (the UI caption does this).
- Stricter limits than the other endpoints: 4 requests per minute per client and 60 per hour overall. Over the limit the API returns `429` with `Retry-After`.
- In mock mode (`MOCK_API=true`) the endpoint returns the uploaded photo unchanged, with no cost.
- Errors use the same shape as the other endpoints. `model_failed` also covers a missing `OPENROUTER_API_KEY` and an account without credits.

The image model is configured with `OPENROUTER_IMAGE_MODEL` (default `google/gemini-nano-banana-2.1`) and the key with `OPENROUTER_API_KEY`. The product photo URLs (`imageUrl`) come from the IKEA product pages and are only sent to the image model, they are not shown or stored by the app.

## Honesty rules for the UI

- When `meta.dimensionsBasis` is `"estimated"`, show a clear notice, for example: "Room size was estimated from the photo and may be off. Check the item dimensions against your space before buying."
- Always show each item's dimensions so the user can compare them with their space.
- Estimated dimensions are treated conservatively: the backend shrinks the estimated space by 15% before checking fit, so it may skip items that would actually fit.
- `reason` is a short explanation written for each pick, show it on the card.
- `fit.issues[].code` is one of `item-too-wide`, `floor-usage-exceeded`, `over-budget`.
- `usage` is for internal cost tracking, not for the UI.

## Allowed values

- `roomType`: `living-room`, `bedroom`, `home-office`, `dining-room`, `kids-room`, `hallway`
- `style`: `scandinavian`, `modern`, `minimal`, `cozy`, `industrial`, `classic`
- `categories`: `sofa`, `armchair`, `coffee-table`, `side-table`, `tv-unit`, `bed`, `wardrobe`, `nightstand`, `desk`, `office-chair`, `bookshelf`, `dining-table`, `dining-chair`, `storage`
- `market`: `us`

## Errors

Every error has the shape `{ "error": { "code": string, "message": string } }`.

| Code | HTTP |
| --- | --- |
| `invalid_input` | 400 |
| `file_too_large` | 413 |
| `unsupported_media_type` | 415 |
| `unreadable_space` | 422 |
| `rate_limited` | 429 |
| `model_failed` | 502 |
| `timeout` | 504 |

## Rate limits

When `MOCK_API` is not `true`, `/api/space` allows 10 requests per minute per client and `/api/recommend` 20 per minute, with a shared cap of 300 model requests per hour. Over the limit the API returns `429` with `code: "rate_limited"` and a `Retry-After` header (seconds). Show "Too many requests, try again in a moment" and disable the button until then. The limits are in memory per server instance, so they are approximate.

## Registration and session

Registration is stored on the client only (name and email). The backend is stateless and has no sessions or database.

## Availability and delivery

Product price is national. Stock and delivery cost depend on the user's ZIP code and are not tracked. Show a note that availability and delivery should be checked on the IKEA site.

## Catalog data

The catalog is built by scripts in `scripts/` from IKEA US product pages: `collect-ikea.mts` collects pages, `ingest-catalog.mts normalize` fixes dimensions with deterministic rules, `classify` asks Claude for category, style, colors and a standalone-furniture check, and `write` produces `lib/catalog/products.json` and `lib/catalog/listings/us.json`. The raw collected pages are not committed.

Only a sample of the assortment is included, and prices and availability can change. Product links point to the IKEA US site.

## Evals

`npm run evals` runs `evals/recommend.eval.ts` against the real API (about $0.35 and 2 minutes). It sends 24 scenarios (typical rooms, small and narrow rooms, estimated dimensions, tight and impossible budgets, household needs, a Ukrainian note, a prompt injection attempt) through `recommend()` and reports:

- deterministic checks: articles exist in the catalog, links match the article, every requested category is returned or listed as unmatched, no duplicates, primary picks fit the room, the budget is respected or over-budget is reported, the model ranking was used;
- explanation grounding, judged by a second model that sees the product data and the candidate lists;
- latency and cost per request.

Results are written to `evals/results/recommend-latest.md` and `.json`. `recommend-baseline.*` is the run before the ranking prompt forbade comparisons between products (grounded explanations 83.5%, now 94.1%).

Photo dimension evals (`evals/space.eval.ts`) run when `evals/space-cases/cases.json` exists: a list of `{ file, widthCm, lengthCm, roomType? }` entries next to the photos. Without it the suite is skipped.
