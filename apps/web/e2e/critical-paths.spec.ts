/**
 * COMPROMIS PHASE KIN-036 — Tests 04, 05, 06, 07, 09 :
 * Depuis fix #181 (useRequireAuth), les pages protégées redirigent vers /auth
 * quand aucun token n'est présent en localStorage. Les assertions sur le rendu
 * authentifié ont été remplacées par des assertions de redirection (miroir des
 * tests 03 et 08). La couverture du rendu réel de ces pages en CI sera rétablie
 * dans une PR suivante via page.addInitScript (injection d'un token factice).
 * Refs: KIN-036, #181
 */
import { test, expect, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/critical-paths';

/**
 * Helper : vérifie qu'aucun marker d'erreur Next.js n'est présent dans le DOM.
 *
 * - `html#__next_error__`  → attribut id posé par Next.js 15 sur la balise <html>
 *   lors d'une erreur de rendu (500, Build Error, etc.)
 * - `meta[name="next-error"]` → metadata Next.js injectée sur les pages 4xx/5xx
 *   (sauf 404 intentionnel — ne pas appeler cette helper sur le test 404).
 */
async function expectNoNextError(page: Page): Promise<void> {
  // La balise <html> ne doit PAS avoir l'attribut id="__next_error__"
  await expect(page.locator('html#__next_error__')).toHaveCount(0);
  // Pas de meta next-error (indicateur d'erreur SSR)
  await expect(page.locator('meta[name="next-error"]')).toHaveCount(0);
}

test.describe('Parcours critiques — rendu réel des pages', () => {
  test('01 Home affiche Kinhale et CTA Commencer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-home.png`, fullPage: true });
    await expectNoNextError(page);
    // H1 affiché via t('home.title') = "Kinhale"
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Kinhale');
    // CTA principal via t('home.getStarted') = "Commencer"
    await expect(page.getByRole('button', { name: /commencer/i })).toBeVisible();
  });

  test('02 Auth affiche le formulaire magic link', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-auth.png`, fullPage: true });
    await expectNoNextError(page);
    // H1 via t('auth.title') = "Connexion"
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connexion');
    // Input email via placeholder t('auth.emailPlaceholder') = "votre@email.com"
    await expect(page.getByPlaceholder('votre@email.com')).toBeVisible();
    // Bouton via t('auth.submit') = "Recevoir un lien magique"
    await expect(page.getByRole('button', { name: /recevoir un lien magique/i })).toBeVisible();
  });

  test('03 Journal redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-journal.png`, fullPage: true });
    await expectNoNextError(page);
    // JournalPage redirige via router.push('/auth') si accessToken === null
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('04 Journal/add redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/journal/add');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-journal-add.png`, fullPage: true });
    await expectNoNextError(page);
    // Fix #181 : useRequireAuth redirige vers /auth si accessToken absent
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('05 Onboarding/child redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/onboarding/child');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-onboarding-child.png`, fullPage: true });
    await expectNoNextError(page);
    // Fix #181 : useRequireAuth redirige vers /auth si accessToken absent
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('06 Onboarding/pump redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/onboarding/pump');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-onboarding-pump.png`, fullPage: true });
    await expectNoNextError(page);
    // Fix #181 : useRequireAuth redirige vers /auth si accessToken absent
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('07 Onboarding/plan redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/onboarding/plan');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-onboarding-plan.png`, fullPage: true });
    await expectNoNextError(page);
    // Fix #181 : useRequireAuth redirige vers /auth si accessToken absent
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('08 Caregivers redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/caregivers');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-caregivers.png`, fullPage: true });
    await expectNoNextError(page);
    // CaregiversPage appelle router.replace('/auth') quand accessToken est null/vide
    // Ref : fix issue #177
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('09 Caregivers/invite redirige vers /auth si non authentifié', async ({ page }) => {
    await page.goto('/caregivers/invite');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-caregivers-invite.png`, fullPage: true });
    await expectNoNextError(page);
    // Fix #181 : useRequireAuth redirige vers /auth si accessToken absent
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('10 Accept-invitation avec token factice affiche erreur et bouton retour', async ({
    page,
  }) => {
    await page.goto('/accept-invitation/fake-token-does-not-exist');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-accept-invitation-expired.png`,
      fullPage: true,
    });
    await expectNoNextError(page);
    // L'appel API échoue → catch → t('invitation.errorExpired') = "Cette invitation a expiré."
    await expect(page.getByText(/cette invitation a expiré/i)).toBeVisible();
    // Fix #179 : bouton backToAuth = "Retour à la connexion"
    await expect(page.getByRole('button', { name: /retour à la connexion/i })).toBeVisible();
  });

  test('11 404 renvoie HTTP 404 et affiche le message Next.js', async ({ page }) => {
    // Ce test vérifie que la vraie 404 Next.js fonctionne.
    // On ne call PAS expectNoNextError ici : meta[name="next-error"] est attendue sur une 404.
    const response = await page.goto('/page-qui-nexiste-vraiment-pas');
    expect(response?.status()).toBe(404);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-not-found.png`, fullPage: true });
    // Next.js 15 affiche un H1 "404" et un H2 "This page could not be found."
    // On cible le H1 "404" pour éviter l'ambiguïté strict-mode (2 éléments matchent le regex).
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });
});
