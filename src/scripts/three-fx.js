/**
 * Three.js layer — DNA helix + stem-cell particle field.
 * Lazily imported from main.js whenever a [data-three] host exists.
 *
 * Helix presets:
 *  - 'ambient'   background presence (science split-section)
 *  - 'showpiece' the homepage interlude: thicker nodes (~1.5×), wider
 *    radius, brighter rungs, fake-bloom halo pass, ±14° cursor tilt,
 *    cursor-proximity glow (O(n) projected-distance check, no raycasting),
 *    drag-to-rotate with momentum on touch, and a mobile FPS guard that
 *    falls back to the static SVG if frames run slow.
 *
 * Non-negotiables:
 *  - pixel ratio capped at 2
 *  - loops pause offscreen (IntersectionObserver) and on hidden tabs
 *  - prefers-reduced-motion: one static frame, no loop
 *  - full geometry/material/texture disposal on pagehide
 *  - one shared soft-glow sprite texture across both components
 *  - canvases never intercept pointer events (cursor input is window- or
 *    section-level) and hosts are pre-sized — no layout shift
 */
import * as THREE from 'three';
import gsap from 'gsap';

const GOLD = new THREE.Color('#C9A96E');
const TEAL = new THREE.Color('#2DD4BF');
const TEAL_DEEP = new THREE.Color('#0EA5E9');
const INK = 0x0a0a0b;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = !window.matchMedia('(min-width: 1024px)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* ------------------------------------------------------------------
   Shared sprite textures (created once, disposed once)
   ------------------------------------------------------------------ */

let glowSprite = null;
let cellSprite = null;

function makeGlowSprite() {
  if (glowSprite) return glowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowSprite = new THREE.CanvasTexture(c);
  glowSprite.colorSpace = THREE.SRGBColorSpace;
  return glowSprite;
}

/* Larger blurred "cell": soft disc with a faint membrane ring */
function makeCellSprite() {
  if (cellSprite) return cellSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2.5;
  ctx.filter = 'blur(2px)';
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  cellSprite = new THREE.CanvasTexture(c);
  cellSprite.colorSpace = THREE.SRGBColorSpace;
  return cellSprite;
}

/* ------------------------------------------------------------------
   Scene lifecycle plumbing
   ------------------------------------------------------------------ */

const scenes = [];

/* Global scroll velocity (0..1-ish), eased — drives helix spin boost */
let scrollBoost = 0;
let lastScrollY = window.scrollY;
let lastScrollT = performance.now();
window.addEventListener(
  'scroll',
  () => {
    const now = performance.now();
    const dt = Math.max(16, now - lastScrollT);
    const v = Math.abs(window.scrollY - lastScrollY) / dt; // px per ms
    scrollBoost = Math.min(1, scrollBoost + v * 0.4);
    lastScrollY = window.scrollY;
    lastScrollT = now;
  },
  { passive: true }
);

/* Global cursor position, normalised -0.5..0.5 (window-level: canvases
   themselves stay pointer-events: none) */
const cursor = { x: 0, y: 0 };
if (finePointer) {
  window.addEventListener(
    'pointermove',
    (e) => {
      cursor.x = e.clientX / window.innerWidth - 0.5;
      cursor.y = e.clientY / window.innerHeight - 0.5;
    },
    { passive: true }
  );
}

function createScene(host, tick) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 8, 16);

  const camera = new THREE.PerspectiveCamera(42, (host.clientWidth || 1) / (host.clientHeight || 1), 0.1, 100);

  const record = { host, renderer, scene, camera, raf: null, visible: true, disposed: false };

  const frame = (t) => {
    scrollBoost = Math.max(0, scrollBoost - 0.012); // ease back to base
    tick(t, record);
    if (record.disposed) return; // tick may have torn the scene down (FPS guard)
    renderer.render(scene, camera);
    record.raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (record.raf === null && !record.disposed) record.raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (record.raf !== null) {
      cancelAnimationFrame(record.raf);
      record.raf = null;
    }
  };

  if (reduced) {
    // Single static frame, no loop — deferred one frame so the mount
    // function has added its meshes and positioned the camera first.
    requestAnimationFrame(() => {
      if (record.disposed) return;
      tick(0, record);
      renderer.render(scene, camera);
    });
  } else {
    new IntersectionObserver(
      ([entry]) => {
        record.visible = entry.isIntersecting;
        record.visible && !document.hidden ? start() : stop();
      },
      { threshold: 0.02 }
    ).observe(host);

    document.addEventListener('visibilitychange', () => {
      document.hidden || !record.visible ? stop() : start();
    });

    start();
  }

  window.addEventListener(
    'resize',
    () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h || record.disposed) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reduced) renderer.render(scene, camera);
    },
    { passive: true }
  );

  record.stop = stop;
  scenes.push(record);
  return record;
}

function disposeRecord(record) {
  if (record.disposed) return;
  record.disposed = true;
  record.stop();
  record.scene.traverse((obj) => {
    obj.geometry?.dispose?.();
    if (obj.material) {
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
    }
  });
  record.renderer.dispose();
  record.renderer.domElement.remove();
}

/* Dispose everything on navigation — no WebGL context leaks */
window.addEventListener('pagehide', () => {
  scenes.forEach(disposeRecord);
  glowSprite?.dispose();
  cellSprite?.dispose();
});

const lerp = (a, b, k) => a + (b - a) * k;

/* ------------------------------------------------------------------
   DNA helix
   ------------------------------------------------------------------ */

const HELIX_PRESETS = {
  ambient: {
    radius: 1.5,
    dotSizeA: 0.22,
    dotSizeB: 0.19,
    rungOpacity: 0.3,
    backboneOpacity: 0.32,
    tiltDeg: 8,
    bloom: false,
    proximity: false,
    dragRotate: false,
    fpsGuard: false,
  },
  showpiece: {
    radius: 2.05,
    dotSizeA: 0.33, // ~1.5× — thicker, more present
    dotSizeB: 0.28,
    rungOpacity: 0.45,
    backboneOpacity: 0.38,
    tiltDeg: 14,
    bloom: true,
    proximity: true, // fine pointers, desktop only
    dragRotate: true, // touch devices
    fpsGuard: true, // mobile: fall back to SVG if frames run slow
  },
};

function mountHelix(host) {
  const preset = HELIX_PRESETS[host.dataset.preset === 'showpiece' ? 'showpiece' : 'ambient'];
  const interactive = host.dataset.interactive === '1' && finePointer && !isMobile;
  const useProximity = preset.proximity && finePointer && !isMobile && !reduced;
  const useDrag = preset.dragRotate && (isMobile || !finePointer) && !reduced;
  const nodeCount = isMobile
    ? parseInt(host.dataset.mobileNodes || '40', 10)
    : parseInt(host.dataset.nodeCount || '70', 10);

  const TURNS = 3;
  const HEIGHT = 10;
  const RADIUS = preset.radius;

  const group = new THREE.Group();

  /* strand geometry + per-node base colors; local positions kept for the
     O(n) proximity pass */
  const strand = (phase, color) => {
    const pos = new Float32Array(nodeCount * 3);
    const col = new Float32Array(nodeCount * 3);
    const base = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const t = i / (nodeCount - 1);
      const a = t * Math.PI * 2 * TURNS + phase;
      pos[i * 3] = Math.cos(a) * RADIUS;
      pos[i * 3 + 1] = (t - 0.5) * HEIGHT;
      pos[i * 3 + 2] = Math.sin(a) * RADIUS;
      const c = color.clone().lerp(TEAL_DEEP, t * 0.25);
      base[i * 3] = c.r;
      base[i * 3 + 1] = c.g;
      base[i * 3 + 2] = c.b;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geo, base, pos, glow: new Float32Array(nodeCount) };
  };

  const A = strand(0, GOLD); // strand A — champagne gold
  const B = strand(Math.PI, TEAL); // strand B — bioluminescent teal

  const dotMat = (size, opacity = 1) =>
    new THREE.PointsMaterial({
      size,
      map: makeGlowSprite(),
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

  group.add(new THREE.Points(A.geo, dotMat(preset.dotSizeA)));
  group.add(new THREE.Points(B.geo, dotMat(preset.dotSizeB)));

  /* fake bloom — a second, larger, softer sprite pass sharing the same
     geometry (so it inherits breathing + proximity modulation for free) */
  if (preset.bloom) {
    group.add(new THREE.Points(A.geo, dotMat(preset.dotSizeA * 2.3, 0.22)));
    group.add(new THREE.Points(B.geo, dotMat(preset.dotSizeB * 2.3, 0.2)));
  }

  /* thin backbone lines along each strand */
  const lineMat = (opacity) =>
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending });
  group.add(new THREE.Line(A.geo.clone(), lineMat(preset.backboneOpacity)));
  group.add(new THREE.Line(B.geo.clone(), lineMat(preset.backboneOpacity - 0.04)));

  /* rung lines every few steps — gold/teal blend */
  const step = Math.max(2, Math.round(nodeCount / 22));
  const rungCount = Math.floor(nodeCount / step);
  const rungPos = new Float32Array(rungCount * 2 * 3);
  const rungCol = new Float32Array(rungCount * 2 * 3);
  for (let r = 0; r < rungCount; r++) {
    const i = r * step;
    const t = i / (nodeCount - 1);
    const a = t * Math.PI * 2 * TURNS;
    const y = (t - 0.5) * HEIGHT;
    rungPos.set([Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS, Math.cos(a + Math.PI) * RADIUS, y, Math.sin(a + Math.PI) * RADIUS], r * 6);
    rungCol.set([GOLD.r, GOLD.g, GOLD.b, TEAL.r, TEAL.g, TEAL.b], r * 6);
  }
  const rungGeo = new THREE.BufferGeometry();
  rungGeo.setAttribute('position', new THREE.BufferAttribute(rungPos, 3));
  rungGeo.setAttribute('color', new THREE.BufferAttribute(rungCol, 3));
  group.add(
    new THREE.LineSegments(
      rungGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: preset.rungOpacity,
        blending: THREE.AdditiveBlending,
      })
    )
  );

  /* diagnostic scan ring — a thin teal halo sweeping the strand like a
     sequencer read-head; nodes brighten as it passes (medical sci-fi) */
  const RING_SEG = 64;
  const ringPts = new Float32Array(RING_SEG * 3);
  for (let i = 0; i < RING_SEG; i++) {
    const a = (i / RING_SEG) * Math.PI * 2;
    ringPts[i * 3] = Math.cos(a) * RADIUS * 1.5;
    ringPts[i * 3 + 2] = Math.sin(a) * RADIUS * 1.5;
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPts, 3));
  const ringBaseOpacity = preset.bloom ? 0.42 : 0.22;
  const ringMat = new THREE.LineBasicMaterial({
    color: TEAL,
    transparent: true,
    opacity: ringBaseOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanRing = new THREE.LineLoop(ringGeo, ringMat);
  const echoMat = new THREE.LineBasicMaterial({
    color: TEAL_DEEP,
    transparent: true,
    opacity: ringBaseOpacity * 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanEcho = new THREE.LineLoop(ringGeo.clone(), echoMat);
  group.add(scanRing, scanEcho);
  const SCAN_SPAN = HEIGHT + 3;
  let scanY = 0;

  /* section-level cursor in canvas NDC — for the proximity glow */
  const localCursor = { x: 0, y: 0, active: false };
  if (useProximity) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        localCursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        localCursor.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
        localCursor.active =
          e.clientX > r.left - 120 && e.clientX < r.right + 120 && e.clientY > r.top - 120 && e.clientY < r.bottom + 120;
        fadeHint();
      },
      { passive: true }
    );
  }

  /* drag-to-rotate with momentum (touch) — listeners on the parent
     section, never the canvas */
  let spinOffset = 0;
  let spinVel = 0;
  if (useDrag) {
    const surface = host.closest('section') || host.parentElement || host;
    surface.style.touchAction = 'pan-y';
    let dragOn = false;
    let lastDragX = 0;
    surface.addEventListener(
      'pointerdown',
      (e) => {
        dragOn = true;
        lastDragX = e.clientX;
        spinVel = 0;
      },
      { passive: true }
    );
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!dragOn) return;
        const dx = e.clientX - lastDragX;
        lastDragX = e.clientX;
        spinOffset += dx * 0.006;
        spinVel = dx * 0.006;
        if (Math.abs(dx) > 3) fadeHint();
      },
      { passive: true }
    );
    const end = () => (dragOn = false);
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });
  }

  /* hint micro-copy — fade after first interaction */
  let hintFaded = false;
  function fadeHint() {
    if (hintFaded) return;
    hintFaded = true;
    host.closest('[data-helix-stage]')?.querySelector('[data-helix-hint]')?.classList.add('faded');
  }

  const rec = createScene(host, tick);
  rec.camera.position.set(0, 0, 9.5 + (preset.radius - 1.5) * 1.6);
  rec.scene.add(group);

  let tiltX = 0;
  let tiltY = 0;
  const MAX_TILT = (preset.tiltDeg * Math.PI) / 180;

  /* mobile FPS guard (showpiece): if sustained frames run slow, tear the
     scene down and let the SVG fallback take over with a slow CSS sway */
  const guard = preset.fpsGuard && isMobile && !reduced ? { frames: 0, slow: 0, done: false } : null;
  let lastFrameT = 0;

  const proxV = new THREE.Vector3();

  function tick(t) {
    const time = t * 0.001;

    if (guard && !guard.done && lastFrameT) {
      guard.frames++;
      if (t - lastFrameT > 33) guard.slow++;
      if (guard.frames >= 90) {
        guard.done = true;
        if (guard.slow / guard.frames > 0.5) {
          host.classList.remove('three-active');
          host.querySelector('.three-fallback')?.classList.add('svg-sway');
          disposeRecord(rec);
          return;
        }
      }
    }
    lastFrameT = t;

    /* one revolution every ~24s, +30% max with scroll velocity, plus any
       drag spin with decaying momentum */
    const speed = ((Math.PI * 2) / 24) * (1 + 0.3 * Math.min(1, scrollBoost));
    if (Math.abs(spinVel) > 0.0004) {
      spinOffset += spinVel * 16;
      spinVel *= 0.95;
    }
    group.rotation.y = time * speed + spinOffset;

    /* cursor tilt (weighted lerp) or gentle touch-device sway */
    if (interactive) {
      tiltX = lerp(tiltX, cursor.y * 2 * MAX_TILT, 0.05);
      tiltY = lerp(tiltY, cursor.x * 2 * MAX_TILT, 0.05);
    } else {
      tiltX = Math.sin(time * 0.22) * MAX_TILT * 0.45;
      tiltY = Math.cos(time * 0.17) * MAX_TILT * 0.45;
    }
    group.rotation.x = tiltX;
    group.rotation.z = 0.08 + tiltY * 0.5;

    group.updateMatrixWorld();

    /* scan sweep — bottom to top, looping; opacity gently pulses */
    scanY = reduced ? 0 : ((time * 1.15) % SCAN_SPAN) - SCAN_SPAN / 2;
    scanRing.position.y = scanY;
    scanEcho.position.y = scanY - 0.5;
    ringMat.opacity = ringBaseOpacity * (0.7 + 0.3 * Math.sin(time * 2.6));

    /* per-node brightness: idle breathing (±10%, phase travelling up the
       strand) × cursor-proximity glow (O(n) projected-distance check) */
    for (const s of [A, B]) {
      const col = s.geo.getAttribute('color');
      for (let i = 0; i < nodeCount; i++) {
        let target = 0;
        if (useProximity && localCursor.active) {
          proxV.set(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
          proxV.applyMatrix4(group.matrixWorld).project(rec.camera);
          const dx = proxV.x - localCursor.x;
          const dy = proxV.y - localCursor.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          target = Math.max(0, 1 - d / 0.32);
        }
        /* eased glow value — liquid, never snappy */
        s.glow[i] = lerp(s.glow[i], target, 0.1);

        const pulse = 1 + 0.1 * Math.sin(time * 1.4 + (i / nodeCount) * Math.PI * 4);
        const wave = useDrag ? 1 + 0.12 * Math.sin(time * 0.9 - (i / nodeCount) * Math.PI * 2) : 1;
        const dyScan = s.pos[i * 3 + 1] - scanY;
        const scanBoost = Math.exp(-dyScan * dyScan * 2.4);
        const b = pulse * wave * (1 + 0.32 * s.glow[i] + 0.5 * scanBoost);
        col.array[i * 3] = s.base[i * 3] * b;
        col.array[i * 3 + 1] = s.base[i * 3 + 1] * b;
        col.array[i * 3 + 2] = s.base[i * 3 + 2] * b;
      }
      col.needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------------
   Stem-cell particle field
   ------------------------------------------------------------------ */

function mountCells(host) {
  const COUNT = isMobile ? 80 : parseInt(host.dataset.count || '200', 10);
  const SIZE = parseFloat(host.dataset.size || '0.3');
  const SPREAD = { x: 16, y: 8, z: 7 };

  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = (Math.random() - 0.5) * SPREAD.x;
    base[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
    base[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.15 + Math.random() * 0.45;
    const c = Math.random() < 0.18 ? GOLD : TEAL.clone().lerp(TEAL_DEEP, Math.random() * 0.6);
    col.set([c.r, c.g, c.b], i * 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: SIZE,
      map: makeGlowSprite(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );

  /* a few larger, fainter cell sprites drifting among the points */
  const BIG = isMobile ? 4 : 8;
  const bigBase = new Float32Array(BIG * 3);
  const bigPos = new Float32Array(BIG * 3);
  const bigCol = new Float32Array(BIG * 3);
  const bigPhase = new Float32Array(BIG);
  for (let i = 0; i < BIG; i++) {
    bigBase[i * 3] = (Math.random() - 0.5) * SPREAD.x * 0.85;
    bigBase[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y * 0.85;
    bigBase[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z * 0.6;
    bigPhase[i] = Math.random() * Math.PI * 2;
    const c = (i % 3 === 0 ? GOLD : TEAL).clone();
    bigCol.set([c.r, c.g, c.b], i * 3);
  }
  const bigGeo = new THREE.BufferGeometry();
  bigGeo.setAttribute('position', new THREE.BufferAttribute(bigPos, 3));
  bigGeo.setAttribute('color', new THREE.BufferAttribute(bigCol, 3));
  const bigPoints = new THREE.Points(
    bigGeo,
    new THREE.PointsMaterial({
      size: SIZE * 5.6,
      map: makeCellSprite(),
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );

  const group = new THREE.Group();
  group.add(points, bigPoints);

  /* molecular plexus — faint teal filaments linking nearby cells; the
     classic sci-fi "living tissue network" read (desktop only) */
  const LINK_N = isMobile ? 0 : Math.min(COUNT, 90);
  const MAX_LINKS = 160;
  const LINK_D2 = 2.1 * 2.1;
  let linkGeo = null;
  if (LINK_N) {
    linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 6), 3));
    linkGeo.setDrawRange(0, 0);
    group.add(
      new THREE.LineSegments(
        linkGeo,
        new THREE.LineBasicMaterial({
          color: TEAL,
          transparent: true,
          opacity: 0.13,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    );
  }
  let frameCount = 0;

  const rec = createScene(host, tick);
  rec.camera.fov = 55;
  rec.camera.updateProjectionMatrix();
  rec.camera.position.z = 10;
  rec.scene.add(group);

  let px = 0;
  let py = 0;

  function tick(t) {
    const time = t * 0.001;

    const attr = geo.getAttribute('position');
    for (let i = 0; i < COUNT; i++) {
      const p = phase[i];
      const s = speed[i];
      attr.array[i * 3] = base[i * 3] + Math.sin(time * s + p) * 0.9;
      attr.array[i * 3 + 1] = base[i * 3 + 1] + Math.cos(time * s * 0.8 + p * 1.7) * 0.6;
      attr.array[i * 3 + 2] = base[i * 3 + 2] + Math.sin(time * s * 0.6 + p * 0.9) * 0.5;
    }
    attr.needsUpdate = true;

    /* rebuild plexus links every other frame — O(n²) over 90 points */
    if (LINK_N && (frameCount++ & 1) === 0) {
      const lp = linkGeo.getAttribute('position');
      let n = 0;
      outer: for (let i = 0; i < LINK_N; i++) {
        for (let j = i + 1; j < LINK_N; j++) {
          const dx = attr.array[i * 3] - attr.array[j * 3];
          const dy = attr.array[i * 3 + 1] - attr.array[j * 3 + 1];
          const dz = attr.array[i * 3 + 2] - attr.array[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < LINK_D2) {
            lp.array[n * 6] = attr.array[i * 3];
            lp.array[n * 6 + 1] = attr.array[i * 3 + 1];
            lp.array[n * 6 + 2] = attr.array[i * 3 + 2];
            lp.array[n * 6 + 3] = attr.array[j * 3];
            lp.array[n * 6 + 4] = attr.array[j * 3 + 1];
            lp.array[n * 6 + 5] = attr.array[j * 3 + 2];
            if (++n >= MAX_LINKS) break outer;
          }
        }
      }
      linkGeo.setDrawRange(0, n * 2);
      lp.needsUpdate = true;
    }

    const bigAttr = bigGeo.getAttribute('position');
    for (let i = 0; i < BIG; i++) {
      const p = bigPhase[i];
      bigAttr.array[i * 3] = bigBase[i * 3] + Math.sin(time * 0.12 + p) * 1.1;
      bigAttr.array[i * 3 + 1] = bigBase[i * 3 + 1] + Math.cos(time * 0.1 + p * 1.4) * 0.7;
      bigAttr.array[i * 3 + 2] = bigBase[i * 3 + 2] + Math.sin(time * 0.08 + p) * 0.4;
    }
    bigAttr.needsUpdate = true;

    /* very subtle mouse parallax — whole field shifts a few px, lerped */
    px = lerp(px, cursor.x * 0.6, 0.04);
    py = lerp(py, -cursor.y * 0.4, 0.04);
    group.position.x = px;
    group.position.y = py;
  }
}

/* ------------------------------------------------------------------
   Hero helix — a DNA double helix rendered as a precision technical
   instrument, not an atmosphere. Crisp 1px hairline strands + base-pair
   rungs + sharp node dots, depth read purely by opacity, mostly empty
   black around one composed object in the negative space between the
   headline and the portrait.

   Deliberately a DIFFERENT treatment from the glowing 3D DnaHelix in the
   science section — this is instrument-grade wireframe. The cursor is a
   transcription read-head that locally unwinds the strands (never a burst).
   Palette: bright champagne gold + pale platinum on obsidian. No new tokens.
   ------------------------------------------------------------------ */

const HX_VERT = /* glsl */ `
  uniform float uReadY;
  uniform float uSep;
  varying float vDepth;
  varying float vBand;
  void main() {
    vec3 tp = position;
    float band = exp(-pow((position.y - uReadY) * 0.8, 2.0));
    float rl = length(position.xz);
    if (rl > 0.0001) tp.xz += (position.xz / rl) * band * uSep;  // strands unwind at the read-head
    vBand = band;
    vec4 mv = modelViewMatrix * vec4(tp, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const HX_LINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uNear;
  uniform float uFar;
  varying float vDepth;
  varying float vBand;
  void main() {
    float f = smoothstep(uFar, uNear, vDepth);       // near = bright, far = dim
    float a = uAlpha * mix(0.3, 1.0, f);
    a *= 1.0 + vBand * 0.6;                            // brighten inside the read-head band
    gl_FragColor = vec4(uColor, a);
  }
`;

const HX_NODE_VERT = /* glsl */ `
  uniform float uReadY;
  uniform float uSep;
  uniform float uDpr;
  uniform float uSize;
  varying float vDepth;
  varying float vBand;
  void main() {
    vec3 tp = position;
    float band = exp(-pow((position.y - uReadY) * 0.8, 2.0));
    float rl = length(position.xz);
    if (rl > 0.0001) tp.xz += (position.xz / rl) * band * uSep;
    vBand = band;
    vec4 mv = modelViewMatrix * vec4(tp, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uDpr * (1.0 + vBand * 0.9);
  }
`;

const HX_NODE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uNear;
  uniform float uFar;
  varying float vDepth;
  varying float vBand;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float aa = fwidth(d);
    float m = 1.0 - smoothstep(0.5 - aa, 0.5, d);      // crisp disc, anti-aliased
    if (m <= 0.0) discard;
    float f = smoothstep(uFar, uNear, vDepth);
    float a = m * mix(0.4, 1.0, f) * (0.7 + vBand * 0.7);
    gl_FragColor = vec4(uColor, a);
  }
`;

function cssColorHex(name, fallback) {
  const raw = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
  return new THREE.Color(raw);
}

function mountTissue(host) {
  const SEG = isMobile ? 360 : 560;
  const TURNS = 5;
  const H = 16.0;
  const R = 1.3;
  const CAM_Z = 9.0;

  const GOLDL = cssColorHex('--color-goldlight', '#e3c992'); // bright champagne — primary strand
  const CREAM = cssColorHex('--color-cream', '#f4f1ec'); // platinum — rungs / nodes

  /* strand hairline curve (SEG+1 points) */
  const strandGeo = (phase) => {
    const pos = new Float32Array((SEG + 1) * 3);
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const a = t * Math.PI * 2 * TURNS + phase;
      pos[i * 3] = Math.cos(a) * R;
      pos[i * 3 + 1] = (t - 0.5) * H;
      pos[i * 3 + 2] = Math.sin(a) * R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  };

  /* base-pair rungs at regular intervals + node dots at each terminal */
  const rungStep = Math.max(4, Math.round(SEG / (TURNS * 11)));
  const rn = Math.floor(SEG / rungStep) + 1;
  const rpos = new Float32Array(rn * 2 * 3);
  const npos = new Float32Array(rn * 2 * 3);
  let ri = 0;
  for (let r = 0; r <= SEG; r += rungStep) {
    const t = r / SEG;
    const a = t * Math.PI * 2 * TURNS;
    const y = (t - 0.5) * H;
    const ax = Math.cos(a) * R, az = Math.sin(a) * R;
    const bx = Math.cos(a + Math.PI) * R, bz = Math.sin(a + Math.PI) * R;
    rpos.set([ax, y, az, bx, y, bz], ri * 6);
    npos.set([ax, y, az, bx, y, bz], ri * 6);
    ri++;
  }
  const rungGeo = new THREE.BufferGeometry();
  rungGeo.setAttribute('position', new THREE.BufferAttribute(rpos.subarray(0, ri * 6), 3));
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(npos.subarray(0, ri * 6), 3));

  const NEAR = CAM_Z - R - 0.7;
  const FAR = CAM_Z + R + 0.7;
  const dynMats = [];

  const lineMat = (color, alpha) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: HX_VERT,
      fragmentShader: HX_LINE_FRAG,
      uniforms: {
        uReadY: { value: 0 },
        uSep: { value: 0 },
        uColor: { value: color },
        uAlpha: { value: alpha },
        uNear: { value: NEAR },
        uFar: { value: FAR },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    dynMats.push(m);
    return m;
  };

  const nodeMat = new THREE.ShaderMaterial({
    vertexShader: HX_NODE_VERT,
    fragmentShader: HX_NODE_FRAG,
    uniforms: {
      uReadY: { value: 0 },
      uSep: { value: 0 },
      uDpr: { value: 1 },
      uSize: { value: 2.4 },
      uColor: { value: CREAM },
      uNear: { value: NEAR },
      uFar: { value: FAR },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  dynMats.push(nodeMat);

  const group = new THREE.Group();
  group.add(new THREE.Line(strandGeo(0), lineMat(GOLDL, 1.0)));          // primary strand
  group.add(new THREE.Line(strandGeo(Math.PI), lineMat(GOLDL, 0.5)));   // secondary strand @50%
  group.add(new THREE.LineSegments(rungGeo, lineMat(CREAM, 0.32)));      // pale rungs
  group.add(new THREE.Points(nodeGeo, nodeMat));                        // sharp node dots
  group.position.x = 1.7; // sit in the gap between headline and portrait

  const hero = host.closest('section') || host.parentElement || host;
  const readhead = host.closest('[data-tissue]')?.querySelector('[data-readhead]');

  /* transcription read-head — follows the cursor, heavily damped, over the
     helix band only. Desktop fine-pointer only. */
  let active = 0;
  let readYTarget = 0;
  let readClientTop = 0;
  if (finePointer && !isMobile && !reduced) {
    const visHalf = Math.tan((42 * Math.PI) / 180 / 2) * CAM_Z;
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = (e.clientX - r.left) / r.width;
        const ny = 1 - (e.clientY - r.top) / r.height;
        active = nx > 0.46 && nx < 0.84 && ny > -0.1 && ny < 1.1 ? 1 : 0;
        readYTarget = camY + (ny - 0.5) * 2 * visHalf;
        readClientTop = e.clientY - r.top;
      },
      { passive: true }
    );
  }

  const boot = { v: 0 };
  if (!reduced) {
    host.closest('[data-tissue]')?.classList.add('tissue-booting');
    gsap.to(boot, { v: 1, duration: 1.4, ease: 'power2.out' });
  }

  const rec = createScene(host, tick);
  rec.camera.position.set(0, 0, CAM_Z);
  rec.scene.add(group);

  const syncSize = () => {
    if (rec.disposed) return;
    rec.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    rec.renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    nodeMat.uniforms.uDpr.value = rec.renderer.getPixelRatio();
    if (reduced) rec.renderer.render(rec.scene, rec.camera);
  };
  window.addEventListener('resize', syncSize, { passive: true });
  syncSize();

  let sep = 0;
  let readY = 0;
  let camY = 0;
  let tiltX = 0;
  let tiltZ = 0;
  const baseSpeed = (Math.PI * 2) / (isMobile ? 60 : 48); // one revolution ~48–60s

  function tick(t) {
    const time = t * 0.001;

    /* slow weighted rotation, gently accelerated by scroll velocity */
    const spin = baseSpeed * (1 + 0.6 * Math.min(1, scrollBoost));
    group.rotation.y = reduced ? 0.6 : time * spin;

    /* pointer parallax — a few degrees, heavily damped */
    if (!reduced && finePointer && !isMobile) {
      tiltX = lerp(tiltX, cursor.y * 0.12, 0.04);
      tiltZ = lerp(tiltZ, cursor.x * 0.06, 0.04);
    }
    group.rotation.x = tiltX;
    group.rotation.z = tiltZ;

    /* scroll travels the camera down the molecule */
    if (!reduced) {
      const prog = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / Math.max(1, host.clientHeight || 1)));
      camY = lerp(camY, (0.5 - prog) * 5.0, 0.08);
    }
    rec.camera.position.y = camY;

    /* read-head separation — damped in and out */
    sep = lerp(sep, active ? 0.62 : 0, active ? 0.12 : 0.08);
    readY = lerp(readY, readYTarget, 0.12);
    const bootSep = (1 - Math.abs(boot.v * 2 - 1)) * 0.0; // (boot handled by opacity, keep sep from cursor only)
    for (const m of dynMats) {
      m.uniforms.uReadY.value = readY;
      m.uniforms.uSep.value = sep + bootSep;
    }

    /* boot: strands fade/ignite in */
    const bootA = reduced ? 1 : boot.v;
    group.children[0].material.uniforms.uAlpha.value = 1.0 * bootA;
    group.children[1].material.uniforms.uAlpha.value = 0.62 * bootA;
    group.children[2].material.uniforms.uAlpha.value = 0.55 * bootA; // rungs — the ladder that reads as DNA

    /* DOM read-head bracket follows the cursor while over the helix */
    if (readhead && !reduced) {
      if (sep > 0.02) {
        readhead.style.opacity = String(Math.min(1, sep / 0.5));
        readhead.style.transform = `translateY(${readClientTop}px)`;
      } else {
        readhead.style.opacity = '0';
      }
    }
  }
}

/* ------------------------------------------------------------------ */

export function initThree() {
  document.querySelectorAll('[data-three]').forEach((host) => {
    if (host.dataset.threeMounted) return;
    /* hero-style hosts keep their static SVG on mobile */
    if (isMobile && host.dataset.mobile === 'svg') return;
    try {
      if (host.dataset.three === 'helix') mountHelix(host);
      else if (host.dataset.three === 'cells') mountCells(host);
      else if (host.dataset.three === 'tissue') mountTissue(host);
      host.dataset.threeMounted = '1';
      host.classList.add('three-active');
    } catch {
      /* WebGL unavailable — the SVG fallback stays visible */
    }
  });
}
