/**
 * Motion lab — shared harness.
 *
 * Every candidate animation is a plain module (see ./scenes/*.js) that knows
 * nothing about the DOM. This file owns the parts that are easy to get wrong
 * and must be identical across candidates, so comparisons are fair:
 *
 *   - devicePixelRatio capped at 2
 *   - the loop pauses offscreen (IntersectionObserver) and on hidden tabs
 *   - prefers-reduced-motion renders a single static frame, no loop
 *   - resize is debounced and re-seeds the scene
 *   - destroy() is always called before a re-seed, so nothing leaks
 *
 * These are the same non-negotiables the live site's 3D layer follows. A
 * candidate that only looks good without them isn't a candidate.
 */

const DPR_CAP = 2;

export function mountScene({ canvas, scene, params, onFps }) {
  /* 2D scenes get a context; WebGL scenes get the canvas and own their own */
  const is2d = scene.type !== 'webgl';
  const ctx = is2d ? canvas.getContext('2d', { alpha: true }) : null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let instance = null;
  let raf = null;
  let last = 0;
  let visible = false;
  /* External gate. The lab runs one scene at a time: four full-size canvases
     at once saturate the compositor, and it makes the fps readout useless as
     a comparison because every candidate is fighting the others for frames. */
  let enabled = true;
  let w = 0;
  let h = 0;

  /* fps sampling — cheap, and the only honest way to compare candidates */
  let frames = 0;
  let fpsClock = 0;

  function size() {
    const rect = canvas.getBoundingClientRect();
    /* resScale < 1 renders below display resolution. For the fluid scenes this
       is the soft-focus optic itself — cheaper AND closer to the shallow depth
       of field the direction calls for. */
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * (scene.resScale || 1);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    /* the 2D transform maps CSS px -> device px; GL scenes own their
       viewport and work in device pixels throughout */
    if (is2d) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    instance?.destroy?.();
    size();
    if (is2d) ctx.clearRect(0, 0, w, h);
    instance = scene.create(is2d ? ctx : canvas, w, h, params);
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    /* clamp dt so a backgrounded tab doesn't fast-forward the scene */
    const dt = Math.min((t - last) / 1000 || 0, 1 / 20);
    last = t;
    instance?.step(dt);

    frames++;
    if (t - fpsClock > 500) {
      onFps?.(Math.round((frames * 1000) / (t - fpsClock)));
      frames = 0;
      fpsClock = t;
    }
  }

  function start() {
    if (raf !== null || reduced.matches || !enabled) return;
    last = performance.now();
    fpsClock = last;
    frames = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
  }

  function sync() {
    if (visible && enabled && !document.hidden) start();
    else stop();
  }

  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      sync();
    },
    { threshold: 0.05 }
  );
  io.observe(canvas);

  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);

  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      seed();
      if (reduced.matches) instance?.step(0);
    }, 160);
  };
  window.addEventListener('resize', onResize);

  const onReduced = () => {
    stop();
    seed();
    if (reduced.matches) instance?.step(0);
    else sync();
  };
  reduced.addEventListener('change', onReduced);

  seed();
  if (reduced.matches) instance?.step(0);

  return {
    /** run/pause from the outside — see  above */
    setEnabled(v) {
      enabled = v;
      sync();
    },
    /** re-seed after a control changes */
    refresh() {
      stop();
      seed();
      if (reduced.matches) instance?.step(0);
      else sync();
    },
    destroy() {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      reduced.removeEventListener('change', onReduced);
      clearTimeout(resizeTimer);
      instance?.destroy?.();
      instance = null;
    },
  };
}

/* ---------- helpers shared by the scenes ---------- */

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const TAU = Math.PI * 2;

/** The brand palette, as the scenes consume it. */
export const PALETTE = {
  gold: '201, 169, 110',
  goldlight: '227, 201, 146',
  teal: '45, 212, 191',
  tealdeep: '14, 165, 233',
  rose: '217, 164, 164',
  cream: '244, 241, 236',
};

export const rgba = (triplet, a) => `rgba(${triplet}, ${a})`;

/**
 * Ultra-luxury palette. Deliberately excludes the site's teal: the direction
 * rules out clinical whites and bright blues, and teal reads as surgical.
 * Backgrounds are warm obsidian / espresso rather than neutral ink, so the
 * metals sit in warm light instead of cold.
 */
export const LUX = {
  obsidian: '20, 16, 14',
  espresso: '26, 19, 16',
  emerald: '14, 26, 22',
  champagne: '227, 201, 146',
  gold: '201, 169, 110',
  roseGold: '224, 168, 153',
  blush: '232, 196, 188',
  pearl: '242, 233, 228',
  bronze: '168, 124, 79',
};
