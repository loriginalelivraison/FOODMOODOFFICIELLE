// All page movement uses the visible area, including the mobile keyboard.
export function getScrollViewport() {
  const viewport = window.visualViewport;
  let top = (viewport?.offsetTop || 0) + 12;
  let bottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 12;
  const header = document.querySelector(".topbar")?.getBoundingClientRect();
  const navigation = document.querySelector(".bottom-nav")?.getBoundingClientRect();
  if (header?.height && header.bottom > top && header.bottom < bottom) top = header.bottom + 12;
  if (navigation?.height && navigation.top > top && navigation.top < bottom) bottom = navigation.top - 12;
  return { top, bottom: Math.max(top + 60, bottom) };
}

export function revealElement(element, { focus = false, behavior = "smooth" } = {}) {
  if (!element?.isConnected || !element.getClientRects().length) return;
  if (focus) {
    if (!element.matches("input, select, textarea, button, a[href], [tabindex]")) element.tabIndex = -1;
    element.focus({ preventScroll: true });
  }
  const { top, bottom } = getScrollViewport();
  const rect = element.getBoundingClientRect();
  if (rect.top >= top && rect.bottom <= bottom) return;
  // Long sections start at their heading; small fields stay comfortably centred.
  const space = Math.max(0, (bottom - top - rect.height) / 2);
  window.scrollTo({
    top: Math.max(0, window.scrollY + rect.top - top - space),
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : behavior,
  });
}

export function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export function scrollToPageTopWhenReady() {
  scrollToPageTop();
  const frame = requestAnimationFrame(scrollToPageTop);
  return () => cancelAnimationFrame(frame);
}

export function scrollToSection(element, options) {
  revealElement(element, options);
}
