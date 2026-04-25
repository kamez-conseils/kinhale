/**
 * Repo hygiene checks (KIN-089, E14-S01).
 *
 * These tests guard the open-source foundation of the repository:
 *
 * 1. Mandatory community files (LICENSE, README.md, CONTRIBUTING.md,
 *    CODE_OF_CONDUCT.md, SECURITY.md) must exist at the root and have
 *    non-trivial content. They are the surface that any first-time
 *    contributor or self-hoster sees; deleting one by accident must
 *    fail CI loudly.
 *
 * 2. The LICENSE must be the verbatim AGPL v3 text. We assert on a few
 *    canonical phrases rather than the byte hash to allow normalising
 *    line endings between editors.
 *
 * 3. The .gitignore must ignore the patterns that protect us from
 *    committing secrets:
 *      - .env / .env.* (with the .example escape hatch)
 *      - .agents/ and .claude/ (internal workspaces)
 *      - private key extensions (*.pem, *.key, *.p8 for APNs)
 *      - secrets/ and private/
 *      - infra/docker/.env.prod
 *
 * If you intentionally remove a pattern below, also update the corresponding
 * security policy and reasoning — these checks are a backstop, not a
 * substitute for code review.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

function readRoot(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

describe('repo hygiene — community files', () => {
  it.each(['LICENSE', 'README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'])(
    '%s exists with non-trivial content',
    (file) => {
      const content = readRoot(file);
      // Loose floor: 200 bytes filters out empty / placeholder files without
      // pinning a specific document length.
      expect(content.length).toBeGreaterThan(200);
    },
  );
});

describe('repo hygiene — LICENSE is AGPL v3 verbatim', () => {
  const license = readRoot('LICENSE');

  it('declares "GNU AFFERO GENERAL PUBLIC LICENSE"', () => {
    expect(license).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  });

  it('declares "Version 3, 19 November 2007"', () => {
    expect(license).toContain('Version 3, 19 November 2007');
  });

  it('contains the §13 "Remote Network Interaction" clause', () => {
    // §13 is the AGPL-specific clause that distinguishes it from the GPL —
    // network operators must offer source. Removing it = silently
    // downgrading the licence.
    expect(license).toContain('Remote Network Interaction');
  });

  it('contains the closing FSF reference', () => {
    expect(license).toContain('https://www.gnu.org/licenses/');
  });
});

describe('repo hygiene — README mentions zero-knowledge & not-a-medical-device', () => {
  const readme = readRoot('README.md');

  it('references the zero-knowledge promise', () => {
    expect(readme.toLowerCase()).toContain('zero-knowledge');
  });

  it('contains the not-a-medical-device disclaimer (RM27)', () => {
    expect(readme.toLowerCase()).toContain('not a medical device');
  });

  it('points to SECURITY.md and CODE_OF_CONDUCT.md', () => {
    expect(readme).toContain('SECURITY.md');
    expect(readme).toContain('CODE_OF_CONDUCT.md');
  });

  it('points to the self-hosting guide', () => {
    expect(readme).toContain('docs/user/SELF_HOSTING.md');
  });
});

describe('repo hygiene — SECURITY.md surface', () => {
  const security = readRoot('SECURITY.md');

  it('exposes a contact email', () => {
    expect(security).toContain('security@kinhale.health');
  });

  it('declares an acknowledgement window (5 business days)', () => {
    expect(security).toMatch(/5 business days/i);
  });

  it('lists in-scope and out-of-scope sections', () => {
    expect(security).toMatch(/in scope/i);
    expect(security).toMatch(/out of scope/i);
  });
});

describe('repo hygiene — .gitignore blocks secret-prone patterns', () => {
  const gitignore = readRoot('.gitignore');
  const requiredPatterns = [
    '.env',
    '.env.*',
    '.agents/',
    '.claude/',
    '*.pem',
    '*.key',
    '*.p8',
    'secrets/',
    'private/',
    'infra/docker/.env.prod',
  ];

  it.each(requiredPatterns)('ignores "%s"', (pattern) => {
    // Match on a line boundary to avoid false positives inside comments.
    const lineMatcher = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    expect(gitignore).toMatch(lineMatcher);
  });

  it('keeps an escape hatch for *.example env files', () => {
    expect(gitignore).toMatch(/^!\.env\.example\s*$/m);
  });
});
