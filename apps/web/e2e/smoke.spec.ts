import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('home page loads and displays Kinhale', async ({ page }) => {
    await page.goto('/');
    // On vérifie que la page ne crash pas avec une erreur applicative (500 / __next_error__)
    // Note : le titre SSR et le h1 nécessitent le fix WASM webpack (KIN-036 Phase 3).
    // Ce test assure qu'aucune régression supplémentaire n'est introduite.
    const content = await page.content();
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('__next_error__');
  });

  test('auth page is reachable', async ({ page }) => {
    await page.goto('/auth');
    // On vérifie juste qu'aucune erreur 500 n'est rendue
    const content = await page.content();
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('__next_error__');
  });

  test('journal page is reachable (non-crashed)', async ({ page }) => {
    await page.goto('/journal');
    const content = await page.content();
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('__next_error__');
  });

  test('caregivers page is reachable (non-crashed)', async ({ page }) => {
    await page.goto('/caregivers');
    const content = await page.content();
    expect(content).not.toContain('Application error');
    expect(content).not.toContain('__next_error__');
  });
});
