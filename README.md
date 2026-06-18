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
                      rewrites weak sections,
                      checks if it's actually
                      better, repeats)
                         ↓
                    LaTeX output
```

The AI critiques its own output as a senior hiring manager would — scoring across ATS compatibility, relevance, impact quantification, clarity, career progression, and authenticity. It tracks recurring weaknesses so it doesn't chase its own tail. It keeps the best-scoring version, not just the last one.

It converges when: score hits 95, or improvements stagnate for 2 rounds, or the critique becomes ~identical to the previous one (≥80% Jaccard), or no new weaknesses appear and score ≥ 75.

Worst case it stops after 50 iterations. Usually it's done in 4–7.

## A few things about how it's built

- **100% client-side.** No server, no proxy, no database. Your API key and resume sit in `localStorage`. Browser talks directly to DeepSeek. You can verify this in the network tab.
- **7 distinct prompts**, each with a specific job. The critique prompt alone is ~200 lines — it has to think like a hiring manager, not a chatbot.
- **The convergence logic is explicit**, not just asking the LLM "are we done?" It cross-checks staleness, score ceilings, delta stagnation, and LLM self-judgment.
- **LaTeX output** via a deterministic template (not LLM-generated `.tex` — those hallucinate). Compiles to a 1-page letter-size document with proper typesetting.
- **Everything is typed.** Full TypeScript interfaces for the pipeline state, resume structure, critique results, and LaTeX spec.

## Quick start

```bash
git clone https://github.com/sumansahoo1/rolecraft.git
cd rolecraft && npm install && npm run dev
```

You'll need a [DeepSeek API key](https://platform.deepseek.com/api_keys). Paste it in Settings, upload your resume, paste a JD, hit Generate.

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · DeepSeek · pdfjs-dist · mammoth · jsPDF · LaTeX

## Structure

```
src/
  app/app/
    builder/      # Pipeline orchestration
    resume/       # Master resume editor + AI extraction from PDF/DOCX
    settings/     # API key + model selection
  hooks/
    usePipeline.ts   # State machine, critique loop, convergence checks
  lib/
    ai/
      prompts.ts     # 7 system prompts (the interesting part)
      provider.ts    # Single createChatCompletion() → DeepSeek
    latex/           # Template, browser renderer, verification
    export/          # TXT, DOCX, PDF, .tex
    parse/           # PDF + DOCX text extraction
    storage/         # localStorage wrappers
  components/
    pipeline/        # CritiquePanel, LaTeXEditor, ResumeDisplay, etc.
  types/             # All TS interfaces
```

The logic lives in `src/hooks/usePipeline.ts` and `src/lib/ai/prompts.ts`. Start there.

## License

MIT
