import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { destinations } from '../src/data/destinations.js';
import { truncateAddress } from '../src/utils/addressLabel.js';

// Only synthetic accounts/API responses are used. No production request is sent.
const base = process.env.WINRAK_PREVIEW_URL || 'http://localhost:5176';
const output = fileURLToPath(new URL('../../verification/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  geolocation: { latitude: 35.932, longitude: 0.09 }, permissions: ['geolocation'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /TypeError|React Router caught|Error handled by/.test(message.text())) errors.push(message.text());
});
const driver = { id: 7, nom: 'اختبار', telephone: '0555000000', ville: 'مستغانم', vehicule: 'voiture',
  disponible: true, est_en_ligne: true, points: 30, note: 4.8, nombre_livraisons: 12 };
const client = { id: 8, nom: 'اختبار', telephone: '0555000001', points: 20 };
const quoteRequests = [], courseRequests = [];
let offers = [], historyRequests = 0;
const serverError = 'تعذر إنشاء الحساب. حاول مجدداً.';
const deadline = Date.now() + 150000;
const trip = [[0.09, 35.932], [0.094, 35.93], [0.1, 35.929], [0.108, 35.929]];
let createdCourse = null;
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (path.includes('/api/')) {
    let data = [], status = 200;
    if (path.endsWith('/clients/register/')) { status = 503; data = { error: serverError }; }
    else if (path.includes('/livreurs/7/documents/')) data = [];
    else if (path.includes('/livreurs/7/')) data = driver;
    else if (path.includes('/clients/8/')) data = client;
    else if (path.includes('/courses/active/')) data = { active: false };
    else if (path.endsWith('/courses/address/')) data = { address: 'شارع الاختبار الأول قرب الساحة المركزية مستغانم' };
    else if (path.endsWith('/courses/quote/')) {
      const payload = request.postDataJSON(); quoteRequests.push(payload);
      data = { ...payload, proposed_price: 380, trip_distance_km: 6.2, estimated_distance_km: 6.2,
        dropoff_eta_minutes: 12, route_geometry: trip, trip_route_geometry: trip };
    } else if (path.endsWith('/courses/request/')) {
      const payload = request.postDataJSON(); courseRequests.push(payload);
      createdCourse = { ...payload, id: 42, client: 8, livreur: null, status: 'searching', active: true,
        final_price: payload.proposed_price, accepted_drivers: [], events: [], trip_route_geometry: trip };
      data = createdCourse;
    } else if (path.endsWith('/courses/42/')) data = createdCourse;
    else if (path.endsWith('/courses/offers/')) data = offers;
    else if (path.endsWith('/courses/')) {
      historyRequests++;
      data = offers.map(course => ({ ...course, my_offer_expires_in: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) }));
    }
    await route.fulfill({ status, json: data });
  } else if (url.hostname === 'api.mapbox.com' && path.includes('/styles/')) {
    await route.fulfill({ json: { version: 8, sources: {}, layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e8edf0' } },
    ] } });
  } else if (url.origin === base) await route.continue();
  else await route.abort();
});

async function settle() { await page.waitForTimeout(600); }
async function atTop(label) {
  await page.waitForFunction(() => window.scrollY <= 2, null, { timeout: 5000 });
  assert.ok(await page.evaluate(() => window.scrollY <= 2), label);
}
async function visibleBetweenBars(locator, label, viewportHeight) {
  const bounds = await locator.boundingBox();
  assert.ok(bounds, `${label}: element exists`);
  const header = await page.locator('.topbar').boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  const height = viewportHeight ?? page.viewportSize().height;
  const top = header && header.y >= 0 ? header.y + header.height : 0;
  const bottom = nav && nav.y < height ? nav.y : height;
  assert.ok(bounds.y >= top - 2 && bounds.y + bounds.height <= bottom + 2,
    `${label}: [${bounds.y}, ${bounds.y + bounds.height}] within [${top}, ${bottom}]`);
}
async function session(role) {
  await page.goto(`${base}/privacy`);
  await page.evaluate(({ role, account }) => {
    localStorage.clear(); sessionStorage.clear();
    if (role) {
      localStorage.setItem('access', 'synthetic-test-token');
      localStorage.setItem('role', role); localStorage.setItem(role, JSON.stringify(account));
    }
    window.dispatchEvent(new Event('authChanged'));
  }, { role, account: role === 'livreur' ? driver : client });
}
async function selectPlace(fieldId, id) {
  const place = destinations.find(item => item.id === id);
  await page.locator(`#${fieldId}`).fill(place.name_fr);
  const field = page.locator('.local-destination-field').filter({ has: page.locator(`#${fieldId}`) });
  await field.locator('.local-destination-results button').filter({ hasText: truncateAddress(place.search_name) }).first().click();
  return place;
}
async function screenshot(name) { await page.screenshot({ path: `${output}/${name}.png` }); }

try {
  await session(null);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  assert.ok(await page.evaluate(() => scrollY > 100), 'start on a scrolled long page');
  await page.locator('.bottom-nav a[href="/connexion-client"]').click();
  await page.locator('#client-auth-name').waitFor(); await settle(); await atTop('client registration starts at top');
  await page.getByRole('button', { name: 'عامل توصيل / سائق', exact: true }).click();
  await page.locator('#courier-register-name').waitFor(); await settle(); await atTop('driver registration starts at top');
  console.log('PASS: route and account-type navigation open registration at the beginning');

  // preventScroll ensures this exercises the app rather than Chrome's built-in focus scroll.
  await page.locator('#courier-register-password').evaluate(element => element.focus({ preventScroll: true }));
  await settle();
  await visibleBetweenBars(page.locator('#courier-register-password'), 'driver password follows focus');
  const typingY = await page.evaluate(() => scrollY);
  await page.keyboard.type('password123', { delay: 25 }); await settle();
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - typingY) <= 3, 'typing does not repeatedly move the screen');
  console.log('PASS: lower fields stay visible and typing does not cause jumps');

  // Simulate the visual viewport reduction produced by a mobile software keyboard.
  await page.evaluate(() => {
    // Retain the original object so this exercises the mounted resize listener.
    // No new focus event occurs after the keyboard opens.
    const field = document.activeElement;
    window.scrollTo({ top: scrollY + field.getBoundingClientRect().top - 540, behavior: 'instant' });
    const viewport = window.visualViewport;
    window.testViewportHeightDescriptor = Object.getOwnPropertyDescriptor(viewport, 'height');
    Object.defineProperty(viewport, 'height', { configurable: true, value: 420 });
  });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'courier-register-password');
  assert.ok((await page.locator('#courier-register-password').boundingBox()).y > 420,
    'focused field is initially hidden below the reduced visual viewport');
  const beforeKeyboardY = await page.evaluate(() => scrollY);
  await page.evaluate(() => {
    const viewport = window.visualViewport;
    viewport.dispatchEvent(new Event('resize'));
  });
  await settle();
  await visibleBetweenBars(page.locator('#courier-register-password'), 'field above software keyboard after resize', 420);
  assert.ok(await page.evaluate(() => scrollY) > beforeKeyboardY, 'resize reveals the already focused field');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'courier-register-password');
  await page.evaluate(() => {
    const viewport = window.visualViewport;
    if (window.testViewportHeightDescriptor) Object.defineProperty(viewport, 'height', window.testViewportHeightDescriptor);
    else delete viewport.height;
    delete window.testViewportHeightDescriptor;
    viewport.dispatchEvent(new Event('resize'));
  });
  console.log('PASS: keyboard resize reveals the already focused field through the original visual viewport listener');

  await page.locator('.auth-form button[type="submit"]').click(); await settle();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'courier-register-name', 'first invalid field receives focus');
  await visibleBetweenBars(page.locator('#courier-register-name'), 'first missing field');
  assert.equal(await page.locator('#courier-register-name').evaluate(element => element.validationMessage), 'يرجى ملء هذه الخانة');
  console.log('PASS: invalid submission returns to the first missing field');

  await page.locator('#courier-register-name').fill('اختبار');
  await page.locator('#courier-register-phone').fill('0555000000');
  await page.locator('#courier-register-city').selectOption('مستغانم');
  await page.locator('#courier-register-vehicle').selectOption('voiture');
  await page.locator('.auth-form button[type="submit"]').click();
  await page.locator('#courier-location-error').waitFor(); await settle();
  await visibleBetweenBars(page.locator('#courier-location-error'), 'GPS consent error');
  await visibleBetweenBars(page.locator('#courier-location-consent'), 'GPS consent correction');
  assert.equal(await page.locator('#courier-location-consent').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#courier-location-consent').getAttribute('aria-describedby'), 'courier-location-error');
  await screenshot('scroll-consent-error');
  console.log('PASS: custom errors show their message and the control to correct');

  await page.goto(`${base}/connexion-client`); await settle();
  await page.locator('#client-auth-name').fill('اختبار');
  await page.locator('#client-auth-phone').fill('0555000001');
  await page.locator('#client-auth-password').fill('password123');
  await page.locator('.auth-form button[type="submit"]').click();
  await page.locator('#client-auth-error').waitFor(); await settle();
  assert.equal(await page.locator('#client-auth-error').innerText(), serverError);
  await visibleBetweenBars(page.locator('#client-auth-error'), 'backend error');
  await screenshot('scroll-server-error');
  console.log('PASS: server error scrolls back to its visible message');

  await session('client'); await page.goto(`${base}/livreurs`); await settle();
  await atTop('booking opens at top');
  await page.locator('.vehicle-type-option').filter({ hasText: 'سيارة' }).click();
  await settle(); await visibleBetweenBars(page.locator('#destination-input'), 'destination step follows vehicle selection');
  const firstDestination = await selectPlace('destination-input', 34);
  await page.locator('.booking-summary').waitFor(); await settle();
  await visibleBetweenBars(page.locator('.booking-summary header'), 'recap follows destination selection');
  const pickup = await selectPlace('departure-input', 35);
  await page.locator('.booking-summary').waitFor(); await settle();
  const pickupLabel = page.locator('.booking-summary-stop.is-pickup p span');
  const destinationLabel = page.locator('.booking-summary-stop.is-destination p span');
  assert.equal(await pickupLabel.innerText(), truncateAddress(pickup.search_name));
  assert.equal(await destinationLabel.innerText(), truncateAddress(firstDestination.search_name));
  assert.equal(await destinationLabel.getAttribute('title'), firstDestination.search_name);
  assert.equal(await page.locator('#destination-input').inputValue(), firstDestination.search_name, 'editable address remains complete');
  const quoteCount = quoteRequests.length;
  await page.getByRole('button', { name: 'زيادة السعر', exact: true }).click();
  assert.equal(await page.locator('.booking-summary input[type="number"]').inputValue(), '430');
  await page.getByRole('button', { name: 'خفض السعر', exact: true }).click(); await settle();
  assert.equal(await page.locator('.booking-summary input[type="number"]').inputValue(), '380');
  assert.equal(quoteRequests.length, quoteCount, 'price edits do not add quote API calls');
  const secondDestination = await selectPlace('destination-input', 66);
  await page.locator('.booking-summary').waitFor(); await settle();
  assert.equal(await destinationLabel.innerText(), truncateAddress(secondDestination.search_name), 'changing the destination updates the recap');
  await visibleBetweenBars(page.locator('.booking-summary header'), 'updated recap follows the new destination');
  await screenshot('booking-summary');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'booking remains within the mobile viewport');
  }
  await page.locator('.course-search-button').click();
  await page.waitForURL(`${base}/course/42`); await settle();
  assert.equal(courseRequests.length, 1);
  assert.equal(courseRequests[0].destination, secondDestination.search_name);
  assert.equal(courseRequests[0].pickup_name, pickup.search_name);
  assert.equal(courseRequests[0].pickup_address, pickup.search_name);
  assert.equal(courseRequests[0].proposed_price, 380);
  await atTop('created course opens at top');
  console.log('PASS: booking steps, recap edits, five-word labels, complete POST addresses and unchanged quote count');

  await session('livreur');
  offers = [42, 43, 44].map(id => ({ id, client: 8, livreur: null, vehicle_type: 'voiture', status: 'searching', active: true,
    my_offer_response: 'pending', my_offer_expires_in: 150, proposed_price: '380', trip_distance_km: 6.2,
    my_offer_dropoff_eta_minutes: 12, pickup_address: pickup.search_name, destination: secondDestination.search_name,
    pickup_latitude: 35.932, pickup_longitude: 0.09, destination_latitude: 35.929, destination_longitude: 0.108,
    trip_route_geometry: trip, accepted_drivers: [], events: [] }));
  await page.goto(`${base}/livreur-dashboard/7`);
  await page.locator('.driver-course-card').first().waitFor(); await settle();
  await page.evaluate(() => window.scrollTo(0, 500)); await settle();
  const pollingY = await page.evaluate(() => scrollY), readsBefore = historyRequests;
  assert.ok(pollingY > 100, 'polling test starts scrolled down');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('winrakPush', { detail: { course_id: '42' } })));
  await page.waitForTimeout(1100);
  assert.ok(historyRequests > readsBefore, 'poll refresh really ran');
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - pollingY) <= 3, 'unchanged polling/countdown does not move the page');
  await page.locator('.bottom-nav a[href*="section=account"]').click(); await settle();
  await atTop('account query navigation opens at top');
  console.log('PASS: polling/countdown preserve reading position and account navigation starts at top');
  assert.deepEqual(errors, []);
} catch (error) {
  console.error('URL:', page.url(), 'Uncaught errors:', errors);
  await page.screenshot({ path: `${output}/scroll-failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
