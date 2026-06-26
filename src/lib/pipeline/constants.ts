// ─── Pipeline Tuning Constants ──────────────────────────────────

export const MAX_CRITIQUE_ITERATIONS = 50;
export const TOP_SUGGESTIONS_COUNT = 5;
export const MIN_SCORE_FOR_EARLY_EXIT = 75;
export const SCORE_CEILING = 95;
export const ATS_SCORE_CEILING = 90;
export const SCORE_DELTA_THRESHOLD = 3;
export const RESUME_SIMILARITY_THRESHOLD = 0.95; // Resume text ≥95% similar → unchanged
export const CRITIQUE_STALENESS_THRESHOLD = 0.8; // Weaknesses/suggestions ≥80% overlap → stale
export const MIN_ATS_SCORE_FOR_DELTA = 80; // Minimum ATS score before delta-based convergence
export const MIN_SCORE_FOR_LLM_JUDGMENT = 85; // Score threshold for LLM self-judgment convergence
export const RESUME_GENERATION_TEMPERATURE = 0.4;
export const DEFAULT_STEP_TEMPERATURE = 0.2;
