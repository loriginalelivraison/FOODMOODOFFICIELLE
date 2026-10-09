import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Test fixtures are intercepted here; the application only displays backend data.
const base = process.env.WINRAK_PREVIEW_URL || 'http://localhost:5176';
const output = fileURLToPath(new URL('../../verification/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  geolocation: { latitude: 36.75, longitude: 3.06 }, permissions: ['geolocation'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /TypeError|React Router caught/.test(message.text())) errors.push(message.text());
});
const driver = { id: 7, nom: 'أمين', telephone: '0555000000', ville: 'مستغانم', vehicule: 'voiture',
  disponible: true, est_en_ligne: true, points: 30, note: 4.8, nombre_livraisons: 12 };
const customer = { id: 8, nom: 'سارة', telephone: '0555000001', points: 20 };
let courses = [], deadline = Date.now() + 150000;
let documentStatus = 'missing', failHistory = false, failResponse = false, delayHistory = false, failMap = false;
let styleRequests = 0, routingRequests = 0, profileReads = 0, reviewsReads = 0;
const responses = [];
function incoming(seconds = 150) {
  deadline = Date.now() + seconds * 1000;
  return { id: 42, client: 8, livreur: null, vehicle_type: 'voiture', status: 'searching', active: true,
    my_offer_response: 'pending', my_offer_expires_in: seconds,
    proposed_price: '380', final_price: null, trip_distance_km: 6.2, estimated_distance_km: 6.2,
    my_offer_dropoff_eta_minutes: 12, dropoff_eta_minutes: 12,
    pickup_address: 'حي 20 أوت، مستغانم', destination: 'وسط المدينة، مستغانم',
    pickup_latitude: 35.932, pickup_longitude: 0.09, destination_latitude: 35.929, destination_longitude: 0.108,
    trip_route_geometry: [[0.09, 35.932], [0.092, 35.93], [0.096, 35.929], [0.101, 35.929], [0.104, 35.928], [0.108, 35.929]],
    accepted_drivers: [], events: [], created_at: '2026-10-09T10:00:00Z' };
}
function serialized(course) {
  return { ...course, my_offer_expires_in: course.my_offer_response === 'pending'
    ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null };
}
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (path.includes('directions/') || url.hostname.includes('project-osrm')) routingRequests++;
  if (path.includes('/api/')) {
    let data = [], status = 200;
    if (path.includes('/livreurs/7/documents/')) {
      if (request.method() === 'POST') documentStatus = 'pending';
      data = [{ kind: 'license', status: documentStatus }, { kind: 'vehicle', status: 'missing' }];
    } else if (path.includes('/livreurs/7/set_online/')) { driver.est_en_ligne = true; data = driver; }
    else if (path.includes('/livreurs/7/set_offline/')) { driver.est_en_ligne = false; data = driver; }
    else if (path.includes('/livreurs/7/')) {
      if (request.method() === 'PATCH' && path.endsWith('/livreurs/7/')) Object.assign(driver, request.postDataJSON());
      if (request.method() === 'GET') profileReads++;
      data = driver;
    } else if (path.includes('/commentaires')) { reviewsReads++; data = []; }
    else if (path.includes('/clients/')) data = customer;
    else if (path.endsWith('/courses/42/respond/')) {
      const response = request.postDataJSON().response;
      responses.push(response);
      if (failResponse) { status = 503; data = { detail: 'تعذر إرسال الرد. حاول مجدداً.' }; }
      else if (response === 'accepted') { courses[0].my_offer_response = 'accepted'; courses[0].status = 'driver_accepted'; data = serialized(courses[0]); }
      else { data = serialized(courses[0]); courses = []; }
    } else if (path.endsWith('/courses/42/finish/')) {
      courses[0].active = false; courses[0].status = 'completed'; driver.points += 10; driver.nombre_livraisons++;
      data = serialized(courses[0]);
    } else if (path.includes('/courses/active/')) {
      const active = courses.find(course => course.livreur === 7 && course.active);
      data = active ? { active: true, course: serialized(active) } : { active: false };
    } else if (path.includes('/courses/offers/')) data = courses.filter(course => course.my_offer_response === 'pending').map(serialized);
    else if (path.endsWith('/courses/')) {
      if (delayHistory) await new Promise(resolve => setTimeout(resolve, 500));
      if (failHistory) { status = 503; data = { detail: 'تعذر تحميل الطلبات.' }; }
      else data = courses.map(serialized);
    } else if (path.endsWith('/courses/42/')) data = serialized(courses[0]);
    await route.fulfill({ status, json: data });
  } else if (url.hostname === 'api.mapbox.com' && path.includes('/styles/')) {
    styleRequests++;
    if (failMap) await route.abort();
    else await route.fulfill({ json: { version: 8, sources: {}, layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e8edf0' } },
    ] } });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});
async function login(role = 'livreur') {
  await page.goto(`${base}/livreurs`);
  await page.evaluate(({ role, account }) => {
    localStorage.clear(); localStorage.setItem('access', 'synthetic-test-token');
    localStorage.setItem('role', role); localStorage.setItem(role, JSON.stringify(account));
  }, { role, account: role === 'client' ? customer : driver });
}
async function home() { await page.goto(`${base}/livreur-dashboard/7`); }
async function refresh() { await page.evaluate(() => window.dispatchEvent(new CustomEvent('winrakPush', { detail: { course_id: '42' } }))); }
async function screenshot(name) { await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); }
async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page stays within viewport');
  const nav = await page.locator('.bottom-nav').boundingBox();
  if (nav) assert.ok(nav.x >= 0 && nav.x + nav.width <= page.viewportSize().width + 1, 'navigation stays within viewport');
}
try {
  await login(); delayHistory = true;
  await home();
  await page.getByRole('status').filter({ hasText: 'جاري تحميل الطلبات' }).waitFor();
  await page.getByText('لا توجد طلبات حالياً', { exact: true }).waitFor();
  delayHistory = false;
  assert.equal(await page.locator('.mapboxgl-canvas').count(), 0);
  assert.equal(styleRequests, 0);
  assert.equal(reviewsReads, 0, 'reviews are not requested on the home screen');
  await noOverflow(); await screenshot('driver-redesign-empty');
  console.log('PASS: loading and empty states, real rewards, RTL and no map requests without offers');

  await page.getByRole('switch').click();
  await page.getByRole('switch', { name: 'بدء استقبال الطلبات' }).waitFor();
  assert.equal(driver.est_en_ligne, false);
  await page.getByRole('switch').click();
  await page.getByRole('switch', { name: 'إيقاف استقبال الطلبات' }).waitFor();
  assert.equal(driver.est_en_ligne, true);

  courses = [incoming()]; await refresh();
  await page.locator('.order-card-offer .mapboxgl-canvas').waitFor();
  await page.locator('.order-card-offer .mapbox-loading').waitFor({ state: 'hidden' });
  assert.match(await page.locator('.driver-course-price').innerText(), /380/);
  assert.match(await page.locator('.driver-course-metrics').innerText(), /6[.,]2\s*كم[\s\S]*12\s*دقيقة/);
  const beforePoll = styleRequests;
  await page.evaluate(() => { window.driverPreviewCanvas = document.querySelector('.order-card-offer canvas'); });
  await refresh(); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.driverPreviewCanvas === document.querySelector('.order-card-offer canvas')), true);
  assert.equal(styleRequests, beforePoll, 'polling keeps the mounted map');
  assert.equal(routingRequests, 0, 'no frontend routing or directions calls');
  const acceptBounds = await page.getByRole('button', { name: 'قبول', exact: true }).boundingBox();
  const navBounds = await page.locator('.bottom-nav').boundingBox();
  assert.ok(acceptBounds.y >= 0 && acceptBounds.y + acceptBounds.height <= navBounds.y, 'accept/reject buttons are visible above mobile navigation');
  const timerBounds = await page.locator('.driver-offer-expiry').boundingBox();
  assert.ok(timerBounds.y + timerBounds.height <= navBounds.y, 'expiry is also visible above mobile navigation');
  await noOverflow(); await screenshot('driver-redesign-offer');
  for (const width of [320, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 }); await noOverflow();
  }
  await page.getByRole('button', { name: 'قبول', exact: true }).click();
  await page.getByText('تم إرسال قبولك', { exact: true }).waitFor();
  assert.equal(await page.locator('.order-card-offer').count(), 0);
  assert.equal(await page.locator('.orders-tile.is-waiting strong').innerText(), '1');
  assert.equal(responses.at(-1), 'accepted');
  console.log('PASS: route preview, price/ETA, unchanged map during updates, acceptance and real waiting state');

  courses = [incoming()]; await refresh();
  await page.getByRole('button', { name: 'رفض', exact: true }).click();
  await page.getByText('لا توجد طلبات حالياً', { exact: true }).waitFor();
  assert.equal(responses.at(-1), 'rejected');

  courses = [incoming(2)]; await refresh();
  await page.getByText('انتهت مهلة الطلب', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'قبول', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'رفض', exact: true }).isDisabled(), true);
  courses = [{ ...incoming(), trip_route_geometry: null, route_geometry: null, my_offer_dropoff_eta_minutes: null, dropoff_eta_minutes: null }];
  await refresh();
  await page.getByText('المسار غير متوفر حالياً', { exact: true }).waitFor();
  assert.equal(await page.locator('.order-card-offer canvas').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'قبول', exact: true }).isDisabled(), false);
  failResponse = true;
  await page.getByRole('button', { name: 'قبول', exact: true }).click();
  await page.locator('.driver-feedback.is-error').waitFor();
  assert.equal(await page.locator('.order-card-offer').count(), 1);
  failResponse = false;
  console.log('PASS: rejection, expiry, missing route/ETA and recoverable response failure');

  courses = [{ ...incoming(), livreur: 7, status: 'in_progress', my_offer_response: 'accepted' }];
  await refresh();
  await page.locator('.order-card-ongoing').waitFor();
  assert.equal(await page.getByRole('switch').isDisabled(), true);
  await page.getByRole('button', { name: 'إنهاء الرحلة', exact: true }).click();
  await page.getByText('لا توجد طلبات حالياً', { exact: true }).waitFor();
  assert.equal(driver.points, 40);
  console.log('PASS: ongoing trip, availability lock, completion and points');

  courses = []; failHistory = true; await home();
  await page.locator('.driver-orders-error').waitFor();
  assert.equal(await page.locator('.orders-empty').count(), 0);
  failHistory = false; courses = [incoming()]; failMap = true; await home();
  await page.locator('.driver-offer-map .mapbox-error').waitFor();
  assert.equal(await page.getByRole('button', { name: 'قبول', exact: true }).isEnabled(), true);
  failMap = false;
  console.log('PASS: network and Mapbox failures leave the screen usable');

  await page.goto(`${base}/livreur-dashboard/7?section=account`);
  await page.locator('.document-status').first().waitFor();
  assert.equal(await page.locator('.document-status').count(), 2);
  await page.getByRole('button', { name: 'تعديل', exact: true }).click();
  await page.getByLabel('الاسم', { exact: true }).fill('أمين الجديد');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByRole('heading', { name: 'أمين الجديد', exact: true }).waitFor();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'test-license.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await page.getByText('تم إرسال الوثيقة للمراجعة.', { exact: true }).waitFor();
  assert.equal(await page.locator('.document-status').first().innerText(), 'قيد المراجعة');
  await noOverflow(); await screenshot('driver-redesign-account');
  for (const width of [320, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 }); await noOverflow();
  }
  await page.locator('.driver-account-archive summary').click();
  await page.getByRole('heading', { name: 'سجل الرحلات', exact: true }).waitFor();
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await page.waitForURL(`${base}/livreurs`);
  assert.equal(await page.evaluate(() => localStorage.getItem('access')), null);

  await login('client'); courses = [];
  await page.goto(`${base}/client-dashboard`);
  await page.getByText('حساب عميل', { exact: true }).waitFor();
  assert.equal(await page.locator('.driver-shell, #driver-documents').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: account editing, documents, history, logout and client isolation');
  console.log(`Map style requests: ${styleRequests}; frontend routing requests: ${routingRequests}.`);
} catch (error) {
  console.error('URL:', page.url(), 'Runtime errors:', errors);
  throw error;
} finally {
  await browser.close();
}
