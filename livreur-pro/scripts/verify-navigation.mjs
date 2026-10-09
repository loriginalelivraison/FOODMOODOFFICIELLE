import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WINRAK_PREVIEW_URL || 'http://localhost:5176';
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  geolocation: { latitude: 36.75, longitude: 3.06 }, permissions: ['geolocation'] });
const page = await context.newPage();
const errors = [];
const renderErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /TypeError|React Router caught|Error handled by/.test(message.text())) {
    renderErrors.push(message.text());
  }
});
const driver = { id: 7, nom: 'Test', telephone: '0555000000', ville: 'Alger', vehicule: 'voiture',
  disponible: true, est_en_ligne: true, latitude: 36.74, longitude: 3.05, points: 0 };
const client = { id: 8, nom: 'Test', telephone: '0555000001', points: 0 };
let course;
let failureStatus = 0;
let cancellations = 0;
let actor = 'client';
function resetCourse() {
  failureStatus = 0;
  course = { id: 42, client: 8, livreur: 7, vehicle_type: 'voiture', status: 'driver_selected', active: true,
    client_latitude: 36.75, client_longitude: 3.06, pickup_latitude: 36.75, pickup_longitude: 3.06,
    destination_latitude: 36.8, destination_longitude: 3.1, destination: 'Destination',
    final_price: '380', accepted_drivers: [driver], events: [] };
}
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('/api/')) {
    const path = url.pathname;
    if (/\/courses\/42\/$/.test(path)) {
      await route.fulfill({ status: failureStatus || 200, json: failureStatus === 401
        ? { code: 'token_not_valid', detail: 'Token is expired' }
        : failureStatus ? { detail: 'Unavailable' } : course });
      return;
    }
    let data = [];
    if (path.endsWith('/courses/42/cancel/')) {
      cancellations++;
      course = { ...course, status: 'cancelled', active: false, cancelled_by_type: actor };
      data = course;
    } else if (path.includes('/livreurs/7/documents/')) data = [];
    else if (path.includes('/livreurs/7/')) data = driver;
    else if (path.includes('/clients/8/')) data = client;
    else if (path.includes('/courses/active/')) data = { active: false };
    await route.fulfill({ json: data });
  } else if (url.hostname === 'api.mapbox.com' && url.pathname.includes('/styles/')) {
    await route.fulfill({ json: { version: 8, sources: {}, layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#eee' } },
    ] } });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});
async function login(role, rawAccount) {
  actor = role;
  await page.goto(`${base}/livreurs`);
  await page.evaluate(({ role, account }) => {
    localStorage.clear();
    localStorage.setItem('access', 'synthetic-test-token');
    localStorage.setItem('role', role);
    localStorage.setItem(role, account);
  }, { role, account: rawAccount ?? JSON.stringify(role === 'client' ? client : driver) });
}
async function assertUrl(path) {
  await page.waitForURL(`${base}${path}`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByText('Unexpected Application Error!', { exact: true }).count(), 0);
}
try {
  resetCourse();
  await login('client');
  await page.evaluate(() => localStorage.setItem('currentClientCourseId', '42'));
  await page.goto(`${base}/course/42`);
  await page.locator('.course-cancel-button').waitFor();
  // Exercise cancellation while the map and route line are mounted.
  await page.waitForFunction(() => document.querySelector('.mapboxgl-canvas'));
  await page.waitForTimeout(1000);
  await page.locator('.course-cancel-button').click();
  await page.locator('.course-cancel-form button[type="submit"]').click();
  await page.locator('.course-cancelled-state').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('currentClientCourseId')), null);
  await page.locator('.course-cancelled-state button').click();
  await assertUrl('/livreurs');
  assert.equal(cancellations, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: client cancellation with mounted map and manual return');

  resetCourse();
  await page.goto(`${base}/course/42`);
  await page.locator('.course-follow-header').waitFor();
  course = { ...course, status: 'cancelled', active: false, cancelled_by_type: 'livreur' };
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('winrakPush', { detail: { course_id: '42' } })));
  await page.locator('.course-cancelled-state').waitFor();
  await assertUrl('/livreurs');
  console.log('PASS: external cancellation and automatic return');

  resetCourse();
  await login('livreur');
  await page.goto(`${base}/livreur-course/42`);
  await page.locator('.course-cancel-form').waitFor();
  await page.locator('.course-cancel-form button').click();
  await page.locator('.course-cancelled-state').waitFor();
  await page.locator('.course-cancelled-state button').click();
  await assertUrl('/livreur-dashboard/7');
  await page.locator('.account-header').waitFor();
  console.log('PASS: driver cancellation returns to their dashboard');

  for (const role of ['client', 'livreur']) {
    for (const status of [403, 404, 410]) {
      await login(role);
      failureStatus = status;
      await page.evaluate(() => localStorage.setItem('currentClientCourseId', '42'));
      await page.goto(`${base}/${role === 'client' ? 'course' : 'livreur-course'}/42`);
      await assertUrl(role === 'client' ? '/livreurs' : '/livreur-dashboard/7');
      if (role === 'client') assert.equal(await page.evaluate(() => localStorage.getItem('currentClientCourseId')), null);
    }
  }
  console.log('PASS: unavailable courses return safely for both roles');

  for (const role of ['client', 'livreur']) {
    await login(role);
    await page.goto(`${base}/unknown-page`);
    await assertUrl(role === 'client' ? '/livreurs' : '/livreur-dashboard/7');
    failureStatus = 401;
    await page.goto(`${base}/${role === 'client' ? 'course' : 'livreur-course'}/42`);
    await assertUrl(role === 'client' ? '/connexion-client' : '/inscription-livreur');
    assert.equal(await page.evaluate(() => localStorage.getItem('access')), null);
  }
  console.log('PASS: unknown routes and expired sessions');

  for (const raw of ['null', '{broken']) {
    await login('livreur', raw);
    await page.goto(`${base}/livreur-course/42`);
    await assertUrl('/inscription-livreur');
    await page.goto(`${base}/livreur-dashboard/undefined`);
    await assertUrl('/inscription-livreur');
  }
  resetCourse();
  await login('livreur');
  await page.goto(`${base}/course/42`);
  await assertUrl('/livreur-dashboard/7');
  await login('client');
  await page.goto(`${base}/livreur-course/42`);
  await assertUrl('/livreurs');
  await page.goto(`${base}/course/undefined`);
  await assertUrl('/livreurs');
  console.log('PASS: malformed accounts, missing IDs and wrong-role routes');
  assert.deepEqual(errors, []);
  assert.deepEqual(renderErrors, []);

  // Deliberately trigger a rendering exception to exercise the router fallback.
  resetCourse();
  course.accepted_drivers = {};
  await page.goto(`${base}/course/42`);
  await assertUrl('/livreurs');
  console.log('PASS: render exception recovers without the default error screen');
} catch (error) {
  console.error('URL:', page.url(), 'Uncaught errors:', errors);
  throw error;
} finally {
  await browser.close();
}
