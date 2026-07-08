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

  // Arm the CSS hide only now that the reveal engine is live. If this module
  // never runs (bundle fails, JS off), the class is absent and the beats render
  // as plain visible text instead of blank gaps.
  document.documentElement.classList.add('reveal-on');

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
