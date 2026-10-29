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
npm run test         # Vitest unit tests (non-watch)
npm run test:watch   # Vitest watch mode
npm run test:typecheck # tsc on tests + vitest config
```

Vitest is configured in `vitest.config.mts` (node environment, `@` alias). Next's `tsconfig.json` excludes test files and `__tests__`; tests are typechecked separately with `tsconfig.test.json`. Pre-commit hooks run lint-staged (eslint --fix + prettier on staged .ts/.tsx, prettier on .json/.css/.md/.mjs) and commitlint validates Conventional Commits format.

## Architecture

- **No backend of its own.** No server, no API routes, no database. AI provider calls go directly from the browser to DeepSeek / OpenAI / Anthropic / Google / OpenRouter. Job links use public ATS APIs directly; the optional `r.jina.ai` reader is a third-party fetcher (see `lib/jd-link/`).
- Per-provider API key storage in `localStorage` with legacy key backward compat. Each provider stored separately — switch providers without re-entering keys.
- `src/lib/ai/provider.ts` — `createChatCompletion()` dispatches by provider with per-provider body builders (OpenAI-compatible, Anthropic Messages API, Google generateContent) and response parsers.
- `src/lib/storage/local.ts` — `localStorage` wrappers (API key per provider, optional GitHub token, master resume, preferences). SSR-safe (guards `typeof window === "undefined"`); `getApiKey`/`getExtractionJson` return safe defaults when storage throws. The job-link reader preference key is `rolecraft_jd_reader_fallback` (default on; intentionally outside `StoredData`, cleared by `clearAll`).
- `src/lib/github/` — browser-only GitHub REST collection. `client.ts` owns request budgets, timeouts, abort, and retry; `collect.ts` samples per-year commits and public PRs/issues within anonymous/token caps; `aggregate.ts` computes all stats; the AI only narrates a compact dossier and its numeric claims are validated. REST-only, no GraphQL, no proxy.
- `src/lib/jd-link/` — job-link import: URL validation → ATS API (Greenhouse, Lever, SmartRecruiters) → optional `r.jina.ai` reader → HTML→text → quality/warning assessment → capped (30,000-character) editable text. Only ATS APIs and `r.jina.ai` are contacted for job links. The reader is optional, default-on, and every result is visibly labelled.
- `src/lib/pipeline/run-epoch.ts` — per-run epoch token. Every post-await check and write in `usePipeline.run` is gated by `runEpoch.isCurrent(epoch)`; `cancel()` invalidates the epoch. `run` returns `Promise<boolean>`.
- GitHub data is sampled, not complete. All UI copy must say so. Anonymous mode is limited to 60 core requests/hour; an optional local GitHub token raises this to 5,000/hour and is sent only to `api.github.com`.

## Tech stack quirks

- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline {}` in `globals.css`, NOT the v3 `@tailwind base/components/utilities` directives. PostCSS plugin is `@tailwindcss/postcss`.
- **Path alias** `@/*` → `./src/*` (configured in `tsconfig.json`).
- **Fonts** loaded via `next/font/google` (Geist Sans + Geist Mono) as CSS variables `--font-geist-sans` / `--font-geist-mono`.
- **Lucide React v1.20** for icons.

## Routes

| Path            | Description                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- |
| `/`             | Landing page (`src/app/page.tsx`)                                                            |
| `/app`          | Redirect: → `/app/builder` if resume set, else `/app/resume`                                 |
| `/app/builder`  | Pipeline: JD paste or job link → analysis → mapping → generation → critique → LaTeX → export |
| `/app/resume`   | Master resume editor + AI extraction from PDF/DOCX                                           |
| `/app/github`   | GitHub profile → sampled public work summary → Markdown / resume projects                    |
| `/app/settings` | Provider + API key + model selection + optional GitHub token                                 |

## Project structure (high-level)

```
src/
  app/            # Next.js App Router pages
  lib/ai/         # 5-provider dispatch + 8 system prompts + JSON parser
  lib/pipeline/   # Convergence, revision planning, similarity, constants, run epochs
  lib/jd-link/    # URL validation, ATS/reader fetch, HTML→text, quality, reducer, controller
  lib/latex/      # Deterministic .tex template, HTML render, browser measure, auto-shrink
  lib/export/     # TXT, DOCX, PDF (plain + spec), .tex download
  lib/parse/      # PDF + DOCX text extraction
  lib/storage/    # localStorage wrappers (per-provider key + GitHub token + reader pref)
  lib/github/     # REST collection, rate budgets, aggregation, grounding, Markdown
  lib/utils/      # uid(), clamp(), abortable sleep()
  types/          # Shared interfaces + github.ts + jd-link.ts
  components/     # Layout shell, pipeline/resume/GitHub panels (incl. JDInputPanel), shadcn/ui
  hooks/          # usePipeline, useJobDescriptionFetch, useResumeExtraction, useGitHubWorkSummary, useListField
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
