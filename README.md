# Roomfit

An AI interior planner that shows how furniture looks together, whether it fits the room and how to use the space best, before you buy anything. Built with Next.js, React, Tailwind CSS, shadcn/ui and the Anthropic SDK.

## Getting started

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm test` | Run Vitest once (`npm run test:watch` for watch mode) |
| `npm run build` | Production build |

## Project structure and conventions

See [AGENTS.md](AGENTS.md) and the [docs](docs/) folder.
