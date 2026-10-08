import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// UI regression smoke test with synthetic accounts and intercepted API calls.
const base = process.env.WINRAK_PREVIEW_URL || 'http://localhost:5174';
const output = new URL('../../verification/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  geolocation: { latitude: 36.75, longitude: 3.06 }, permissions: ['geolocation'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const driver = { id: 7, nom: 'أمين', telephone: '0555000000', ville: 'الجزائر', vehicule: 'voiture',
  disponible: true, est_en_ligne: true, points: 30, note: 4.8, nombre_livraisons: 12 };
const client = { id: 8, nom: 'سارة', telephone: '0555000001', points: 20 };
let cancelled = false;
let documentStatus = 'missing';
let creations = 0;
let offerVisible = false;
const offer = { id: 43, client: 8, livreur: null, vehicle_type: 'voiture', status: 'searching', active: true,
  my_offer_response: 'pending', my_offer_expires_in: 60, final_price: '380', estimated_distance_km: 6.2,
  pickup_address: 'حي 20 أوت، مستغانم', destination: 'وسط المدينة، مستغانم', created_at: '2026-10-09T10:00:00Z' };
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('/api/')) {
    const path = url.pathname;
    let data = [];
    if (path.includes('/livreurs/7/documents/')) {
      if (route.request().method() === 'POST') documentStatus = 'pending';
      data = [{ kind: 'license', status: documentStatus }, { kind: 'vehicle', status: 'missing' }];
    } else if (path.includes('/livreurs/7/')) data = driver;
    else if (path.includes('/clients/')) data = [client];
    else if (path.includes('/courses/active/')) data = { active: false };
    else if (path.includes('/courses/43/respond/')) {
      const response = route.request().postDataJSON()?.response;
      if (response === 'accepted') { offer.my_offer_response = 'accepted'; offer.status = 'driver_accepted'; }
      else offerVisible = false;
      data = offer;
    }
    else if (path.includes('/courses/offers/')) data = offerVisible && offer.my_offer_response === 'pending' ? [offer] : [];
    else if (/\/courses\/$/.test(path) && route.request().method() === 'GET') data = offerVisible ? [offer] : [];
    else if (/\/courses\/42\//.test(path)) data = { id: 42, client: 8, livreur: 7,
      vehicle_type: 'voiture', status: cancelled ? 'cancelled' : 'driver_selected', active: !cancelled,
      client_latitude: 36.75, client_longitude: 3.06, cancelled_by_type: 'livreur', accepted_drivers: [], events: [] };
    else if (/\/courses\/(request\/)?$/.test(path) && route.request().method() === 'POST') creations++;
    await route.fulfill({ json: data });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});
async function login(role, account) {
  await page.goto(base);
  await page.evaluate(({ role, account }) => {
    localStorage.clear(); localStorage.setItem('access', 'synthetic-test-token');
    localStorage.setItem('role', role); localStorage.setItem(role === 'client' ? 'client' : 'livreur', JSON.stringify(account));
  }, { role, account });
}
try {
  await login('livreur', driver);
  await page.goto(`${base}/livreur-dashboard/7`);
  await page.getByText('لا توجد طلبات حالياً', { exact: true }).waitFor();
  assert.equal(await page.locator('#driver-documents').count(), 0);
  const navBounds = await page.locator('.bottom-nav').boundingBox();
  assert.ok(navBounds.x >= 0 && navBounds.x + navBounds.width <= 391, 'mobile navigation stays within viewport');
  await page.screenshot({ path: `${output}/driver-home.png`, fullPage: true });
  offerVisible = true;
  await page.goto(`${base}/livreur-dashboard/7`);
  await page.getByText('380 دج', { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/driver-offer.png`, fullPage: true });
  await page.getByRole('button', { name: 'قبول', exact: true }).click();
  await page.getByText('تم إرسال قبولك', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'حسابي', exact: true }).last().click();
  await page.getByRole('heading', { name: 'الوثائق', exact: true }).waitFor();
  await page.locator('.document-status').first().waitFor();
  assert.equal(await page.locator('.document-status').count(), 2);
  assert.match(await page.locator('.account-role').innerText(), /حساب سائق/);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic-license.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await page.getByText('تم إرسال الوثيقة للمراجعة.', { exact: true }).waitFor();
  assert.equal(await page.locator('.document-status').first().innerText(), 'قيد المراجعة');
  await page.screenshot({ path: `${output}/driver-account.png`, fullPage: true });
  const roleError = await page.evaluate(async () => {
    try { await (await import('/src/livreursapi.js')).createCourseRequest({}); return null; }
    catch (error) { return error.message; }
  });
  assert.match(roleError, /حساب عميل/);
  assert.equal(creations, 0);
  await login('livreur', { ...driver, vehicule: 'moto' });
  driver.vehicule = 'moto';
  await page.goto(`${base}/livreur-dashboard/7?section=account`);
  await page.getByRole('heading', { name: 'الوثائق', exact: true }).waitFor();
  assert.match(await page.locator('.account-role').innerText(), /عامل توصيل/);
  offerVisible = false;
  await login('client', client);
  await page.goto(`${base}/client-dashboard`);
  await page.getByText('حساب عميل', { exact: true }).waitFor();
  assert.equal(await page.locator('#driver-documents').count(), 0);
  await page.screenshot({ path: `${output}/client-account.png`, fullPage: true });
  driver.telephone = null;
  await page.goto(`${base}/tracking/7`);
  await page.getByText('تظهر بيانات التواصل بعد تأكيد السائق.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '📞 اتصال', exact: true }).count(), 0);
  await page.goto(`${base}/course/42`);
  await page.locator('.course-follow-header').waitFor();
  cancelled = true;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('winrakPush', { detail: { course_id: '42', type: 'course_cancelled' } })));
  await page.getByText('نعتذر، ألغى السائق الرحلة. يمكنك طلب سائق آخر.', { exact: true }).waitFor();
  assert.match(page.url(), /\/course\/42$/);
  await page.screenshot({ path: `${output}/course-cancelled.png`, fullPage: true });
  await page.waitForURL(`${base}/livreurs`, { timeout: 10000 });
  assert.deepEqual(errors, []);
  console.log('UI checks passed: driver home/account, incoming offer and acceptance, car/moto roles, private upload status, client account, role guard, cancellation display and delayed redirect.');
} finally {
  await browser.close();
}
