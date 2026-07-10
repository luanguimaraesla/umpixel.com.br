interface AutoscrollOptions {
  getSpeed: () => number; // px/s, read every frame
  onStateChange: (playing: boolean) => void;
}

export interface Autoscroll {
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  // Reset the takeover baseline after a page-driven programmatic scroll.
  sync(): void;
}

/**
 * Continuous downward autoscroll driven by requestAnimationFrame. Pausing is
 * input-driven: wheel, touch pan, arrow/space/page keys, or grabbing the
 * scrollbar gutter or middle-clicking with a mouse. It resumes only through
 * play(). A touch PAN (touchmove) is scroll intent and pauses, but a bare tap
 * does not, so taps on the player controls never pre-empt their own click
 * handlers.
 *
 * On top of those inputs there is one position signal: a large upward scrollY
 * jump between frames. That is safe because the engine only ever scrolls down,
 * and mobile out-of-band drift is small and mostly downward, so a big upward
 * move can only be a user or browser takeover (status-bar tap, find-in-page,
 * scrollbar drag up).
 *
 * A small-tolerance position heuristic (pause when scrollY drifts off the
 * engine's own expected value) was deliberately NOT used: mobile browsers move
 * scrollY out-of-band all the time (async pan-zoom compositors, dynamic URL
 * toolbars, visual-viewport shifts), so such a check false-positives forever and
 * pauses playback within a second. Only a large, direction-gated jump is
 * trusted, which those small drifts never trip.
 *
 * Respects prefers-reduced-motion by never auto-starting the loop there.
 */
export function createAutoscroll(opts: AutoscrollOptions): Autoscroll {
  // Upward jumps larger than this between frames read as a user takeover; browser
  // chrome adjustments (URL toolbar, visual viewport) stay well under it, and the
  // engine itself never scrolls up.
  const TAKEOVER_UP_PX = 200;

  let playing = false;
  let rafId = 0;
  let lastTime = 0;
  let carry = 0; // sub-pixel accumulator so slow speeds still move
  let prevY = 0; // scrollY where the engine last left the page

  function atBottom(): boolean {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return window.scrollY >= max - 1;
  }

  function frame(now: number): void {
    if (!playing) return;
    // Engine only scrolls down; a big upward jump is a takeover: status-bar tap,
    // find-in-page, scrollbar drag up.
    if (window.scrollY < prevY - TAKEOVER_UP_PX) {
      pause();
      return;
    }
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    carry += opts.getSpeed() * dt;
    const step = Math.floor(carry);
    if (step > 0) {
      carry -= step;
      window.scrollBy(0, step);
      prevY = window.scrollY;
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
    prevY = window.scrollY;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
    opts.onStateChange(true);
  }

  function pause(): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    opts.onStateChange(false);
  }

  function sync(): void {
    prevY = window.scrollY;
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
  // A touch pan is scroll intent, a tap is not. Pause on touchmove, not
  // touchstart, so a tap whose click is suppressed no longer kills the loop and
  // taps on the player controls do not pre-empt their own click handlers.
  window.addEventListener('touchmove', () => pause(), { passive: true });
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
      // Right-edge gutter grab = scrollbar drag, but only on desktop. Gated to
      // mouse so a touch/pen tap near a phone's right edge (e.g. the speed select
      // in the bottom bar) never pauses. Middle-click starts the browser's own
      // autoscroll pan, which would otherwise fight the engine; gated to mouse so
      // touch never trips either branch.
      if (e.pointerType === 'mouse' && (e.button === 1 || e.clientX > window.innerWidth - 24)) pause();
    },
    { passive: true },
  );

  return { play, pause, isPlaying: () => playing, sync };
}
