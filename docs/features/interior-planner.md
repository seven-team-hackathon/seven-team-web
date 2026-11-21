# Interior planner

Users upload a photo of a room (or part of it), optionally describe what they want and set a budget, and receive links to real IKEA US furniture with a short explanation for each pick. Nothing is generated: the result is a list of existing products.

Status: contracts and mock endpoints are ready. The catalog (294 products), candidate filtering and fit checks are implemented. The AI steps (reading the photo, ranking and explaining) replace the mock responses later without changing the contracts.

## Scope of the first iteration

- **Photo only.** `kind=plan` is not supported yet and returns 400 (`invalid_input`).
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

## Mock mode

Add `MOCK_API=true` to `.env.local`. While the real pipeline is not implemented, both endpoints return `model_failed` (502) unless mock mode is on.

Mock responses are always the same:

- `/api/space` returns `spaceDraftPhotoFixture`.
- `/api/recommend` returns `recommendationFixture` (sofa, coffee table, TV unit) regardless of the requested categories. `meta.dimensionsBasis` mirrors the request.
- Product names end with "(mock)" and links point to the IKEA US home page.

Input validation is real, so error states can be tested now. `recommendRequestEstimatedFixture` is an example request without room type and style and with estimated dimensions.

## POST /api/space

Multipart form data:

- `kind`: `photo` (`plan` returns 400 for now)
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

## POST /api/recommend

JSON body `RecommendRequest`:

- `space` (`ConfirmedSpace`): `roomType` (required), `dimensions`, `openings`, optional `dimensionsBasis` (`"user"` or `"estimated"`, default `"user"`) and optional `styleHints` from the photo analysis.
- `preferences`: `market`, `household` (send `false` for both flags when unknown), `budget` in USD, `categories` (at least one), optional `note` (up to 500 characters), and optional `roomType` and `style`. When `roomType` or `style` are omitted the backend uses the room type of the space and the style cues from the photo and the note.

Response 200: `RecommendationResponse` with `items` (one entry per category with a `primary` product and up to 3 `alternatives`), `totals`, `fit`, `usage` and `meta` (`rankedBy` and `dimensionsBasis`).

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

## Registration and session

Registration is stored on the client only (name and email). The backend is stateless and has no sessions or database.

## Availability and delivery

Product price is national. Stock and delivery cost depend on the user's ZIP code and are not tracked. Show a note that availability and delivery should be checked on the IKEA site.

## Catalog data

The catalog is built by scripts in `scripts/` from IKEA US product pages: `collect-ikea.mts` collects pages, `ingest-catalog.mts normalize` fixes dimensions with deterministic rules, `classify` asks Claude for category, style, colors and a standalone-furniture check, and `write` produces `lib/catalog/products.json` and `lib/catalog/listings/us.json`. The raw collected pages are not committed.

Only a sample of the assortment is included, and prices and availability can change. Product links point to the IKEA US site.
