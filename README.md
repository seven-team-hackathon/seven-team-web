# seven-team-web

A hackathon problem-solving web app built with Next.js, React, Tailwind CSS, shadcn/ui and the Anthropic SDK.

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
