<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint (Next.js core-web-vitals + typescript configs)
npm run start    # Start production server
```

No `test` or `typecheck` scripts — only lint is wired up.

## Architecture

- **100% client-side.** No backend, no API routes. AI provider calls go directly from browser to OpenAI / Anthropic / Google / OpenRouter.
- The user's API key is stored in `localStorage` and passed with each request. Nothing leaves the browser.
- `src/lib/ai/provider.ts` — single `createChatCompletion()` function that dispatches by provider. Add new providers by adding a case there.
- `src/lib/storage/local.ts` — `localStorage` wrappers (API key, master resume, preferences). SSR-safe (guards `typeof window === "undefined"`).

## Tech stack quirks

- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline {}` in `globals.css`, NOT the v3 `@tailwind base/components/utilities` directives. PostCSS plugin is `@tailwindcss/postcss`.
- **Path alias** `@/*` → `./src/*` (configured in `tsconfig.json`).
- **Fonts** loaded via `next/font/google` (Geist Sans + Geist Mono) as CSS variables `--font-geist-sans` / `--font-geist-mono`.
- **Lucide React v1.20** for icons.

## Routes

| Path   | Description                                         |
| ------ | --------------------------------------------------- |
| `/`    | Landing page (`src/app/page.tsx`)                   |
| `/app` | Builder page — placeholder (`src/app/app/page.tsx`) |

## Project structure (high-level)

```
src/
  app/          # Next.js App Router pages
  lib/ai/       # AI provider interface + prompts
  lib/storage/  # localStorage helpers
  lib/utils/    # uid(), clamp(), sleep()
  types/        # All TypeScript interfaces (resume, pipeline, storage)
  components/   # NOT yet populated
```

## Pipeline types

`PipelineStep` is a union type: `"jd-analysis" | "experience-mapping" | "resume-generation" | "resume-critique"`.
All pipeline state lives in React state (ephemeral per session, resets on reload).
Critique loop converges when `score >= 85` AND `isConverged === true`.
