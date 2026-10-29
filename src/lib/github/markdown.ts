import type { GitHubDataset, GitHubWorkSummary } from '@/types';

export function escapeMarkdownText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([\[\]()<>])/g, '\\$1')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function link(label: string, url: string | null): string {
  if (!url) return escapeMarkdownText(label);
  return `[${escapeMarkdownText(label)}](${url})`;
}

function percentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function buildGitHubMarkdown(
  dataset: GitHubDataset,
  summary: GitHubWorkSummary | null
): string {
  const { profile, stats, coverage, timeline, projects, collaboration } = dataset;
  const lines: string[] = [];
  const name = profile.name ?? profile.login;

  lines.push(`# ${escapeMarkdownText(name)} — GitHub work summary`);
  lines.push('');
  lines.push(
    `${link(`@${profile.login}`, profile.htmlUrl)}${profile.bio ? ` — ${escapeMarkdownText(profile.bio)}` : ''}`
  );
  lines.push('');
  lines.push(
    '> Sampled from public GitHub REST data. Yearly counts are lower bounds; a year with no sampled evidence is not necessarily inactive. This is not a GitHub contribution graph.'
  );
  lines.push('');

  if (summary) {
    lines.push(`## ${escapeMarkdownText(summary.headline)}`);
    lines.push('');
    lines.push(escapeMarkdownText(summary.professionalOverview));
    lines.push('');
  }

  lines.push('## GitHub stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Public repositories | ${stats.publicRepos} |`);
  lines.push(`| Repositories analyzed | ${stats.reposAnalyzed} |`);
  lines.push(`| Stars on analyzed original repos | ${stats.starsAnalyzed} |`);
  lines.push(`| Forks on analyzed original repos | ${stats.forksAnalyzed} |`);
  lines.push(`| Followers | ${stats.followers} |`);
  lines.push(`| Active years | ${stats.activeYearCount} |`);
  lines.push(
    `| Pull requests authored | ${stats.pullRequestsTotal ?? 'unknown'} total, ${stats.pullRequestsSampled} sampled |`
  );
  lines.push(
    `| Issues authored | ${stats.issuesTotal ?? 'unknown'} total, ${stats.issuesSampled} sampled |`
  );
  lines.push('');

  if (stats.topLanguages.length > 0) {
    lines.push('## Languages');
    lines.push('');
    const source =
      stats.languageSource === 'languages-api'
        ? 'from language byte counts'
        : 'from primary-language repo counts';
    lines.push(`_${source}._`);
    lines.push('');
    for (const language of stats.topLanguages.slice(0, 10)) {
      lines.push(
        `- **${escapeMarkdownText(language.name)}** — ${percentage(language.percentage)} (${language.repoCount} repos)`
      );
    }
    lines.push('');
  }

  if (timeline.length > 0) {
    lines.push('## Yearly activity (sampled)');
    lines.push('');
    lines.push(
      'Sampled commit + PR + issue signals (lower bound). Missing or zero years may reflect sampling, not inactivity.'
    );
    lines.push('');
    lines.push(
      '| Year | Commits sampled | PRs sampled | Issues sampled | Repos created | Repos last pushed |'
    );
    lines.push('| ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const row of timeline) {
      lines.push(
        `| ${row.year} | ${row.commitsSampled} | ${row.pullRequestsSampled} | ${row.issuesSampled} | ${row.reposCreated} | ${row.reposPushed} |`
      );
    }
    lines.push('');
  }

  if (projects.length > 0) {
    lines.push('## Project spotlights');
    lines.push('');
    for (const project of projects) {
      lines.push(`### ${link(project.repo.fullName, project.repo.htmlUrl)}`);
      lines.push('');
      if (project.repo.description) {
        lines.push(escapeMarkdownText(project.repo.description));
        lines.push('');
      }
      lines.push(
        `- ${project.repo.stars} GitHub stars · ${project.repo.forks} forks · ${project.commitCountSampled} sampled commits`
      );
      if (project.languages.length > 0) {
        lines.push(
          `- Languages: ${project.languages.map((language) => `${escapeMarkdownText(language.name)} (${percentage(language.percentage)})`).join(', ')}`
        );
      }
      lines.push('');
    }
  }

  if (summary) {
    if (summary.expertise.length > 0) {
      lines.push('## Expertise');
      lines.push('');
      for (const item of summary.expertise) {
        lines.push(`- **${escapeMarkdownText(item.area)}**`);
        for (const evidence of item.evidence) {
          lines.push(`  - ${escapeMarkdownText(evidence)}`);
        }
      }
      lines.push('');
    }

    if (summary.workTimeline.length > 0) {
      lines.push('## Work timeline');
      lines.push('');
      for (const item of summary.workTimeline) {
        lines.push(
          `### ${item.fromYear}–${item.toYear}${item.label ? `: ${escapeMarkdownText(item.label)}` : ''}`
        );
        lines.push('');
        lines.push(escapeMarkdownText(item.summary));
        lines.push('');
      }
    }

    if (summary.projectSpotlights.length > 0) {
      lines.push('## AI project notes');
      lines.push('');
      for (const item of summary.projectSpotlights) {
        lines.push(`### ${escapeMarkdownText(item.repo)}`);
        lines.push('');
        lines.push(escapeMarkdownText(item.whatItIs));
        lines.push('');
        if (item.technicalSignals.length > 0) {
          lines.push(
            `Technical signals: ${item.technicalSignals.map(escapeMarkdownText).join(', ')}`
          );
          lines.push('');
        }
        lines.push(escapeMarkdownText(item.whyItMatters));
        lines.push('');
      }
    }

    if (summary.collaborationSignals.length > 0) {
      lines.push('## Collaboration signals');
      lines.push('');
      for (const item of summary.collaborationSignals) {
        lines.push(`- ${escapeMarkdownText(item)}`);
      }
      lines.push('');
    }

    if (summary.workStyleObservations.length > 0) {
      lines.push('## Work style observations');
      lines.push('');
      for (const item of summary.workStyleObservations) {
        lines.push(`- ${escapeMarkdownText(item)}`);
      }
      lines.push('');
    }

    if (summary.resumeBullets.length > 0) {
      lines.push('## Suggested resume bullets');
      lines.push('');
      for (const bullet of summary.resumeBullets) {
        lines.push(`- ${escapeMarkdownText(bullet.text)}`);
      }
      lines.push('');
    }

    if (summary.caveats.length > 0) {
      lines.push('## Caveats');
      lines.push('');
      for (const caveat of summary.caveats) {
        lines.push(`- ${escapeMarkdownText(caveat)}`);
      }
      lines.push('');
    }
  }

  lines.push('## Coverage and limitations');
  lines.push('');
  lines.push(`- Mode: ${coverage.mode}`);
  lines.push(
    `- Repositories analyzed: ${coverage.repositoriesAnalyzed} of ${coverage.repositoriesTotal}`
  );
  lines.push(
    `- Commit evidence covered ${coverage.activeYearsSampled} of ${coverage.activeYearsFound} active years`
  );
  lines.push(
    `- Sampled ${coverage.pullRequestsSampled} pull requests and ${coverage.issuesSampled} issues`
  );
  lines.push(
    `- GitHub requests: ${coverage.requests.core} core, ${coverage.requests.search} search`
  );
  lines.push('');
  for (const limitation of coverage.limitations) {
    lines.push(`- ${escapeMarkdownText(limitation)}`);
  }
  if (coverage.warnings.length > 0) {
    lines.push('');
    lines.push('### Warnings');
    lines.push('');
    for (const warning of coverage.warnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  if (collaboration.externalRepos.length > 0) {
    lines.push('');
    lines.push('## External collaboration');
    lines.push('');
    for (const repo of collaboration.externalRepos.slice(0, 10)) {
      lines.push(
        `- ${escapeMarkdownText(repo.fullName)}: ${repo.pullRequests} sampled PRs, ${repo.merged} merged`
      );
    }
  }

  lines.push('');
  lines.push(`_Generated ${dataset.fetchedAt.slice(0, 10)} from public GitHub data._`);

  return `${lines.join('\n')}\n`;
}

export function buildGitHubMarkdownFilename(login: string, now = new Date()): string {
  const safeLogin = login.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'github';
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `rolecraft-github-${safeLogin}-${date}.md`;
}
