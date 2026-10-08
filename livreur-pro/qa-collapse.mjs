export default async function run(page, ui) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 36.7538, longitude: 3.0588 });

  await page.goto("http://localhost:5174/livreurs", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const snap = await ui.snapshot();
  const carRef = snap.match(/@(e\d+) button "سيارة"/)?.[1];
  if (!carRef) return { error: "no vehicle button", snap };
  await ui.click(carRef);
  await page.waitForTimeout(800);

  const readState = () => page.evaluate(() => ({
    originFieldPresent: Boolean(document.querySelector("#departure-input")),
    originValue: document.querySelector("#departure-input")?.value || null,
    confirmedPanel: document.querySelector(".departure-confirmed-value")?.innerText || null,
    mapButtons: document.querySelectorAll(".departure-map-btn").length,
    confirmButtons: [...document.querySelectorAll(".destination-confirm-button")]
      .map((b) => b.innerText.trim()),
  }));

  const before = await readState();

  // Click the origin confirm button.
  const snap2 = await ui.snapshot();
  const confirmRef = snap2.match(/@(e\d+) button "تأكيد مكان الانطلاق"/)?.[1]
    || snap2.match(/@(e\d+) button "تأكيد موقعي الحالي كنقطة انطلاق"/)?.[1];
  if (!confirmRef) return { error: "no origin confirm button", before, snap2 };
  await ui.click(confirmRef);
  await page.waitForTimeout(700);

  const after = await readState();
  const treeAfter = await ui.snapshot({ full: true });

  return { before, after, treeAfter };
}
