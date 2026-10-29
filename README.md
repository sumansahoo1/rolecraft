# RoleCraft

An agentic resume builder. Give it your master resume and a job description — paste it or import it from a job link. It analyzes, maps, generates, then loops — critique, revise, critique, revise — until the AI can't find anything left to improve. The pipeline runs in your browser.

## The idea

LLM-generated resumes are mediocre on the first pass. A human doesn't write a resume once — they draft, review, notice weak spots, fix them, re-read, tweak again. This project gives that loop to an AI.

The pipeline:

```
JD Analysis → Experience Mapping → Resume Generation
                ↑                        ↓
                └──── Critique Loop ◄─────┘
                     (scores, finds weaknesses,
                      generates prioritized revision plan,
                      rewrites weak sections,
                      checks if it's actually
                      better, repeats)
                         ↓
                    ResumeSpec → LaTeX Source → HTML Preview → Verification → Export
```

The AI critiques its own output as a senior hiring manager would — scoring across ATS compatibility, relevance, impact quantification, clarity, career progression, and authenticity. Each suggestion is categorized (fabrication, impact, ATS, clarity, content) for prioritized surgical revision. It tracks recurring weaknesses across iterations so it doesn't chase its own tail. It keeps the best-scoring version, not just the last one.

### Convergence

Multi-signal convergence detection — no single heuristic decides "done":

| Signal            | Condition                                                               |
| ----------------- | ----------------------------------------------------------------------- |
| Score ceiling     | Overall ≥ 95 AND ATS ≥ 90                                               |
| Score stagnation  | Delta < 3 points for 2 consecutive rounds (score ≥ 75, ATS ≥ 80)        |
| No new weaknesses | Critique found nothing new to fix (score ≥ 75)                          |
| Stale critique    | Weaknesses + suggestions ≥ 80% Jaccard overlap for 2 consecutive rounds |
| No resume change  | Resume text ≥ 95% similar to previous iteration                         |
| LLM judgment      | Model self-reports `isConverged: true` (score ≥ 85)                     |

Hard cap at 50 iterations. Usually converges in 4–7.

### GitHub Work Summarizer

Paste a public GitHub profile URL, `@handle`, or username into **GitHub Work**. The browser pulls public profile data, repositories, languages, READMEs, sampled commits, pull requests, and issues directly from `api.github.com`, then builds a deterministic multi-year timeline before asking the AI for a grounded narrative.

- **Sampled, not complete.** The report covers the account's full date range, but commit and PR/issue evidence is sampled. Yearly counts are lower bounds, and the UI says so. It is not a GitHub contribution graph.
- **REST-only and client-side.** No GraphQL, no proxy, no API routes. Anonymous access works within GitHub's 60 core requests/hour limit (search is a separate 10/minute bucket); an optional personal access token (fine-grained public-read or classic no-scope) raises the core limit to 5,000 requests/hour and enables deeper sampling. The token is stored in `localStorage` and sent only to `api.github.com`.
- **Grounded AI output.** The AI receives a compact dossier. Numbers are checked against deterministic data; unverified numeric claims are removed, and each project spotlight is grounded only in that repository's own metadata. Project spotlights may only reference analyzed (dossier) project repositories; unknown spotlight repositories are dropped. The deterministic stats, timeline, and project facts remain available even if the AI summary fails.
- **Export and reuse.** Copy or download a Markdown report, or append up to four top projects to the master resume without overwriting existing data.

### Job link import

Paste a job-posting URL instead of the description. Known boards (Greenhouse, Lever, SmartRecruiters) are read from their public APIs; other job pages go through the optional `r.jina.ai` reader.

- **Editable before it counts.** The fetched description always lands in an editable box. It is never submitted silently unless auto-run is on, the result is `ok`, and there are no material warnings.
- **Reader fallback is optional and labelled.** It is on by default, every result says when `r.jina.ai` was used, and it can be turned off. Turning it off stops only `r.jina.ai` requests; ATS API requests still happen.
- **Capped.** Descriptions are limited to 30,000 characters; a truncated result is labelled. Pasted text above the limit is rejected with “Job description is too long (30000-character limit). Trim it before generating.”
- **Manual fallback.** If fetching fails, paste the description manually. No fetched text is persisted.

### Auto-fit

After generation, the ResumeSpec is rendered to HTML and measured in a real browser layout engine. Content that overflows 1 letter-size page triggers progressive font-size shrinking (5 levels, 0.5pt per level) until it fits. The final PDF is generated from the shrunk spec with measurement-driven sizing.

## A few things about how it's built

- **No backend of its own.** No server, no API routes, no database. The browser talks directly to AI providers, GitHub's REST API, and supported job-board APIs. Only when you fetch a link that isn't a supported job board — or a board API doesn't return the posting — and the reader fallback is on does the posting URL go to the third-party `r.jina.ai` reader. Your resume, job descriptions, and a compact dossier of GitHub profile data go to the AI provider you choose. Your API key, resume, and the optional GitHub token sit in `localStorage`; the token is sent only to `api.github.com`. You can verify all of this in the network tab.
- **Limited reader exposure.** The reader receives only the posting URL and standard HTTP metadata (IP address, browser user agent), never your resume, API key, or generated content. Private and intranet hosts are rejected before any request.
- **Multi-provider.** DeepSeek, OpenAI, Anthropic, Google (Gemini), and OpenRouter. Per-provider API key storage with legacy key migration. Each provider has its own request body builder and response parser (Anthropic's Messages API and Google's generateContent differ from the OpenAI-compatible shape).
- **8 distinct prompts**, each with a specific job. The resume generation prompt is ~150 lines covering the impact framework, quantification tiers, role tailoring, and inference rules. The critique prompt is ~50 lines of structured analysis dimensions plus categorized suggestions. The GitHub summary prompt is grounding-first: it forbids inferred employment/impact claims and requires exact repository names from the dossier.
- **The convergence logic is explicit**, not just asking the LLM "are we done?" It cross-checks staleness, dual score ceilings, delta stagnation, and LLM self-judgment — with protections against infinite critique loops.
- **LaTeX output** via a deterministic template (not LLM-generated `.tex` — those hallucinate). Compiles to a 1-page letter-size PDF with proper typesetting.
- **Everything is typed.** Full TypeScript interfaces for the pipeline state, resume structure, critique results, revision plans, and LaTeX spec.

## Quick start

```bash
git clone https://github.com/sumansahoo1/rolecraft.git
cd rolecraft && npm install && npm run dev
```

You'll need an API key from any supported provider: [DeepSeek](https://platform.deepseek.com/api_keys), [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/), [Google AI](https://aistudio.google.com/apikey), or [OpenRouter](https://openrouter.ai/keys). Paste it in Settings, upload your resume, paste a JD or a job link, hit Generate.

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · DeepSeek / OpenAI / Anthropic / Google / OpenRouter · pdfjs-dist · mammoth · jsPDF · docx · LaTeX

## Dev tooling

Prettier (with `prettier-plugin-tailwindcss`) · ESLint v9 flat config (core-web-vitals, typescript, prettier, tailwindcss) · Vitest (unit tests, node environment) · Husky v9 + lint-staged (pre-commit: eslint --fix + prettier) · commitlint (Conventional Commits) · knip (dead code detection) · EditorConfig · VS Code workspace settings

```bash
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Vitest unit tests (non-watch)
npm run test:watch    # Vitest in watch mode
npm run test:typecheck # Typecheck tests (separate from Next build)
npm run format        # Prettier --write
npm run format:check  # Prettier --check
npm run knip          # Dead code detection
npm run sort-pkg      # Canonical package.json ordering
```

## Structure

```
src/
  app/
    app/
      builder/       # Pipeline orchestration page
      resume/        # Master resume editor + AI extraction from PDF/DOCX
      github/        # GitHub work summarizer
      settings/      # Provider + API key + model selection
  hooks/
    usePipeline.ts           # State machine, 7-step pipeline, critique loop
    useJobDescriptionFetch.ts # Job-link fetch controller adapter
    useResumeExtraction.ts   # PDF/DOCX → structured MasterResume
    useGitHubWorkSummary.ts  # GitHub collection/summary state machine
    useListField.ts          # Reusable list field management
  lib/
    ai/
      prompts.ts         # 8 system prompts
      provider.ts        # Multi-provider dispatch (5 providers)
      json-parser.ts     # Robust JSON extraction from LLM output
    github/
      username.ts        # Profile URL/handle parsing + validation
      client.ts          # REST client, budget, retries, abort, rate limits
      normalize.ts       # API → domain, public-only filtering, URL safety
      aggregate.ts       # Stats, timeline, language mix, project ranking
      collect.ts         # Sampling pipeline + request caps
      context.ts         # Compact AI dossier + compaction
      summary.ts         # AI output validation + numeric grounding
      state.ts           # Reducer + pre-collection key guard
      markdown.ts        # Markdown report builder
      resume-merge.ts    # Safe project append into raw extraction JSON
    jd-link/
      url.ts             # Job URL parsing + private-host validation
      ats.ts             # Greenhouse, Lever, SmartRecruiters adapters
      reader.ts          # Optional r.jina.ai reader
      http.ts            # Capped, abortable text fetch
      html.ts            # Conservative HTML → text
      text.ts            # Normalization, quality/warning assessment, truncation
      extract.ts         # ATS → reader orchestration
      controller.ts      # Fetch lifecycle, run IDs, abort
      state.ts           # Pure fetch reducer
      messages.ts        # Canonical UI copy
      errors.ts          # Error classification
      constants.ts       # Limits and timeouts
    pipeline/
      classification.ts  # Categorized suggestions + priority
      constants.ts       # All tuning knobs
      context-builder.ts # Critique and revision context assembly
      convergence.ts     # Multi-signal convergence detection
      revision-parser.ts # Revision report extraction
      revision-planner.ts # Prioritized action plan from critique
      run-epoch.ts       # Per-run epoch guard for pipeline state writes
      similarity.ts      # Jaccard + resume text similarity
    latex/
      engine.ts          # Browser LaTeX engine (local compilation)
      template.ts        # Deterministic .tex template
      render.ts          # ResumeSpec → HTML
      measure.ts         # Browser layout measurement
      shrink.ts          # Auto-shrink to 1 page
      verify.ts          # LaTeX compilation verification
      verify-builder.ts  # Verification result assembly
    export/
      index.ts           # TXT, DOCX, PDF (plain + spec), .tex download
    parse/
      pdf.ts             # PDF text extraction (pdfjs-dist)
      docx.ts            # DOCX text extraction (mammoth)
    storage/
      local.ts           # localStorage wrappers (5 providers + legacy compat)
    utils.ts             # uid(), clamp(), sleep()
  components/
    layout/              # AppSidebar
    github/              # Work panel, report, summary, coverage, progress
    pipeline/            # CritiquePanel, ExperienceMappingPanel, JDAnalysisPanel,
                         #   JDInputPanel, LaTeXEditor, LaTeXPreview, PipelineProgress,
                         #   ResumeDisplay, VerificationPanel
    resume/              # ResumeEditor, ResumeInput, JsonImportExport
    ui/                  # shadcn/ui primitives (badge, button, card, dialog, etc.)
    ErrorBoundary.tsx
  types/
    index.ts             # Shared TypeScript interfaces
    github.ts            # GitHub dataset, summary, progress, error types
    jd-link.ts           # Job-link fetch state, source, warning, and error types
```

Start in `src/hooks/usePipeline.ts` (the state machine) and `src/lib/ai/prompts.ts` (the prompts).

## License

MIT
