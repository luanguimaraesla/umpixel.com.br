/**
 * On-device diagnostic overlay for the autoscroll engine. Always imported but
 * self-disabling: it does nothing unless the page URL carries a ?debug flag, so
 * production visitors never see it and it costs nothing to ship.
 *
 * When enabled it paints a tiny fixed panel in the top-left corner with a live
 * status block and a rolling log of the events that matter for the intermittent
 * self-pause bug: autoscroll pauses/absorbs/plays, viewport and orientation
 * changes, and touch gestures. The panel has pointer-events: none so it can
 * NEVER swallow a tap.
 */
export function initDebug(): void {
  if (!new URLSearchParams(window.location.search).has('debug')) return;

  const t0 = performance.now();
  const elapsed = (): string => ((performance.now() - t0) / 1000).toFixed(1);

  let playing = false;
  let prevInnerH = window.innerHeight;
  let awaitingMove = false; // one touchmove logged per touchstart

  const log: string[] = [];
  let statusEl: HTMLDivElement;
  let eventsEl: HTMLDivElement;

  function renderEvents(): void {
    eventsEl.textContent = log.join('\n');
  }

  function push(msg: string): void {
    log.push(elapsed() + 's ' + msg);
    if (log.length > 12) log.shift();
    renderEvents();
  }

  function renderStatus(): void {
    const lines = [
      'playing ' + (playing ? 'yes' : 'no'),
      'scrollY ' + Math.round(window.scrollY),
      'innerH ' + window.innerHeight,
    ];
    if (window.visualViewport) {
      lines.push('vv.h ' + Math.round(window.visualViewport.height));
      lines.push('vv.top ' + Math.round(window.visualViewport.offsetTop));
    }
    lines.push('dpr ' + window.devicePixelRatio);
    statusEl.textContent = lines.join('\n');
  }

  function mount(): void {
    const panel = document.createElement('div');
    const s = panel.style;
    s.position = 'fixed';
    s.top = '0';
    s.left = '0';
    s.font = '11px monospace';
    s.lineHeight = '1.35';
    s.background = 'rgba(0,0,0,0.75)';
    s.padding = '6px 8px';
    s.borderRadius = '6px';
    s.zIndex = '99999';
    s.pointerEvents = 'none';
    s.maxWidth = '92vw';
    s.whiteSpace = 'pre';

    statusEl = document.createElement('div');
    statusEl.style.color = '#9f9';

    eventsEl = document.createElement('div');
    eventsEl.style.color = '#fff';
    eventsEl.style.marginTop = '4px';

    panel.appendChild(statusEl);
    panel.appendChild(eventsEl);
    document.body.appendChild(panel);

    renderStatus();
    renderEvents();
    setInterval(renderStatus, 250);

    document.addEventListener('autoscroll:debug', (e) => {
      const d = (e as CustomEvent).detail;
      if (d.type === 'pause') {
        playing = false;
        push('!! PAUSE ' + d.reason + ' drop=' + Math.round(d.drop) + 'px y=' + Math.round(d.y));
      } else if (d.type === 'absorb') {
        push('~ absorb drop=' + Math.round(d.drop) + 'px y=' + Math.round(d.y));
      } else if (d.type === 'play') {
        playing = true;
        push('PLAY y=' + Math.round(d.y));
      }
    });

    window.addEventListener('resize', () => {
      push('resize innerH ' + prevInnerH + '->' + window.innerHeight);
      prevInnerH = window.innerHeight;
    });

    if (window.visualViewport) {
      const vv = window.visualViewport;
      vv.addEventListener('resize', () => {
        push('vv h=' + Math.round(vv.height) + ' top=' + Math.round(vv.offsetTop));
      });
    }

    window.addEventListener('orientationchange', () => push('orientation'));

    window.addEventListener(
      'touchstart',
      () => {
        awaitingMove = true;
        push('touchstart');
      },
      { passive: true },
    );
    window.addEventListener(
      'touchmove',
      () => {
        if (!awaitingMove) return;
        awaitingMove = false;
        push('touchmove');
      },
      { passive: true },
    );
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
