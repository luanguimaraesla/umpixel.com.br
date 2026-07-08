// Scroll-triggered reveal for [data-reveal] elements. Adds `is-visible` once the
// element scrolls into view, then stops observing it. All motion is gated in CSS
// behind prefers-reduced-motion, so this file does no motion checks: reduced-motion
// users still get the class, they just see it applied without a transition.
export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  // Fallback for engines without IntersectionObserver: reveal everything now.
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );

  targets.forEach((el) => observer.observe(el));
}
