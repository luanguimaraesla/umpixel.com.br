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
 * On top of those inputs there is one position signal, and it takes TWO
 * consecutive frames to fire. When scrollY jumps up by more than
 * TAKEOVER_UP_PX between frames, the first such frame is treated as a one-shot
 * adjustment: the engine adopts the new position and keeps playing. Only if
 * scrollY is STILL moving up on the very next frame does it read as a real
 * takeover (status-bar tap animation, scrollbar drag up) and pause, because the
 * engine itself only ever scrolls down. The accepted trade-off is that a single
 * upward jump such as find-in-page no longer pauses.
 *
 * A small-tolerance position heuristic (pause when scrollY drifts off the
 * engine's own expected value) was deliberately NOT used: mobile browsers move
 * scrollY out-of-band all the time (async pan-zoom compositors, dynamic URL
 * toolbars, visual-viewport shifts), so such a check false-positives forever and
 * pauses playback within a second. Only a large, direction-gated jump sustained
 * across two frames is trusted, which those small one-shot drifts never trip.
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
  let upSuspect = false; // one upward jump absorbed; a second in a row is a takeover

  function atBottom(): boolean {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return window.scrollY >= max - 1;
  }

  function frame(now: number): void {
    if (!playing) return;
    // A one-shot upward adjustment (browser chrome, viewport shifts) of any size
    // gets absorbed: adopt the new position and keep going. Only scrollY STILL
    // moving up on the NEXT frame too is a real takeover (status-bar tap
    // animation, scrollbar drag up), because the engine itself only scrolls down.
    // Trade-off: a single-jump upward scroll such as find-in-page no longer pauses.
    const drop = prevY - window.scrollY;
    if (drop > TAKEOVER_UP_PX) {
      if (upSuspect) {
        pause('takeover-up');
        return;
      }
      upSuspect = true;
      // instrumentation for the ?debug overlay
      document.dispatchEvent(
        new CustomEvent('autoscroll:debug', {
          detail: { type: 'absorb', drop, y: window.scrollY, prevY, t: performance.now() },
        }),
      );
      prevY = window.scrollY;
    } else {
      upSuspect = false;
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
        pause('bottom');
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
    upSuspect = false;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
    // instrumentation for the ?debug overlay
    document.dispatchEvent(
      new CustomEvent('autoscroll:debug', {
        detail: { type: 'play', y: window.scrollY, prevY, t: performance.now() },
      }),
    );
    opts.onStateChange(true);
  }

  function pause(reason: string): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(rafId);
    // instrumentation for the ?debug overlay
    document.dispatchEvent(
      new CustomEvent('autoscroll:debug', {
        detail: { type: 'pause', reason, y: window.scrollY, prevY, drop: prevY - window.scrollY, t: performance.now() },
      }),
    );
    opts.onStateChange(false);
  }

  function sync(): void {
    prevY = window.scrollY;
    upSuspect = false;
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

  window.addEventListener('wheel', () => pause('wheel'), { passive: true });
  // A touch pan is scroll intent, a tap is not. Pause on touchmove, not
  // touchstart, so a tap whose click is suppressed no longer kills the loop and
  // taps on the player controls do not pre-empt their own click handlers.
  window.addEventListener('touchmove', () => pause('touch-pan'), { passive: true });
  window.addEventListener(
    'keydown',
    (e) => {
      if (pauseKeys.has(e.key)) pause('key:' + e.key);
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
      if (e.pointerType === 'mouse' && (e.button === 1 || e.clientX > window.innerWidth - 24)) {
        pause(e.button === 1 ? 'middle-click' : 'scrollbar-gutter');
      }
    },
    { passive: true },
  );

  return { play, pause: () => pause('api'), isPlaying: () => playing, sync };
}
