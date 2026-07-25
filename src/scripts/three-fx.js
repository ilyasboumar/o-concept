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
   "Living tissue under a diagnostic instrument" — a distinct
   full-viewport fragment-shader plane behind the hero. Not the helix,
   not the THREE.Points cell field.

   Biology is TEAL, the instrument is GOLD, the void is obsidian — a
   hard separation. The shader owns the teal biology (Voronoi tissue
   substrate over depth planes with focus-racking, an acquisition
   sweep that resolves tissue, occasional mitosis blooms, a cursor
   "probe lens" that magnifies and reveals sub-cellular detail) and
   the single gold element that must track the moving probe (its lens
   rim). The crisp gold instrument furniture (graticule, reticle,
   calibration scale, readout) is a separate DOM overlay in
   TissueField.astro. Palette comes from the site's CSS vars.
   ------------------------------------------------------------------ */

const TISSUE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const TISSUE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uDpr;
  uniform float uReducedMotion;
  uniform float uIntensity;

  uniform vec2  uLensPos;      // uv, lerped — trails the cursor
  uniform float uLensActive;
  uniform float uLensR;        // lens radius (aspect-corrected units)
  uniform float uLensVel;      // pointer speed → fluid wake

  uniform float uScrollProg;   // 0..1 through the hero — parallax
  uniform float uFocusDepth;   // 0..1 — which depth plane is sharp
  uniform float uSweepY;       // acquisition sweep position
  uniform float uSweepBoost;   // sweep strength (boot vs scroll)
  uniform float uScrollBoost;  // scroll velocity → mitosis cascades
  uniform float uBoot;         // 0..1 boot ignition front

  uniform vec2  uHeadCenter;   // headline quieting mask
  uniform vec2  uHeadRadius;
  uniform vec2  uPortCenter;   // portrait exclusion + rim glow
  uniform vec2  uPortHalf;
  uniform vec2  uCtaCenter;    // CTA regeneration ripple
  uniform float uCtaPulse;

  uniform vec3  uColorBase;
  uniform vec3  uColorTeal;
  uniform vec3  uColorCyan;
  uniform vec3  uColorGold;

  float hash1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  /* Voronoi → (F1, F2, cellRandom). Feature points drift on a slow
     phase so the tissue flexes without dissolving. */
  vec3 voronoi(vec2 x, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float f1 = 8.0, f2 = 8.0, cr = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 h = hash2(n + g);
        vec2 o = 0.5 + 0.35 * sin(t * 0.6 + 6.2831 * h);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; cr = hash1(n + g); }
        else if (d < f2) { f2 = d; }
      }
    }
    return vec3(sqrt(f1), sqrt(f2), cr);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(1.0, uResolution.y);
    float T = uReducedMotion > 0.5 ? 4.0 : uTime;
    float anim = 1.0 - uReducedMotion;

    /* gentle domain warp — keeps structure legible */
    vec2 wp = vec2(uv.x * aspect, uv.y) * 2.0;
    vec2 warp = (vec2(vnoise(wp + T * 0.05), vnoise(wp + 11.0 - T * 0.05)) - 0.5) * 0.22 * (0.55 + 0.45 * anim);

    /* probe lens — magnify by pulling sample coords toward the lens */
    vec2 uvM = uv;
    float lensMask = 0.0;
    if (uLensActive > 0.5) {
      vec2 tol = uv - uLensPos;
      float ldc = length(tol * vec2(aspect, 1.0));
      float m = 1.0 - smoothstep(uLensR * 0.55, uLensR, ldc);
      uvM = uv - tol * m * 0.55;
      lensMask = m;
      warp += tol * uLensVel * 0.14 * m; // velocity wake
    }

    /* CTA regeneration ripple folded into the flow */
    {
      vec2 tc = (uv - uCtaCenter) * vec2(aspect, 1.0);
      float cd = length(tc);
      float rip = uCtaPulse * exp(-cd * 3.5) * sin(cd * 26.0 - T * 6.0);
      warp += normalize(tc + 1e-4) * rip * 0.03;
    }

    vec2 p = vec2(uvM.x * aspect, uvM.y);

    /* Layer 1 + 2 — multi-scale Voronoi tissue across depth planes,
       each racked in/out of focus by uFocusDepth */
    float tissue = 0.0, nucleus = 0.0;
    for (int k = 0; k < PLANES; k++) {
      float fk = float(k);
      float depth = float(PLANES) > 1.0 ? fk / float(PLANES - 1) : 0.0;
      float scale = mix(3.5, 9.0, depth);
      vec2 par = warp + vec2(T * 0.012 * (0.3 + 0.2 * fk) * anim, -uScrollProg * (0.15 + 0.28 * fk));
      vec3 vor = voronoi(p * scale + par * scale, T * anim);
      float f1 = vor.x, f2 = vor.y, cid = vor.z;
      float focus = 1.0 - smoothstep(0.0, 0.55, abs(depth - uFocusDepth));
      float memW = mix(0.16, 0.028, focus);
      float mem = 1.0 - smoothstep(0.0, memW, f2 - f1);
      float pulse = 0.55 + 0.45 * sin(T * 0.8 + cid * 18.8) * anim + 0.45 * (1.0 - anim);
      float nuc = exp(-f1 * f1 * mix(26.0, 90.0, focus)) * pulse;
      float planeAtt = mix(1.0, 0.4, depth);
      float sharp = mix(0.45, 1.0, focus);
      tissue += mem * planeAtt * sharp;
      nucleus += nuc * planeAtt * sharp;
    }
    tissue *= 0.55;

    /* lens reveals a finer octave that doesn't exist outside it */
    if (uLensActive > 0.5 && lensMask > 0.001) {
      vec3 fine = voronoi(p * 16.0 + warp * 3.0, T * anim);
      float fmem = 1.0 - smoothstep(0.0, 0.045, fine.y - fine.x);
      float fnuc = exp(-fine.x * fine.x * 110.0);
      tissue += fmem * lensMask * 1.0;
      nucleus += fnuc * lensMask * 2.0;
      tissue *= 1.0 + lensMask * 0.6;  // membranes sharpen + brighten under the probe
      nucleus *= 1.0 + lensMask * 1.0;
    }

    /* Layer 4 — acquisition sweep: resolves tissue under the bar and
       leaves a fading "captured" trail behind it */
    float barY = 1.0 - uSweepY;
    float band = exp(-pow(uv.y - barY, 2.0) * 1100.0);
    float trailD = uv.y - barY;
    float trail = trailD > 0.0 ? exp(-trailD * 7.0) : 0.0;
    float acq = (band + trail * 0.55) * uSweepBoost * anim;
    tissue *= 1.0 + acq * 1.2;
    nucleus *= 1.0 + acq * 2.4;

    /* Layer 5 — mitosis: rare per-cell blooms, cascaded by scroll */
    float mit = 0.0;
    if (anim > 0.5) {
      vec3 mc = voronoi(p * 5.0 + 13.0, T * 0.4);
      float phase = fract(T * 0.11 + mc.z * 9.0);
      float flash = exp(-phase * phase * 300.0);
      float atCenter = exp(-mc.x * mc.x * 40.0);
      mit = flash * atCenter * (0.6 + 1.2 * uScrollBoost);
    }

    /* ---- compose biology (teal only) ---- */
    vec3 col = uColorBase;
    vec3 memCol = mix(uColorTeal, uColorCyan, 0.25);
    col += memCol * tissue * uIntensity;
    col += mix(uColorCyan, uColorTeal, 0.4) * nucleus * 0.95 * uIntensity;
    col += uColorTeal * mit * 1.4;
    col += uColorCyan * band * uSweepBoost * 0.5 * anim;
    float lead = uv.y - (barY - 0.006);
    float chroma = exp(-lead * lead * 3000.0) * uSweepBoost * anim;
    col.r += chroma * 0.10;
    col.b += chroma * 0.16;

    /* ---- anchoring to the layout ---- */
    /* headline quieting mask — legibility as a designed feature */
    vec2 hd = (uv - uHeadCenter) / max(uHeadRadius, vec2(0.001));
    float quiet = 1.0 - smoothstep(0.75, 1.25, length(hd));
    col = mix(col, uColorBase + (col - uColorBase) * 0.28, quiet);

    /* portrait exclusion + teal rim glow onto the edge */
    {
      vec2 d = abs(uv - uPortCenter) - uPortHalf;
      float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      float excl = 1.0 - smoothstep(0.0, 0.05, sd);
      col = mix(col, uColorBase, excl * 0.85);
      float rim = exp(-abs(sd) * 55.0) * smoothstep(-0.008, 0.012, sd);
      col += uColorTeal * rim * 0.7;
    }

    /* CTA ripple ring */
    {
      float cd = length((uv - uCtaCenter) * vec2(aspect, 1.0));
      float ring = uCtaPulse * exp(-pow(cd - (1.0 - uCtaPulse) * 0.4, 2.0) * 70.0);
      col += uColorCyan * ring * 0.6;
    }

    /* boot ignition — spreads outward from beneath the headline */
    float bd = length((uv - uHeadCenter) * vec2(aspect, 1.0));
    float bootFront = uBoot * 1.9;
    float bootMask = 1.0 - smoothstep(bootFront - 0.28, bootFront, bd);
    col = mix(uColorBase, col, bootMask);

    /* the one gold biology-side element: the probe's lens rim (it must
       track the moving lens, so it lives here rather than in the DOM
       instrument overlay) — thin ring + tick marks + rim chroma */
    if (uLensActive > 0.5) {
      float ld = length((uv - uLensPos) * vec2(aspect, 1.0));
      float rimRing = exp(-pow(ld - uLensR, 2.0) * 1500.0);
      float ang = atan(uv.y - uLensPos.y, (uv.x - uLensPos.x) * aspect);
      float ticks = smoothstep(0.6, 1.0, abs(sin(ang * 36.0)));
      col += uColorGold * rimRing * (0.7 + 0.5 * ticks);
      float ca = exp(-pow(ld - uLensR * 0.96, 2.0) * 1200.0) * lensMask;
      col.r += ca * 0.12;
      col.b += ca * 0.10;
    }

    /* vignette + film grain */
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0) * 1.15));
    col *= mix(0.5, 1.0, vig);
    float grain = (hash1(uv * uResolution.xy * 0.5 + T) - 0.5) * 0.035;
    col += grain * (uReducedMotion > 0.5 ? 0.5 : 1.0);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

/* read a hex CSS custom property into an sRGB vec3 (written straight to
   the framebuffer, so no colour-management conversion is wanted) */
function cssColorVec(name, fallback) {
  const raw = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
  let h = raw.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function mountTissue(host) {
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
    uReducedMotion: { value: reduced ? 1 : 0 },
    uIntensity: { value: 1.15 },
    uLensPos: { value: new THREE.Vector2(0.5, 0.5) },
    uLensActive: { value: 0 },
    uLensR: { value: 0.17 },
    uLensVel: { value: 0 },
    uScrollProg: { value: 0 },
    uFocusDepth: { value: 0.2 },
    uSweepY: { value: 0 },
    uSweepBoost: { value: 1 },
    uScrollBoost: { value: 0 },
    uBoot: { value: reduced ? 1 : 0 },
    uHeadCenter: { value: new THREE.Vector2(0.32, 0.6) },
    uHeadRadius: { value: new THREE.Vector2(0.32, 0.24) },
    uPortCenter: { value: new THREE.Vector2(0.82, 0.52) },
    uPortHalf: { value: new THREE.Vector2(0.12, 0.24) },
    uCtaCenter: { value: new THREE.Vector2(0.26, 0.2) },
    uCtaPulse: { value: 0 },
    uColorBase: { value: cssColorVec('--color-ink', '#0a0a0b') },
    uColorTeal: { value: cssColorVec('--color-teal', '#2dd4bf') },
    uColorCyan: { value: cssColorVec('--color-tealdeep', '#0ea5e9') },
    uColorGold: { value: cssColorVec('--color-gold', '#c9a96e') },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: TISSUE_VERT,
    fragmentShader: TISSUE_FRAG,
    uniforms,
    defines: { PLANES: isMobile ? 2 : 3 },
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);

  const hero = host.closest('section') || host.parentElement || host;
  const headEl = hero.querySelector('[data-hero-headline]');
  const portEl = hero.querySelector('[data-hero-portrait]');
  const ctaEl = hero.querySelector('[data-hero-cta]');

  /* probe lens — window pointermove (canvas stays pointer-events:none),
     lerped so the lens trails the cursor with weight; velocity feeds the
     fluid wake. Desktop fine-pointer only. */
  const lensTarget = new THREE.Vector2(0.5, 0.5);
  const lens = new THREE.Vector2(0.5, 0.5);
  let lensActive = 0;
  let lensVel = 0;
  let lastPx = 0.5, lastPy = 0.5;
  if (finePointer && !isMobile && !reduced) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = (e.clientX - r.left) / r.width;
        const ny = 1 - (e.clientY - r.top) / r.height;
        lensVel = Math.min(1, lensVel + Math.hypot(nx - lastPx, ny - lastPy) * 3.0);
        lastPx = nx;
        lastPy = ny;
        lensActive = nx > -0.15 && nx < 1.15 && ny > -0.15 && ny < 1.15 ? 1 : 0;
        lensTarget.set(nx, ny);
      },
      { passive: true }
    );
  }

  /* CTA hover → regeneration ripple */
  let ctaPulse = 0;
  if (ctaEl && !reduced) {
    ctaEl.querySelectorAll('a, button').forEach((b) => {
      b.addEventListener('mouseenter', () => (ctaPulse = 1));
    });
  }

  /* boot — instrument furniture powers on (DOM/CSS), the sweep sweeps,
     tissue ignites in its wake; then scroll takes over the sweep+focus */
  let booting = !reduced;
  const boot = { v: 0 };
  const sweep = { v: 0 };
  if (!reduced) {
    const stage = host.closest('[data-tissue]');
    stage?.classList.add('tissue-booting');
    const tl = gsap.timeline();
    tl.to(boot, { v: 1, duration: 1.4, ease: 'power2.out' }, 0);
    tl.to(sweep, { v: 1, duration: 1.5, ease: 'power2.inOut', onComplete: () => (booting = false) }, 0.2);
  }

  const rec = createScene(host, tick);
  rec.scene.add(mesh);

  const tmp = new THREE.Vector2();
  const syncSize = () => {
    if (rec.disposed) return;
    rec.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    rec.renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    rec.renderer.getDrawingBufferSize(tmp);
    uniforms.uResolution.value.set(tmp.x, tmp.y);
    uniforms.uDpr.value = rec.renderer.getPixelRatio();
    if (reduced) rec.renderer.render(rec.scene, rec.camera);
  };
  window.addEventListener('resize', syncSize, { passive: true });
  syncSize();

  /* map a DOM element's rect into host-relative uv (y up) */
  const anchor = (el, hostR, cOut, hOut) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!hostR.width || !hostR.height) return;
    cOut.set((r.left + r.width / 2 - hostR.left) / hostR.width, 1 - (r.top + r.height / 2 - hostR.top) / hostR.height);
    hOut.set(r.width / 2 / hostR.width, r.height / 2 / hostR.height);
  };

  const headHalf = new THREE.Vector2();

  function tick(t) {
    uniforms.uTime.value = t * 0.001;
    uniforms.uScrollBoost.value = Math.min(1, scrollBoost);

    /* re-anchor each frame — robust to scroll, resize, font/image reflow */
    const hostR = host.getBoundingClientRect();
    anchor(headEl, hostR, uniforms.uHeadCenter.value, headHalf);
    if (headEl) uniforms.uHeadRadius.value.set(headHalf.x * 1.15, headHalf.y * 1.4);
    anchor(portEl, hostR, uniforms.uPortCenter.value, uniforms.uPortHalf.value);
    if (ctaEl) {
      const r = ctaEl.getBoundingClientRect();
      uniforms.uCtaCenter.value.set(
        (r.left + r.width / 2 - hostR.left) / hostR.width,
        1 - (r.top + r.height / 2 - hostR.top) / hostR.height
      );
    }

    /* probe lens */
    if (lensActive || uniforms.uLensActive.value) {
      lens.lerp(lensTarget, 0.12);
      uniforms.uLensPos.value.copy(lens);
    }
    uniforms.uLensActive.value = lensActive;
    lensVel *= 0.9;
    uniforms.uLensVel.value = lensVel;

    /* CTA pulse decay */
    ctaPulse *= 0.96;
    uniforms.uCtaPulse.value = ctaPulse;

    if (reduced) {
      uniforms.uSweepY.value = -1;
      uniforms.uSweepBoost.value = 0;
      uniforms.uFocusDepth.value = 0.3;
      uniforms.uBoot.value = 1;
      return;
    }

    uniforms.uBoot.value = boot.v;
    const prog = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / Math.max(1, hostR.height)));
    uniforms.uScrollProg.value = prog;

    if (booting) {
      uniforms.uSweepY.value = sweep.v;
      uniforms.uSweepBoost.value = 1;
      uniforms.uFocusDepth.value = 0.05 + boot.v * 0.3; // racks to default depth
    } else {
      uniforms.uSweepY.value = -0.05 + prog * 1.15; // scroll drives the sweep
      uniforms.uSweepBoost.value = 0.5;
      uniforms.uFocusDepth.value = 0.12 + prog * 0.72; // fine-focus wheel
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
