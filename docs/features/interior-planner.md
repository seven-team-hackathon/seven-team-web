# Interior planner

Users upload a floor plan or a photo of a room, set preferences and a budget, and receive links to real IKEA US furniture that fits the space. Nothing is generated: the result is a list of existing products.

Status: contracts and mock endpoints are ready. The real AI pipeline replaces the mock responses later without changing the contracts.

## Contracts

All request and response shapes live in `lib/contracts/` as zod schemas with inferred types. The frontend should import types from there:

- `space.ts`: `SpaceDraft`, `ConfirmedSpace`
- `preferences.ts`: `Preferences`
- `recommendation.ts`: `RecommendRequest`, `RecommendationResponse`
- `api-error.ts`: error codes and HTTP statuses
- `markets.ts`, `room-type.ts`, `furniture-category.ts`: shared enums
- `fixtures.ts`: example payloads for UI work

All dimensions are centimeters and all prices are USD. The only market is `us`.

## Mock mode

Add `MOCK_API=true` to `.env.local`. While the real pipeline is not implemented, both endpoints return `model_failed` (502) unless mock mode is on.

Mock responses are always the same:

- `/api/space` returns `spaceDraftPlanFixture` for `kind=plan` and `spaceDraftPhotoFixture` for `kind=photo`.
- `/api/recommend` returns `recommendationFixture` (sofa, coffee table, TV unit) regardless of the requested categories.
- Product names end with "(mock)" and links point to the IKEA US home page.

Input validation is real, so error states can be tested now.

## POST /api/space

Multipart form data:

- `kind`: `plan` or `photo`
- `file`: image, JPEG, PNG or WebP, at most 5 MB

Resize the image on the client (about 1600 px on the long side) before upload.

Response 200: `SpaceDraft`. Dimensions from a photo are unreliable, so for `kind=photo` the response always asks the user to confirm dimensions (`needsUserInput` contains `dimensions`). For a plan, the user confirms when `confidence` is low. The client sends the confirmed values to `/api/recommend` as `ConfirmedSpace`.

```ts
const form = new FormData()
form.set("kind", "plan")
form.set("file", file)

const response = await fetch("/api/space", { method: "POST", body: form })
```

In React Native append the file as `{ uri, name, type }` and do not set the `content-type` header manually.

## POST /api/recommend

JSON body `RecommendRequest`: `space` (confirmed room) and `preferences` (market, room type, style, household, budget in USD, categories, optional note).

Response 200: `RecommendationResponse` with `items` (one entry per category with a `primary` product and up to 3 `alternatives`), `totals`, `fit`, `usage` and `meta.rankedBy`.

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
