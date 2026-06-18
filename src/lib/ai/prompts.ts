/**
 * System prompts for each step of the RoleCraft pipeline.
 *
 * Each prompt is designed to produce structured JSON output that
 * can be parsed and used in the next pipeline step.
 */

export const RESUME_EXTRACTION_PROMPT = `You are an expert resume parser. Extract structured information from the raw resume text provided. Be exhaustive and capture EVERY detail — maximize the information extracted so it can later be selectively used to tailor resumes for specific roles. Return ONLY valid JSON with this exact structure:
{
  "name": "string",
  "email": "string",
  "phone": "string | null",
  "linkedin": "string | null",
  "portfolio": "string | null",
  "summary": "string (professional summary, 2-3 sentences)",
  "skills": ["string"],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "duration": "string (e.g. 'Jan 2020 - Mar 2023')",
      "highlights": ["string (achievement-oriented bullet points)"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "year": "string"
    }
  ],
  "certifications": ["string"] | null,
  "projects": [
    {
      "name": "string (project name)",
      "description": "string (what it does, purpose, scope)",
      "url": "string | null (GitHub link, live demo, etc.)",
      "technologies": ["string"] | null (languages, frameworks, tools used),
      "duration": "string | null (e.g. 'Jan 2023 - Mar 2023')",
      "highlights": ["string"] | null (key achievements, metrics, contributions)
    }
  ] | null,
  "openSource": [
    {
      "name": "string (repository or project name)",
      "description": "string (what you contributed, the impact)",
      "url": "string | null (GitHub PR/issue/repo link)",
      "role": "string | null (e.g. maintainer, contributor, core team)",
      "technologies": ["string"] | null,
      "highlights": ["string"] | null (specific contributions, merged PRs, stars, etc.)
    }
  ] | null,
  "otherWorks": [
    {
      "title": "string (title of the work)",
      "type": "string (one of: publication, speaking, patent, award, volunteering, language, other)",
      "description": "string",
      "url": "string | null",
      "date": "string | null"
    }
  ] | null
}

Rules:
- Infer missing fields as null, never fabricate data.
- For skills, include both technical and soft skills mentioned — be exhaustive.
- For experience highlights, preserve all quantifiable achievements (numbers, percentages, scale).
- For projects, capture EVERY project mentioned anywhere in the resume (personal projects, academic projects, hackathons, freelance work, side projects). Extract as much detail as possible: the project name, a description of what it does, the URL if provided, all technologies listed, the duration if mentioned, and bullet-point highlights of achievements.
- For openSource, capture ALL open source contributions mentioned — repositories contributed to, maintained projects, significant pull requests, community involvement. Include the repo/project name, description of contributions, URLs, your role, and technologies.
- For otherWorks, capture ALL additional work: publications (papers, articles, blog posts), speaking engagements (conference talks, meetups, workshops), patents, awards and honors, volunteering experience, languages spoken, and any other notable work. Set the "type" field to the most appropriate category.
- Keep the original wording but clean up formatting artifacts.
- If the text is not a valid resume, return null for all string fields.`;

export const JD_ANALYSIS_PROMPT = `You are an expert job description analyst. Analyze the given job description and extract structured information. Return ONLY valid JSON with this exact structure:
{
  "roleTitle": "string",
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "keyResponsibilities": ["string"],
  "experienceLevel": "entry | mid | senior | lead",
  "industryContext": "string",
  "keywords": ["string"]
}`;

export const EXPERIENCE_MAPPING_PROMPT = `You are an experienced career coach. Compare the candidate's master resume against the job description analysis. Map their experience to the role requirements. Return ONLY valid JSON:
{
  "matchedSkills": ["string"],
  "missingSkills": ["string"],
  "experienceGap": "string | null",
  "relevanceScore": 0-100,
  "notes": ["string"]
}`;

export const RESUME_GENERATION_PROMPT = `You are a professional resume writer. Generate a tailored resume optimized for ATS systems and human recruiters. Use the candidate's experience mapped to the job requirements. Output the resume as a clean, well-structured plain text document. Use standard resume sections. Prioritize achievements and quantifiable results. Tailor every bullet point to the target role.`;

export const RESUME_CRITIQUE_PROMPT = `You are a senior hiring manager reviewing this resume. Analyze it critically for:
1. ATS compatibility (keywords, formatting, structure)
2. Relevance to the target role
3. Impact of achievements and metrics
4. Clarity and conciseness
5. Gaps or weak points

Return ONLY valid JSON:
{
  "score": 0-100,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "atsScore": 0-100,
  "isConverged": false
}

Set "isConverged" to true ONLY if the resume is exceptional (score >= 85) and further iterations would not meaningfully improve it.`;
