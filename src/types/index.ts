// ─── AI Provider ────────────────────────────────────────────

export type DeepSeekModel = "deepseek-v4-pro" | "deepseek-v4-flash";

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
  | "resume-critique"
  | "resume-spec"
  | "latex-generation"
  | "latex-verification";

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
    | "no_resume_change"
    | "stale_critique"
    | "max_iterations";
  scoreDelta: number | null;
  newWeaknesses: string[];
}

// ─── LaTeX / ResumeSpec Types ───────────────────────────────

export interface ResumeSpec {
  meta: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    targetRole: string;
  };
  summary: {
    text: string;
  };
  skills: {
    categories: Array<{
      name: string;
      items: string[];
    }>;
  };
  experience: Array<{
    company: string;
    role: string;
    dates: string;
    bullets: string[];
    featured: boolean;
  }>;
  projects: Array<{
    name: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    year: string;
  }>;
  optionalSections?: Array<{
    heading: string;
    items: string[];
  }>;
}

export interface LatexVerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface LatexVerificationIssue {
  severity: "error" | "warning";
  category: "compilation" | "page_count" | "missing_section" | "font" | "overflow" | "formatting";
  message: string;
}

export interface LatexVerificationResult {
  passes: boolean;
  checks: LatexVerificationCheck[];
  issues: LatexVerificationIssue[];
  pageCount: number | null;
  fixAttempts: number;
}

// ─── Pipeline State ────────────────────────────────────────

export const TOKEN_BUDGETS: Record<PipelineStep, number> = {
  "jd-analysis": 2048,
  "experience-mapping": 2048,
  "resume-generation": 8192,
  "resume-critique": 6144,
  "resume-spec": 8192,
  "latex-generation": 0,
  "latex-verification": 0,
};

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
  // LaTeX pipeline fields
  resumeSpec: ResumeSpec | null;
  latexSource: string | null;
  latexHtmlBlob: Blob | null;
  latexVerification: LatexVerificationResult | null;
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
