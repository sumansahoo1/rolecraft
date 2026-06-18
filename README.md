# 🌀 RoleCraft

**AI-powered resume builder that converges on perfection.**

Paste a job description, supply your master resume, and RoleCraft runs a
four-step AI pipeline — JD analysis → experience mapping → resume generation
→ critique loop — until the resume is optimized for the role.

---

## The Idea

Most resume builders are templates with a GPT wrapper. RoleCraft is
different — it's a **convergent optimization loop**:

```
JD → [Analyze] → Experience Map → [Generate] → Resume → [Critique] → Fix → [Critique] → Fix → … → ✅ Done
                                      ↑_____________________________________________↓ (loop until converged)
```

| Step | What it does |
|------|-------------|
| **JD Analysis** | Extracts skills, responsibilities, level, and keywords from the job description |
| **Experience Mapping** | Compares your master resume against the JD — finds matches, gaps, and fit score |
| **Resume Generation** | Crafts a tailored resume optimized for the role and ATS systems |
| **Critique Loop** | Reviews the generated resume, suggests fixes, regenerates, repeats until score ≥ 85 and stable |
| **Final Output** | A polished, role-specific resume ready to download |

### Why "Convergent"?

One-shot AI resumes are mediocre. The critique loop mimics how a human
expert would iterate — get feedback, fix, repeat. RoleCraft keeps looping
until the AI itself agrees the resume meets the bar (score ≥ 85 / 100 with
convergence flag set).

---

## Architecture

**100% client-side.** Nothing is sent to any backend.

```
┌─────────────────────────────────────────┐
│              Browser (Next.js)           │
│                                          │
│  localStorage                            │
│  ├─ Master Resume (JSON)                 │
│  ├─ API Key (your own key)               │
│  └─ Preferences                          │
│                                          │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │  Pipeline    │───→│  AI Provider    │  │
│  │  Controller  │    │  (OpenAI/       │  │
│  │              │←───│   Anthropic/    │  │
│  │  Critique    │    │   Google/       │  │
│  │  Loop Engine │    │   OpenRouter)   │  │
│  └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────┘
```

- **Next.js 16** with App Router (static export compatible)
- **Tailwind CSS v4** for styling
- **TypeScript** throughout
- **lucide-react** for icons
- AI calls go **directly from the browser** to your chosen provider

### Storage Strategy

| Data | Where | Why |
|------|-------|-----|
| API Key | `localStorage` | You keep control. No server-side key storage. |
| Master Resume | `localStorage` | Structured JSON. Survives sessions. ~5MB limit is plenty for text. |
| Pipeline State | React state | Ephemeral per session. Reset on reload. |
| Preferences | `localStorage` | Tone, format, model choice. |

> **Why not a database?** RoleCraft is intentionally no-backend. Your resume
> and API key never touch a server. If you want persistence across devices,
> the master resume can be exported/imported as a JSON file.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx        # Root layout (fonts, metadata)
│   ├── page.tsx          # Landing page
│   ├── globals.css       # Tailwind + theme vars
│   └── app/
│       ├── layout.tsx    # App layout
│       └── page.tsx      # Builder page (TBD)
├── components/
│   ├── ui/               # Reusable UI primitives
│   └── layout/           # Layout components
├── lib/
│   ├── ai/
│   │   ├── provider.ts   # AI provider API calls
│   │   ├── prompts.ts    # System prompts for each step
│   │   └── index.ts
│   ├── storage/
│   │   ├── local.ts      # localStorage helpers
│   │   └── index.ts
│   └── utils/
│       └── index.ts
└── types/
    └── index.ts          # All TypeScript types
```

---

## Configuration

### API Key

You need an API key from one of the supported providers:

| Provider | Models | Recommended |
|----------|--------|-------------|
| [OpenAI](https://platform.openai.com/api-keys) | `gpt-4o`, `gpt-4o-mini` | ✅ Best for structured output |
| [Anthropic](https://console.anthropic.com/) | `claude-sonnet-4`, `claude-haiku-3` | Great for long context |
| [Google](https://ai.google.dev/) | `gemini-2.0-flash`, `gemini-2.5-pro` | Free tier available |
| [OpenRouter](https://openrouter.ai/) | All of the above + more | Single key for multiple models |

The key is stored in your browser's `localStorage` and sent directly to the
provider. **RoleCraft never sees or stores your key.**

---

## Master Resume Storage — Options

Since you asked "how to store it permanently as a website":

1. **localStorage** (current) — Simple, persists across sessions, works offline. Good for an MVP. Export/import JSON as backup.

2. **IndexedDB** — More robust, can handle larger data, binary attachments (profile photos). Better for long-term use.

3. **File-based** — Store as a `.json` file. User uploads their master resume each session. Cleanest for privacy, simplest to implement.

4. **Cloud sync** (future) — If you want multi-device access, add optional sync to GitHub Gist, Google Drive, or a simple backend. **API key should always stay client-side.**

**Recommendation for MVP:** Start with `localStorage` + JSON export/import. It's instant, private, and zero infrastructure.

---

## Future Ideas

- [ ] PDF export (with formatting)
- [ ] ATS score simulation
- [ ] Multiple resume variants (one master → many tailored resumes)
- [ ] Cover letter generation
- [ ] Interview question predictor (based on JD analysis)
- [ ] Claude Code / Cursor rules for AI-assisted development

---

## License

MIT
