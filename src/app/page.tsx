import { FileText, Search, GitBranch, RefreshCw, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'JD Analysis',
    desc: 'Paste any job description — RoleCraft extracts key skills, requirements, and role context.',
  },
  {
    icon: GitBranch,
    title: 'Experience Mapping',
    desc: 'Your master resume is mapped against the JD. Gaps and matches are identified.',
  },
  {
    icon: FileText,
    title: 'Resume Generation',
    desc: 'A targeted resume is generated, optimized for ATS and recruiter review.',
  },
  {
    icon: RefreshCw,
    title: 'Critique Loop',
    desc: 'The resume is critiqued, fixed, critiqued again — until it converges on perfection.',
  },
  {
    icon: CheckCircle,
    title: 'Final Resume',
    desc: 'A polished, role-optimized resume ready to download or copy.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
            RoleCraft
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Paste a job description. Get the perfect resume. Powered by AI.
        </p>
        <div className="mt-8 flex gap-4">
          <a
            href="/app"
            className="rounded-lg bg-[#6366f1] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#4f46e5]"
          >
            Get Started
          </a>
          <a
            href="#how-it-works"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            How It Works
          </a>
        </div>
      </section>

      {/* Steps */}
      <section
        id="how-it-works"
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-24"
      >
        <h2 className="text-center text-2xl font-semibold">How It Works</h2>
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="flex items-start gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
              <step.icon className="size-5" />
            </div>
            <div>
              <h3 className="font-medium">
                <span className="text-zinc-400">0{i + 1}.</span> {step.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your data stays in your browser. API key stored locally. Nothing leaves your machine.
        </p>
      </section>
    </div>
  );
}
