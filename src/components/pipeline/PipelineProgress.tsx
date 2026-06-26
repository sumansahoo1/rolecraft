'use client';

import { CheckCircle2, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineStep } from '@/types';

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'jd-analysis', label: 'JD Analysis' },
  { key: 'experience-mapping', label: 'Experience Mapping' },
  { key: 'resume-generation', label: 'Resume Text' },
  { key: 'resume-critique', label: 'Critique' },
  { key: 'resume-spec', label: 'Structurize' },
  { key: 'latex-generation', label: 'LaTeX Gen' },
  { key: 'latex-verification', label: 'Verify' },
];

interface PipelineProgressProps {
  currentStep: PipelineStep | null;
  running: boolean;
  iteration: number;
}

export function PipelineProgress({ currentStep, running, iteration }: PipelineProgressProps) {
  const currentIdx = currentStep ? STEPS.findIndex((s) => s.key === currentStep) : -1;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {STEPS.map((step, i) => {
        const isDone = currentIdx > i || (!running && currentIdx >= i);
        const isCurrent = running && currentIdx === i;
        const isPending = !isDone && !isCurrent;

        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && <div className={cn('h-px w-4', isDone ? 'bg-primary' : 'bg-border')} />}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors',
                isDone && 'bg-primary/10 text-primary',
                isCurrent && 'bg-primary text-primary-foreground',
                isPending && 'bg-muted text-muted-foreground'
              )}
            >
              {isCurrent ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isDone ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              {step.key === 'resume-critique' && iteration > 0 && (
                <span className="tabular-nums">({iteration})</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
