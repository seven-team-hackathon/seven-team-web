# Photo dimension eval set

Put room photos and a `cases.json` here to measure how well the app estimates room size from a photo. Without `cases.json` the photo evals are skipped.

## What to collect

About 25 photos of rooms (or parts of rooms) where you measured the floor area with a tape measure. Use your own photos or photos you are allowed to use. Include variety: wide and straight-on shots, tilted shots, small and large rooms, photos with and without a door visible.

For each photo measure:

- `widthCm`: width of the visible area along the wall that faces the camera
- `lengthCm`: how far the area extends from that wall toward the camera
- `roomType` (optional): one of `living-room`, `bedroom`, `home-office`, `dining-room`, `kids-room`, `hallway`

Keep each file under 4 MB (JPEG, PNG or WebP).

## cases.json

```json
[
  { "file": "living-1.jpg", "widthCm": 420, "lengthCm": 380, "roomType": "living-room" },
  { "file": "bedroom-1.jpg", "widthCm": 350, "lengthCm": 300 }
]
```

## Run

```bash
npm run evals
```

The report is written to `evals/results/space-latest.json`: median relative error, the share of estimates within 25% of the measured size, and per-photo errors with the model's confidence. Photos are not committed by default, so check what you add before committing it.
