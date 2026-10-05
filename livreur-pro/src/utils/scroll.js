// Remet la page entièrement en haut
export function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

// Même chose mais renforcé : la carte et la géolocalisation décalent la mise en page
// après le premier rendu, on repasse donc à la position haute juste après.
export function scrollToPageTopWhenReady() {
  scrollToPageTop();

  const frame = requestAnimationFrame(scrollToPageTop);
  const timer = setTimeout(scrollToPageTop, 150);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

// Fait défiler l'écran vers la partie importante de la page
export function scrollToSection(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}
