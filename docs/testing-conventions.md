# Testing conventions

- Use Vitest with React Testing Library. The environment is `jsdom`, and `@testing-library/jest-dom` matchers are available globally.
- Put tests next to the code they cover as `*.test.ts` or `*.test.tsx`, for example `lib/utils.test.ts`.
- Add simple automated tests for new logic in `lib/`, API route handlers and components with non-trivial behavior.
- Query elements by role or label (`getByRole`, `getByLabelText`) rather than by class names or test ids.
- Do not run tests or other verification after implementing a feature unless explicitly requested or asked to `prepare to commit`.

## Prepare to commit

When I ask to `prepare to commit`, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Fix any failures before reporting that the change is ready.
