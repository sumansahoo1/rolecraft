import { describe, expect, it } from 'vitest';
import { GITHUB_LIMITS, planFromLimits } from './collect';
import type { GitHubRateLimits } from '@/types';

function limits(coreRemaining: number, searchRemaining: number): GitHubRateLimits {
  return {
    core: { limit: 60, remaining: coreRemaining, resetAt: '2026-06-01T01:00:00Z' },
    search: { limit: 10, remaining: searchRemaining, resetAt: '2026-06-01T00:10:00Z' },
  };
}

describe('GitHub request planning', () => {
  it('rejects anonymous runs below the core threshold and accepts the boundary', () => {
    expect(() => planFromLimits(GITHUB_LIMITS.anonymous, limits(49, 10))).toThrow();
    try {
      planFromLimits(GITHUB_LIMITS.anonymous, limits(49, 10));
    } catch (err) {
      expect(err).toMatchObject({ code: 'RATE_LIMITED' });
    }
    const plan = planFromLimits(GITHUB_LIMITS.anonymous, limits(50, 10));
    expect(plan.coreCap).toBe(45);
    expect(plan.searchPlan).toBe('full');
  });

  it('plans anonymous search quotas at the full/fixed/none boundaries', () => {
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 4)).searchPlan).toBe('full');
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 3)).searchPlan).toBe('fixed');
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 2)).searchPlan).toBe('none');
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 2)).searchCap).toBe(0);
  });

  it('rejects token runs below the core threshold and caps to available quota', () => {
    expect(() => planFromLimits(GITHUB_LIMITS.token, limits(89, 30))).toThrow();
    try {
      planFromLimits(GITHUB_LIMITS.token, limits(89, 30));
    } catch (err) {
      expect(err).toMatchObject({ code: 'RATE_LIMITED' });
    }
    const plan = planFromLimits(GITHUB_LIMITS.token, limits(90, 30));
    expect(plan.coreCap).toBe(85);
    expect(plan.searchPlan).toBe('full');
    expect(plan.searchCap).toBe(8);
  });

  it('plans token search quotas at the full/fixed/none boundaries', () => {
    expect(planFromLimits(GITHUB_LIMITS.token, limits(500, 8)).searchPlan).toBe('full');
    expect(planFromLimits(GITHUB_LIMITS.token, limits(500, 7)).searchPlan).toBe('fixed');
    expect(planFromLimits(GITHUB_LIMITS.token, limits(500, 6)).searchPlan).toBe('fixed');
    expect(planFromLimits(GITHUB_LIMITS.token, limits(500, 5)).searchPlan).toBe('none');
    expect(planFromLimits(GITHUB_LIMITS.token, limits(500, 7)).searchCap).toBe(7);
  });

  it('caps search requests to the remaining quota', () => {
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 4)).searchCap).toBe(4);
    expect(planFromLimits(GITHUB_LIMITS.anonymous, limits(60, 3)).searchCap).toBe(3);
  });
});
