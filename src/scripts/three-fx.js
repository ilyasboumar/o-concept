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
        const b = pulse * wave * (1 + 0.32 * s.glow[i]);
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

/* ------------------------------------------------------------------ */

export function initThree() {
  document.querySelectorAll('[data-three]').forEach((host) => {
    if (host.dataset.threeMounted) return;
    /* hero-style hosts keep their static SVG on mobile */
    if (isMobile && host.dataset.mobile === 'svg') return;
    try {
      if (host.dataset.three === 'helix') mountHelix(host);
      else if (host.dataset.three === 'cells') mountCells(host);
      host.dataset.threeMounted = '1';
      host.classList.add('three-active');
    } catch {
      /* WebGL unavailable — the SVG fallback stays visible */
    }
  });
}
