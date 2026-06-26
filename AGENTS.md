<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint (Next.js core-web-vitals + typescript + prettier + tailwindcss)
npm run format       # Prettier --write .
npm run format:check # Prettier --check .
npm run knip         # Dead code detection
npm run sort-pkg     # Canonical package.json key ordering
npm run start        # Start production server
```

No `test` or `typecheck` scripts — only lint is wired up. Pre-commit hooks run lint-staged (eslint --fix + prettier on staged .ts/.tsx, prettier on .json/.css/.md/.mjs) and commitlint validates Conventional Commits format.

## Architecture

- **100% client-side.** No backend, no API routes. AI provider calls go directly from browser to DeepSeek / OpenAI / Anthropic / Google / OpenRouter.
- Per-provider API key storage in `localStorage` with legacy key backward compat. Each provider stored separately — switch providers without re-entering keys.
- `src/lib/ai/provider.ts` — `createChatCompletion()` dispatches by provider with per-provider body builders (OpenAI-compatible, Anthropic Messages API, Google generateContent) and response parsers.
- `src/lib/storage/local.ts` — `localStorage` wrappers (API key per provider, master resume, preferences). SSR-safe (guards `typeof window === "undefined"`).

## Tech stack quirks

- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline {}` in `globals.css`, NOT the v3 `@tailwind base/components/utilities` directives. PostCSS plugin is `@tailwindcss/postcss`.
- **Path alias** `@/*` → `./src/*` (configured in `tsconfig.json`).
- **Fonts** loaded via `next/font/google` (Geist Sans + Geist Mono) as CSS variables `--font-geist-sans` / `--font-geist-mono`.
- **Lucide React v1.20** for icons.

## Routes

| Path            | Description                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| `/`             | Landing page (`src/app/page.tsx`)                                                |
| `/app`          | Redirect: → `/app/builder` if resume set, else `/app/resume`                     |
| `/app/builder`  | Pipeline: JD input → analysis → mapping → generation → critique → LaTeX → export |
| `/app/resume`   | Master resume editor + AI extraction from PDF/DOCX                               |
| `/app/settings` | Provider + API key + model selection                                             |

## Project structure (high-level)

```
src/
  app/            # Next.js App Router pages
  lib/ai/         # 5-provider dispatch + 8 system prompts + JSON parser
  lib/pipeline/   # Convergence, revision planning, similarity, constants
  lib/latex/      # Deterministic .tex template, HTML render, browser measure, auto-shrink
  lib/export/     # TXT, DOCX, PDF (plain + spec), .tex download
  lib/parse/      # PDF + DOCX text extraction
  lib/storage/    # localStorage wrappers (per-provider key + legacy compat)
  lib/utils/      # uid(), clamp(), sleep()
  types/          # All TypeScript interfaces (resume, pipeline, critique, LaTeX, storage)
  components/     # Layout shell, pipeline panels, resume editor, shadcn/ui primitives
  hooks/          # usePipeline (state machine), useResumeExtraction, useListField
```

## Pipeline types

`PipelineStep` is a union type:

```
"jd-analysis" | "experience-mapping" | "resume-generation" | "resume-critique"
| "resume-spec" | "latex-generation" | "latex-verification"
```

All pipeline state lives in React state (ephemeral per session, resets on reload).

Critique loop convergence is multi-signal (see constants in `src/lib/pipeline/constants.ts`):

- Score ceiling: overall ≥ 95 AND ATS ≥ 90
- Score delta: < 3 points improvement for 2 consecutive rounds (score ≥ 75, ATS ≥ 80)
- No new weaknesses found (score ≥ 75)
- Stale critique: ≥ 80% Jaccard overlap for 2 consecutive rounds
- No resume change: text ≥ 95% similar to previous iteration
- LLM self-judgment: isConverged === true (score ≥ 85)
- Hard cap: 50 iterations
