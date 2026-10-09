import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WINRAK_PREVIEW_URL || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const client = { id: 8, nom: 'سارة', telephone: '0555000001', points: 20 };
const driver = { id: 7, nom: 'أمين', telephone: '0555000000', ville: 'الجزائر', vehicule: 'moto', est_en_ligne: false, disponible: false };
let course = { id: 42, client: 8, livreur: null, active: true, status: 'searching', vehicle_type: 'moto',
  destination: 'الجزائر الوسطى', pickup_address: 'باب الواد', proposed_price: 350, accepted_drivers: [], created_at: '2026-10-09T10:00:00Z' };
let cancellations = 0;
let reviewRequests = 0;
let reviewAuthorization;
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path.includes('/api/')) {
    let data = [];
    if (path.endsWith('/courses/42/cancel/')) {
      cancellations++;
      const payload = route.request().postDataJSON();
      assert.equal(payload.reason, 'driver_delay');
      course = { ...course, status: 'cancelled', active: false, cancelled_by_type: 'client' };
      data = course;
    } else if (path.endsWith('/commentaires-livreurs/') && route.request().method() === 'POST') {
      reviewRequests++;
      reviewAuthorization = route.request().headers().authorization;
      data = { id: 1 };
    } else if (path.endsWith('/clients/')) data = [client];
    else if (path.endsWith('/courses/42/')) data = course;
    else if (path.endsWith('/courses/')) data = [course];
    else if (path.endsWith('/courses/active/')) data = { active: false };
    else if (path.endsWith('/livreurs/7/')) data = driver;
    await route.fulfill({ json: data });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});

async function login(role) {
  await page.goto(`${base}/connexion-client`);
  await page.evaluate(({ role, account }) => {
    localStorage.clear();
    localStorage.setItem('access', 'synthetic-test-token');
    localStorage.setItem('role', role);
    localStorage.setItem(role, JSON.stringify(account));
    window.dispatchEvent(new Event('authChanged'));
  }, { role, account: role === 'client' ? client : driver });
}

try {
  await login('client');
  await page.goto(`${base}/client-dashboard`);
  await page.locator('.account-stat-grid').waitFor();
  await page.getByRole('link', { name: 'متابعة التوصيل', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'تأكيد استلام الطلب', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'حذف الحساب نهائياً' }).isDisabled(), true);
  assert.equal(await page.locator('.bottom-nav a[aria-current="page"]').count(), 1);
  await page.screenshot({ path: '../verification/audit-client-mobile.png', fullPage: true });
  console.log('PASS account: active delivery, valid actions, navigation');

  await page.goto(`${base}/course/42`);
  await page.locator('.course-cancel-button').click();
  assert.equal(cancellations, 0);
  await page.locator('.course-cancel-form select').selectOption('driver_delay');
  await page.locator('.course-cancel-form button[type="submit"]').click();
  await page.locator('.course-cancelled-state').waitFor();
  assert.equal(cancellations, 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('currentClientCourseId')), null);
  console.log('PASS cancellation: explicit confirmation and reason');

  course = { ...course, status: 'completed', active: false, livreur: 7, accepted_drivers: [driver] };
  await page.goto(`${base}/course/42`);
  await page.locator('.course-review-card textarea').fill('خدمة جيدة');
  await page.waitForTimeout(12500);
  assert.equal(new URL(page.url()).pathname, '/course/42');
  assert.equal(await page.locator('.course-review-card textarea').inputValue(), 'خدمة جيدة');
  await page.locator('.course-review-card button[type="submit"]').click();
  await page.locator('.course-review-success').waitFor();
  assert.equal(reviewRequests, 1);
  assert.equal(reviewAuthorization, 'Bearer synthetic-test-token');
  await page.screenshot({ path: '../verification/audit-review-mobile.png', fullPage: true });
  console.log('PASS review: no automatic exit, authenticated submission and success');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/client-dashboard`);
  await page.locator('.account-history-link').waitFor();
  assert.equal(await page.locator('.account-history-link').getAttribute('href'), '/course/42');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '../verification/audit-client-desktop.png', fullPage: true });
  console.log('PASS history: accessible details and desktop layout');

  await login('livreur');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/livreur-dashboard/7`);
  await page.locator('.driver-shell').waitFor();
  assert.equal(await page.locator('.bottom-nav a').count(), 2);
  await page.goto(`${base}/course/42`);
  await page.waitForURL(`${base}/livreur-dashboard/7`);
  await page.screenshot({ path: '../verification/audit-driver-mobile.png', fullPage: true });
  console.log('PASS role separation: driver navigation and client route protection');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
