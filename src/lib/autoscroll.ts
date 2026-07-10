interface AutoscrollOptions {
  getSpeed: () => number; // px/s, read every frame
  onStateChange: (playing: boolean) => void;
}

export interface Autoscroll {
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  /** Reset the baseline the safety-net compares against, after a programmatic scroll. */
  sync(): void;
}

/**
 * Continuous downward autoscroll driven by requestAnimationFrame. Any real user
 * scroll interaction (wheel, touch pan, arrow/space/page keys, scrollbar drag)
 * pauses it; it resumes only through play(). A touch PAN (touchmove) is scroll
 * intent and pauses, but a bare tap does not, so taps on the player controls
 * never pre-empt their own click handlers. Respects prefers-reduced-motion by
 * never auto-starting the loop there.
 */
export function createAutoscroll(opts: AutoscrollOptions): Autoscroll {
  // Grace window after play() during which unexpected scrollY drift is absorbed
  // (sync) rather than read as a user takeover (pause). See the scroll safety net.
  const PLAY_GRACE_MS = 800;

  let playing = false;
  let rafId = 0;
  let lastTime = 0;
  let carry = 0; // sub-pixel accumulator so slow speeds still move
  let expectedY = 0; // scrollY the engine expects after its own scroll
  let playStartedAt = 0; // performance.now() at the last play(), for the grace window

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
      window.scrollBy(0, step);
      expectedY = window.scrollY;
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
    playStartedAt = lastTime;
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
      // in the bottom bar) never pauses.
      if (e.pointerType === 'mouse' && e.clientX > window.innerWidth - 24) pause();
    },
    { passive: true },
  );

  // Safety net: a scroll we did not cause means the user grabbed the bar/keys.
  window.addEventListener(
    'scroll',
    () => {
      if (!playing) return;
      if (Math.abs(window.scrollY - expectedY) > 4) {
        // Right after a tap starts playback, leftover fling momentum, tap-slop
        // micro-scrolls and mobile URL-bar adjustments move scrollY without the
        // engine. Inside the grace window, absorb that drift instead of reading it
        // as a user takeover; only past it does an off-baseline scroll mean pause.
        if (performance.now() - playStartedAt < PLAY_GRACE_MS) sync();
        else pause();
      }
    },
    { passive: true },
  );

  return { play, pause, isPlaying: () => playing, sync };
}
