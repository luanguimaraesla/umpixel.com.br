interface AutoscrollOptions {
  getSpeed: () => number; // px/s, read every frame
  onStateChange: (playing: boolean) => void;
}

export interface Autoscroll {
  play(): void;
  pause(): void;
  toggle(): void;
  isPlaying(): boolean;
  /** Reset the baseline the safety-net compares against, after a programmatic scroll. */
  sync(): void;
}

/**
 * Continuous downward autoscroll driven by requestAnimationFrame. Any real user
 * scroll interaction (wheel, touch, arrow/space/page keys, scrollbar drag)
 * pauses it; it resumes only through play(). Respects prefers-reduced-motion by
 * never auto-starting the loop there.
 */
export function createAutoscroll(opts: AutoscrollOptions): Autoscroll {
  let playing = false;
  let rafId = 0;
  let lastTime = 0;
  let carry = 0; // sub-pixel accumulator so slow speeds still move
  let expectedY = 0; // scrollY the engine expects after its own scroll
  let movedThisFrame = false;

  function atBottom(): boolean {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return window.scrollY >= max - 1;
  }

  function frame(now: number): void {
    if (!playing) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    carry += opts.getSpeed() * dt;
    const step = Math.floor(carry);
    if (step > 0) {
      carry -= step;
      movedThisFrame = true;
      window.scrollBy(0, step);
      expectedY = window.scrollY;
      movedThisFrame = false;
      if (atBottom()) {
        pause();
        return;
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function play(): void {
    if (playing) return;
    if (atBottom()) return;
    playing = true;
    carry = 0;
    lastTime = performance.now();
    expectedY = window.scrollY;
    rafId = requestAnimationFrame(frame);
    opts.onStateChange(true);
  }

  function pause(): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    opts.onStateChange(false);
  }

  function toggle(): void {
    if (playing) pause();
    else play();
  }

  function sync(): void {
    expectedY = window.scrollY;
  }

  // --- User-interaction pause triggers ---
  const pauseKeys = new Set([
    ' ',
    'Spacebar',
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
  ]);

  window.addEventListener('wheel', () => pause(), { passive: true });
  window.addEventListener('touchstart', () => pause(), { passive: true });
  window.addEventListener(
    'keydown',
    (e) => {
      if (pauseKeys.has(e.key)) pause();
    },
    { passive: true },
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.clientX > window.innerWidth - 24) pause();
    },
    { passive: true },
  );

  // Safety net: a scroll we did not cause means the user grabbed the bar/keys.
  window.addEventListener(
    'scroll',
    () => {
      if (!playing || movedThisFrame) return;
      if (Math.abs(window.scrollY - expectedY) > 4) pause();
    },
    { passive: true },
  );

  return { play, pause, toggle, isPlaying: () => playing, sync };
}
