import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WINRAK_PREVIEW_URL || 'http://localhost:5176';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  geolocation: { latitude: 36.75, longitude: 3.06 }, permissions: ['geolocation'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /TypeError|React Router caught|Error handled by/.test(message.text())) errors.push(message.text());
});
const driver = { id: 7, nom: 'Test', telephone: '0555000000', ville: 'Alger', vehicule: 'voiture' };
const client = { id: 8, nom: 'Test', telephone: '0555000001' };
let malformed = false;
let crash = false;

await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('/api/')) {
    let data = [];
    if (url.pathname.endsWith('/token/')) data = { access: 'synthetic-test-token', refresh: 'synthetic-refresh-token' };
    else if (url.pathname.endsWith('/courses/active/')) data = { active: false };
    else if (url.pathname.endsWith('/livreurs/7/')) data = driver;
    else if (url.pathname.endsWith('/livreurs/7/documents/')) data = malformed ? { detail: 'Invalid response' } : [];
    else if (url.pathname.endsWith('/courses/')) data = malformed ? { results: { detail: 'Invalid response' } } : [];
    else if (url.pathname.endsWith('/clients/')) data = [{ ...client, nom: crash ? { invalid: true } : client.nom }];
    await route.fulfill({ json: data });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});

try {
  for (const returnPath of [null, '/livreurs']) {
    errors.length = 0;
    await page.goto(`${base}/livreurs`);
    await page.evaluate((path) => {
      localStorage.clear();
      if (path) localStorage.setItem('redirectAfterLogin', path);
    }, returnPath);
    await page.goto(`${base}/connexion-client`);
    await page.locator('.auth-switch').nth(1).locator('button').nth(1).click();
    await page.locator('#client-auth-phone').fill(client.telephone);
    await page.locator('#client-auth-password').fill('test-password');
    await page.locator('.auth-form button[type="submit"]').click();
    await page.waitForURL(`${base}${returnPath || '/client-dashboard'}`);
    assert.deepEqual(errors, [], 'client login: browser errors');
    console.log(`PASS: client login returns to ${returnPath || '/client-dashboard'}`);
  }
  for (const [role, account] of [['client', client], ['livreur', driver]]) for (malformed of [false, true]) {
    errors.length = 0;
    await page.goto(`${base}/livreurs`);
    await page.evaluate(({ role, account }) => {
      localStorage.clear();
      localStorage.setItem('access', 'synthetic-test-token');
      localStorage.setItem('role', role);
      localStorage.setItem(role, JSON.stringify(account));
    }, { role, account });
    const home = role === 'client' ? '/livreurs' : '/livreur-dashboard/7';
    const accountPath = role === 'client' ? '/client-dashboard' : '/livreur-dashboard/7?section=account';
    await page.goto(`${base}${home}`);
    await page.locator('.bottom-nav a').last().click();
    await page.waitForURL(`${base}${accountPath}`);
    await page.waitForTimeout(500);
    assert.equal(page.url(), `${base}${accountPath}`);
    assert.equal(await page.locator('.account-page').count(), 1);
    assert.equal(await page.locator('.centered-page').count(), 0);
    if (malformed) assert.ok(await page.locator('[role="alert"]').count() > 0);
    assert.deepEqual(errors, [], `${role}: browser errors`);
    console.log(`PASS: ${role} opens account${malformed ? ' with malformed API data' : ''}`);
  }
  malformed = false;
  crash = true;
  await page.goto(`${base}/livreurs`);
  await page.evaluate((account) => {
    localStorage.clear();
    localStorage.setItem('access', 'synthetic-test-token');
    localStorage.setItem('role', 'client');
    localStorage.setItem('client', JSON.stringify(account));
  }, client);
  await page.goto(`${base}/client-dashboard`);
  await page.locator('.centered-page').waitFor();
  await page.waitForTimeout(500);
  assert.equal(page.url(), `${base}/client-dashboard`, 'a render error must not redirect automatically');
  await page.locator('.centered-page a').click();
  await page.waitForURL(`${base}/livreurs`);
  console.log('PASS: rendering error offers a manual route home without a redirect loop');
} finally {
  await browser.close();
}
