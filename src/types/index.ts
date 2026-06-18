// ─── AI Provider ────────────────────────────────────────────

export type DeepSeekModel = "deepseek-chat" | "deepseek-flash";

// ─── Resume Data ────────────────────────────────────────────

export interface Experience {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

export interface Project {
  name: string;
  description: string;
  url?: string;
  technologies?: string[];
  duration?: string;
  highlights?: string[];
}

export interface OpenSource {
  name: string;
  description: string;
  url?: string;
  role?: string;
  technologies?: string[];
  highlights?: string[];
}

export interface OtherWork {
  title: string;
  type: string;
  description: string;
  url?: string;
  date?: string;
}

export interface MasterResume {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  certifications?: string[];
  projects?: Project[];
  openSource?: OpenSource[];
  otherWorks?: OtherWork[];
  customSections?: Record<string, string[]>;
}

// ─── AI Pipeline Types ─────────────────────────────────────

export type PipelineStep =
  | "jd-analysis"
  | "experience-mapping"
  | "resume-generation"
  | "resume-critique";

export interface JDAnalysis {
  roleTitle: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keyResponsibilities: string[];
  experienceLevel: string;
  industryContext: string;
  keywords: string[];
  coreResponsibilities: string[];
  hiddenRequirements: string[];
  atsKeywords: string[];
}

export interface ExperienceMapping {
  matchedSkills: string[];
  missingSkills: string[];
  experienceGap: string | null;
  relevanceScore: number; // 0-100
  notes: string[];
  recommendedExperience: string[];
  recommendedProjects: string[];
  sectionsToDownplay: string[];
}

export type CritiqueCategory =
  | "fabrication"
  | "content"
  | "impact"
  | "ats"
  | "clarity";

export interface CategorizedSuggestions {
  fabrication: string[];
  content: string[];
  impact: string[];
  ats: string[];
  clarity: string[];
}

export interface ResumeCritique {
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  atsScore: number;
  isConverged: boolean;
  categorizedSuggestions?: CategorizedSuggestions;
  previousWeaknessesAddressed?: string[];
  newWeaknesses?: string[];
  recurringWeaknesses?: string[];
}

export interface RevisionPlan {
  topSuggestions: string[];
  categories: CategorizedSuggestions;
  addressedFromPrevious: string[];
  unresolvedFromPrevious: string[];
}

export interface ConvergenceResult {
  isConverged: boolean;
  reason:
    | "llm_judgment"
    | "score_ceiling"
    | "score_delta"
    | "no_new_weaknesses"
    | "max_iterations";
  scoreDelta: number | null;
  newWeaknesses: string[];
}

// ─── Pipeline State ────────────────────────────────────────

export interface PipelineState {
  jd: string;
  masterResume: MasterResume;
  step: PipelineStep;
  analysis: JDAnalysis | null;
  mapping: ExperienceMapping | null;
  currentResume: string | null;
  critique: ResumeCritique | null;
  iteration: number;
  history: Array<{
    iteration: number;
    resume: string;
    critique: ResumeCritique;
  }>;
  bestResume: string | null;
  bestScore: number;
  convergenceResult: ConvergenceResult | null;
}

// ─── Storage ────────────────────────────────────────────────

export interface StoredData {
  apiKey?: string;
  model?: DeepSeekModel;
  masterResume?: MasterResume;
  preferences?: {
    tone?: "professional" | "casual" | "technical";
    format?: "bullet" | "paragraph";
  };
}

// ─── App Status ─────────────────────────────────────────────

export type AppStatus = "idle" | "running" | "paused" | "complete" | "error";
