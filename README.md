# RoleCraft

An agentic resume builder. Give it your master resume and a job description. It analyzes, maps, generates, then loops — critique, revise, critique, revise — until the AI can't find anything left to improve. Everything runs client-side.

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

### Auto-fit

After generation, the ResumeSpec is rendered to HTML and measured in a real browser layout engine. Content that overflows 1 letter-size page triggers progressive font-size shrinking (5 levels, 0.5pt per level) until it fits. The final PDF is generated from the shrunk spec with measurement-driven sizing.

## A few things about how it's built

- **100% client-side.** No server, no proxy, no database. Your API key and resume sit in `localStorage`. Browser talks directly to AI providers. You can verify this in the network tab.
- **Multi-provider.** DeepSeek, OpenAI, Anthropic, Google (Gemini), and OpenRouter. Per-provider API key storage with legacy key migration. Each provider has its own request body builder and response parser (Anthropic's Messages API and Google's generateContent differ from the OpenAI-compatible shape).
- **8 distinct prompts**, each with a specific job. The resume generation prompt is ~150 lines covering the impact framework, quantification tiers, role tailoring, and inference rules. The critique prompt is ~50 lines of structured analysis dimensions plus categorized suggestions.
- **The convergence logic is explicit**, not just asking the LLM "are we done?" It cross-checks staleness, dual score ceilings, delta stagnation, and LLM self-judgment — with protections against infinite critique loops.
- **LaTeX output** via a deterministic template (not LLM-generated `.tex` — those hallucinate). Compiles to a 1-page letter-size PDF with proper typesetting.
- **Everything is typed.** Full TypeScript interfaces for the pipeline state, resume structure, critique results, revision plans, and LaTeX spec.

## Quick start

```bash
git clone https://github.com/sumansahoo1/rolecraft.git
cd rolecraft && npm install && npm run dev
```

You'll need an API key from any supported provider: [DeepSeek](https://platform.deepseek.com/api_keys), [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/), [Google AI](https://aistudio.google.com/apikey), or [OpenRouter](https://openrouter.ai/keys). Paste it in Settings, upload your resume, paste a JD, hit Generate.

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · DeepSeek / OpenAI / Anthropic / Google / OpenRouter · pdfjs-dist · mammoth · jsPDF · docx · LaTeX

## Dev tooling

Prettier (with `prettier-plugin-tailwindcss`) · ESLint v9 flat config (core-web-vitals, typescript, prettier, tailwindcss) · Husky v9 + lint-staged (pre-commit: eslint --fix + prettier) · commitlint (Conventional Commits) · knip (dead code detection) · EditorConfig · VS Code workspace settings

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier --write
npm run format:check # Prettier --check
npm run knip         # Dead code detection
npm run sort-pkg     # Canonical package.json ordering
```

## Structure

```
src/
  app/
    app/
      builder/       # Pipeline orchestration page
      resume/        # Master resume editor + AI extraction from PDF/DOCX
      settings/      # Provider + API key + model selection
  hooks/
    usePipeline.ts      # State machine, 7-step pipeline, critique loop
    useResumeExtraction.ts  # PDF/DOCX → structured MasterResume
    useListField.ts         # Reusable list field management
  lib/
    ai/
      prompts.ts         # 8 system prompts
      provider.ts        # Multi-provider dispatch (5 providers)
      json-parser.ts     # Robust JSON extraction from LLM output
    pipeline/
      classification.ts  # Categorized suggestions + priority
      constants.ts       # All tuning knobs
      context-builder.ts # Critique and revision context assembly
      convergence.ts     # Multi-signal convergence detection
      revision-parser.ts # Revision report extraction
      revision-planner.ts # Prioritized action plan from critique
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
    pipeline/            # CritiquePanel, ExperienceMappingPanel, JDAnalysisPanel,
                         #   LaTeXEditor, LaTeXPreview, PipelineProgress,
                         #   ResumeDisplay, VerificationPanel
    resume/              # ResumeEditor, ResumeInput, JsonImportExport
    ui/                  # shadcn/ui primitives (badge, button, card, dialog, etc.)
    ErrorBoundary.tsx
  types/
    index.ts             # All TypeScript interfaces
```

Start in `src/hooks/usePipeline.ts` (the state machine) and `src/lib/ai/prompts.ts` (the prompts).

## License

MIT
