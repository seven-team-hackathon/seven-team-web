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
- `file`: image, JPEG, PNG or WebP, at most 4 MB

Resize the image on the client (about 1600 px on the long side) before upload.

Response 200: `SpaceDraft`. For a plan with several rooms, the optional `rooms` array lists every detected room with an `id`, optional `roomType` and `dimensions`, and its `bounds` on the uploaded image as fractions of the image width and height (0 to 1). The top-level `roomType` and `dimensions` stay for clients that work with one room. The mock plan response has three rooms: a living room, a bedroom and a hallway. Dimensions from a photo are unreliable, so for `kind=photo` the response always asks the user to confirm dimensions (`needsUserInput` contains `dimensions`). For a plan, the user confirms when `confidence` is low. The client sends the confirmed values to `/api/recommend` as `ConfirmedSpace`.

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

## Web UI

The main page (`app/page.tsx`) renders `components/planner/planner-flow.tsx`, which holds the flow state and talks to the endpoints above. Every step block fills the space below the step indicator to the bottom of the screen.

1. **Upload** (`upload-step.tsx`): the user picks `photo` (the default) or `plan` and an image (JPEG, PNG or WebP). Without a file, the sample button runs the same flow on an image generated on a canvas: "Try a sample photo" draws a room wall with a window (`lib/planner/sample-photo.ts`), "Try a sample plan" draws a floor plan (`lib/planner/sample-plan.ts`).
2. **Recognition** (`analyzing-step.tsx`): resizes the image to 1600 px on the long side (`lib/images/resize-image.ts`), checks the 4 MB limit and calls `POST /api/space`.
The flow depends on what was uploaded:

- **Floor plan:** Upload → Recognition → Room → Preferences → Results → Layout.
- **Room photo:** Upload → Recognition → Preferences → Results → Layout. The Room step is skipped: the room type and the estimated size from the `SpaceDraft` are used as they are. If the draft has no dimensions, the Room step is shown after all, because `ConfirmedSpace` requires them.

3. **Room** (`room-step.tsx`, floor plans only): the analyzed plan is shown next to the form with every detected room as a zone (`room-zone-picker.tsx`). The user taps a zone on the plan, or its button below the plan, and the form fills in that room's type and size to check and correct. When the draft has no `rooms`, the user outlines the room by dragging over the plan instead (`room-selector.tsx`). The chosen room bounds are kept on the client (`lib/planner/room-bounds.ts`), and the Layout step stretches exactly that part of the plan to the confirmed room size. A warning asks to measure the room when the draft needs dimensions or the confidence is below 0.6. Produces `ConfirmedSpace`.
4. **Preferences** (`preferences-step.tsx`): style, household and budget in USD, then `POST /api/recommend`.
   - For a floor plan the user ticks furniture categories (preset per room type in `lib/planner/options.ts`) and can add an optional note.
   - For a room photo the main field is a free-text request ("A tall wardrobe in light wood next to the window"), sent as `note`, with suggestion chips for the categories. The requested categories are the chosen chips plus the furniture named in the text (`lib/planner/match-categories.ts`), so typing "wardrobe" is enough. When the draft has no room type, the user picks it here.
5. **Results** (`results-step.tsx`): totals, fit status and issues, one block per category with the primary product and its alternatives, and the IKEA availability note.
6. **Layout**: "See it in your room" opens a client-side preview that depends on what the user uploaded. It is not sent to the API.
   - **Floor plan** (`floor-layout-step.tsx`): the uploaded plan is shown inside a rectangle with the confirmed room size, seen from above, with the primary products drawn at their real width and depth. Items are arranged automatically (`autoArrange` in `lib/planner/layout.ts`), then can be dragged, rotated (button or `R`), removed (button or `Delete`), moved with arrow keys and re-arranged. The live check reports items outside the room and overlapping items. Doors and windows are only visible on the plan image: the contract has no positions for them, so they are not checked.
   - **Room photo** (`wall-layout-step.tsx`): a photo usually shows one wall, so the photo is shown as that wall, seen from the front, with the products drawn at their real width and height standing on the floor (`lib/planner/wall-layout.ts`). The user picks which wall is in the photo (the room width or length); the wall height is the ceiling height, or 250 cm when it is unknown. Items move along the wall (drag or arrow keys) and can be removed. The live check reports items that run past the end of the wall or are taller than the ceiling. Overlaps are allowed because lower pieces can stand in front of taller ones.

Reached steps can be reopened from the step indicator without losing data, including furniture moved on the layout; Recognition is skipped because reopening it would upload again. Changing the room clears the previous recommendation and layout; unlocking the full selection re-arranges the layout so the newly unlocked items appear.

API errors are shown with user-facing messages per error code (`lib/api/user-error-message.ts`); the technical `message` from the API is never shown.

Monetization: the first 2 categories are free, the remaining categories are blurred and every alternative is locked. "Unlock all" opens `paywall-dialog.tsx` (one selection or a Pro subscription). Payment is simulated on the client: choosing a plan unlocks the selection for the session.

## Registration and session

Registration is stored on the client only (name and email). The backend is stateless and has no sessions or database.

## Availability and delivery

Product price is national. Stock and delivery cost depend on the user's ZIP code and are not tracked. Show a note that availability and delivery should be checked on the IKEA site.
