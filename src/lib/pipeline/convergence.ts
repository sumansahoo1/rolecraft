import type { ResumeCritique, ConvergenceResult } from "@/types";
import { computeJaccardSimilarity } from "./similarity";
import {
  SCORE_CEILING,
  ATS_SCORE_CEILING,
  SCORE_DELTA_THRESHOLD,
  CRITIQUE_STALENESS_THRESHOLD,
  MIN_SCORE_FOR_EARLY_EXIT,
  MIN_ATS_SCORE_FOR_DELTA,
  MAX_CRITIQUE_ITERATIONS,
  MIN_SCORE_FOR_LLM_JUDGMENT,
} from "./constants";

/** Multi-signal convergence detection combining LLM judgment and algorithmic checks. */
export function checkAlgorithmicConvergence(
  current: ResumeCritique,
  previous: ResumeCritique | null,
  iteration: number,
  history: Array<{ iteration: number; resume: string; critique: ResumeCritique }>
): ConvergenceResult {
  const newWeaknesses = current.newWeaknesses ?? [];

  // 0a. Staleness detection — critique content is nearly identical to previous iteration
  //     (same weaknesses + same suggestions = AI has no new ideas → stop wasting tokens)
  if (previous && history.length >= 3) {
    const currWeakOverlap = computeJaccardSimilarity(
      current.weaknesses,
      previous.weaknesses
    );
    const currSuggOverlap = computeJaccardSimilarity(
      current.suggestions,
      previous.suggestions
    );

    if (
      currWeakOverlap >= CRITIQUE_STALENESS_THRESHOLD &&
      currSuggOverlap >= CRITIQUE_STALENESS_THRESHOLD
    ) {
      // Current critique is stale — was the previous one also stale?
      const prevPrev = history[history.length - 3].critique;
      const prevWeakOverlap = computeJaccardSimilarity(
        previous.weaknesses,
        prevPrev.weaknesses
      );
      const prevSuggOverlap = computeJaccardSimilarity(
        previous.suggestions,
        prevPrev.suggestions
      );

      if (
        prevWeakOverlap >= CRITIQUE_STALENESS_THRESHOLD &&
        prevSuggOverlap >= CRITIQUE_STALENESS_THRESHOLD
      ) {
        return {
          isConverged: true,
          reason: "stale_critique",
          scoreDelta: current.score - previous.score,
          newWeaknesses,
        };
      }
    }
  }

  // 1. Dual ceiling: both overall score AND ATS score must be exceptional
  if (current.score >= SCORE_CEILING && current.atsScore >= ATS_SCORE_CEILING) {
    return {
      isConverged: true,
      reason: "score_ceiling",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 1b. Overall score ceiling alone: exceptional quality, but note ATS gap
  if (current.score >= SCORE_CEILING) {
    return {
      isConverged: true,
      reason: "score_ceiling",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 2. Score delta: less than threshold improvement over last iteration,
  //    and at least 2 iterations completed (so we have a trend)
  //    Only applies when score is already decent AND ATS score is respectable
  if (previous && history.length >= 2) {
    const scoreDelta = current.score - previous.score;
    if (scoreDelta < SCORE_DELTA_THRESHOLD && current.score >= MIN_SCORE_FOR_EARLY_EXIT && current.atsScore >= MIN_ATS_SCORE_FOR_DELTA) {
      // Check the last two deltas — if both are tiny, we've stagnated
      const prevPrev = history.length >= 2 ? history[history.length - 2].critique : null;
      if (prevPrev) {
        const prevDelta = previous.score - prevPrev.score;
        if (prevDelta < SCORE_DELTA_THRESHOLD) {
          return {
            isConverged: true,
            reason: "score_delta",
            scoreDelta,
            newWeaknesses,
          };
        }
      }
    }
  }

  // 3. No new weaknesses: critique found nothing new to fix, and score is decent
  if (previous && newWeaknesses.length === 0 && current.score >= MIN_SCORE_FOR_EARLY_EXIT) {
    return {
      isConverged: true,
      reason: "no_new_weaknesses",
      scoreDelta: current.score - previous.score,
      newWeaknesses: [],
    };
  }

  // 4. Max iterations reached
  if (iteration >= MAX_CRITIQUE_ITERATIONS) {
    return {
      isConverged: false,
      reason: "max_iterations",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 5. LLM self-judgment
  if (current.isConverged && current.score >= MIN_SCORE_FOR_LLM_JUDGMENT) {
    return {
      isConverged: true,
      reason: "llm_judgment",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  return {
    isConverged: false,
    reason: "llm_judgment",
    scoreDelta: previous ? current.score - previous.score : null,
    newWeaknesses,
  };
}
