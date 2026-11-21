# Project engineering guide

Is a web repo for a hackathon problem-solving application built with Next.js (App Router), React, Tailwind CSS and shadcn/ui. Keep changes maintainable and consistent with the surrounding code.

Use npm as the package manager.

## Repository layout

- `app/` - Next.js App Router: pages, layouts and global styles (`app/globals.css`).
- `app/api/*/route.ts` - API route handlers.
- `components/ui/` - shadcn/ui components built on Base UI. Add new ones with `npx shadcn@latest add <component>`.
- `components/` - app-specific components.
- `lib/` - utilities and services. Use `cn` from `@/lib/utils` for class names.
- `public/` - static assets.
- `docs/` - engineering conventions.
- `docs/features/` - documentation of the app's functionality.

## Commands

- `npm run dev` - start the dev server.
- `npm run lint` - run ESLint.
- `npm run typecheck` - generate route types and run `tsc`.
- `npm test` - run Vitest once; `npm run test:watch` for watch mode.
- `npm run build` - production build.

## Environment

Copy `.env.example` to `.env.local` and fill in the values. Never commit `.env.local`.

## TypeScript conventions

Reference `docs/typescript-conventions.md` for detailed TypeScript conventions.

## React and Next.js conventions

Reference `docs/react-&-next-conventions.md` for detailed React and Next.js conventions.

## Tailwind CSS conventions

Reference `docs/tailwind-conventions.md` for detailed styles conventions.

## Web conventions

Reference `docs/web-conventions.md` for detailed Web conventions.

## Testing conventions

Reference `docs/testing-conventions.md` for detailed testing conventions.

## Delivery

Reference `docs/delivery-conventions.md` for conventions on delivering finished features and on what to do when asked to `prepare to commit`.
