import { test, expect } from '@playwright/test';

/**
 * KIN-036 Phase 2 — Visual bug-bash.
 *
 * Navigue chaque page critique, capture un screenshot, et effectue des
 * assertions minimales (pas de crash SSR, pas de clé i18n brute).
 *
 * Screenshots archivés dans apps/web/test-results/bugbash/ pour relecture
 * par l'assistant (analyse visuelle multimodale).
 */

const SCREENSHOT_DIR = 'test-results/bugbash';

test.describe('Parcours critiques — captures visuelles', () => {
  test('01 - Home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-home.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('__next_error__');
  });

  test('02 - Auth (magic link)', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-auth.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
    // Détection de clé i18n brute (pattern "word.word" dans le texte visible)
    const visibleText = await page.locator('body').textContent();
    expect(visibleText ?? '').not.toMatch(/\b(auth|journal|invitation|onboarding)\.[a-zA-Z]+\b/);
  });

  test('03 - Journal vide', async ({ page }) => {
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-journal.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('04 - Journal add', async ({ page }) => {
    await page.goto('/journal/add');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-journal-add.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('05 - Onboarding child', async ({ page }) => {
    await page.goto('/onboarding/child');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-onboarding-child.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('06 - Onboarding pump', async ({ page }) => {
    await page.goto('/onboarding/pump');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-onboarding-pump.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('07 - Onboarding plan', async ({ page }) => {
    await page.goto('/onboarding/plan');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-onboarding-plan.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('08 - Caregivers list', async ({ page }) => {
    await page.goto('/caregivers');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-caregivers.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('09 - Caregivers invite', async ({ page }) => {
    await page.goto('/caregivers/invite');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-caregivers-invite.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('10 - Accept invitation (token factice)', async ({ page }) => {
    await page.goto('/accept-invitation/fake-token-test');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-accept-invitation.png`, fullPage: true });
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('11 - 404 page', async ({ page }) => {
    await page.goto('/page-qui-nexiste-pas', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-not-found.png`, fullPage: true });
  });
});
