import { describe, expect, it } from 'vitest';
import type { MasterResume } from '@/types';
import {
  canonicalJson,
  mergeMasterResumeIntoRaw,
  parseMasterResume,
  sanitizeMasterResumeRaw,
} from './normalize';

function baseResume(overrides: Partial<MasterResume> = {}): MasterResume {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    summary: 'Engineer',
    skills: ['TypeScript'],
    experience: [],
    education: [],
    ...overrides,
  };
}

describe('parseMasterResume', () => {
  it('parses raw extraction data into the typed shape', () => {
    const parsed = parseMasterResume({
      name: 'Ada',
      email: 'ada@example.com',
      skills: { Frontend: ['React'], Backend: ['Node'] },
      experience: [{ company: 'Analytical Engines', role: 'Engineer', highlights: ['Built it'] }],
      education: [{ institution: 'Cambridge', degree: 'BA', field: 'Maths', year: '1833' }],
      projects: ['Difference Engine'],
      customSections: { Languages: ['English'] },
    });

    expect(parsed.skills).toEqual({ Frontend: ['React'], Backend: ['Node'] });
    expect(parsed.projects).toEqual([{ name: 'Difference Engine', description: '' }]);
    expect(parsed.experience[0].highlights).toEqual(['Built it']);
    expect(parsed.customSections).toEqual({ Languages: ['English'] });
  });

  it('treats null optional fields as undefined', () => {
    const parsed = parseMasterResume({ name: 'Ada', phone: null, github: null });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.github).toBeUndefined();
  });
});

describe('mergeMasterResumeIntoRaw', () => {
  it('preserves unknown fields', () => {
    const raw = { name: 'Ada', futureField: { keep: true } };
    const merged = mergeMasterResumeIntoRaw(raw, baseResume());
    expect(merged.futureField).toEqual({ keep: true });
  });

  it('preserves unknown nested fields when a known item is edited', () => {
    const raw = {
      name: 'Ada',
      experience: [
        {
          company: 'Analytical Engines',
          role: 'Engineer',
          location: 'London',
          highlights: ['Built it'],
        },
      ],
    };
    const resume = baseResume({
      experience: [
        {
          company: 'Analytical Engines',
          role: 'Engineer',
          duration: '1833',
          highlights: ['Built it better'],
        },
      ],
    });

    const merged = mergeMasterResumeIntoRaw(raw, resume);
    expect(merged.experience).toEqual([
      {
        company: 'Analytical Engines',
        role: 'Engineer',
        location: 'London',
        duration: '1833',
        highlights: ['Built it better'],
      },
    ]);
  });

  it('removes empty optional fields', () => {
    const raw = { name: 'Ada', phone: '123', linkedin: 'in/ada' };
    const merged = mergeMasterResumeIntoRaw(raw, baseResume({ phone: '', linkedin: 'in/ada' }));
    expect(merged.phone).toBeUndefined();
    expect(merged.linkedin).toBe('in/ada');
  });

  it('keeps custom sections and drops empty optional arrays', () => {
    const merged = mergeMasterResumeIntoRaw(
      { name: 'Ada' },
      baseResume({
        certifications: [],
        projects: [],
        customSections: { Languages: ['English'] },
      })
    );

    expect(merged.certifications).toBeUndefined();
    expect(merged.projects).toBeUndefined();
    expect(merged.customSections).toEqual({ Languages: ['English'] });
  });
});

describe('sanitizeMasterResumeRaw', () => {
  it('trims empty certification and custom-section lines but keeps unknown fields', () => {
    const sanitized = sanitizeMasterResumeRaw({
      name: 'Ada',
      futureField: true,
      certifications: ['AWS', '', '  '],
      skills: { ' Data ': ['React', 'React', ' '] },
      customSections: { Languages: ['English', ' '], Blank: [] },
    });

    expect(sanitized.futureField).toBe(true);
    expect(sanitized.certifications).toEqual(['AWS']);
    expect(sanitized.skills).toEqual({ Data: ['React'] });
    expect(sanitized.customSections).toEqual({ Languages: ['English'] });
  });
});

describe('canonicalJson', () => {
  it('ignores object key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 })
    );
  });

  it('keeps array order significant', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});
