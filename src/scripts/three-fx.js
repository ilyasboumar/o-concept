/**
 * Three.js moments — lazily imported from main.js only on desktop,
 * WebGL-capable, motion-tolerant sessions. Each mount is deliberately
 * lightweight: points + lines (no heavy meshes), capped pixel ratio,
 * and rendering pauses whenever the host scrolls offscreen or the tab
 * is hidden. The static SVG fallback beneath each host stays in place
 * everywhere this module never runs.
 */
import * as THREE from 'three';

const TEAL = new THREE.Color('#2DD4BF');
const TEAL_DEEP = new THREE.Color('#0EA5E9');
const GOLD = new THREE.Color('#C9A96E');

/* Soft radial sprite for glowing particles */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRenderer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  return renderer;
}

/* Shared visibility-aware render loop */
function runLoop(host, renderer, tick) {
  let visible = true;
  let raf = null;

  const loop = (t) => {
    tick(t);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (raf === null) raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      visible && !document.hidden ? start() : stop();
    },
    { threshold: 0.02 }
  ).observe(host);

  document.addEventListener('visibilitychange', () => {
    document.hidden || !visible ? stop() : start();
  });

  window.addEventListener(
    'resize',
    () => {
      if (host.clientWidth && host.clientHeight) {
        renderer.setSize(host.clientWidth, host.clientHeight);
      }
    },
    { passive: true }
  );

  start();
}

/* ============================================================
   DNA helix — thin luminous strands, teal + gold, mouse parallax
   ============================================================ */
function mountHelix(host) {
  const renderer = makeRenderer(host);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(2.4, 0, 9);

  const group = new THREE.Group();
  scene.add(group);

  const TURNS = 3.2;
  const POINTS = 130;
  const HEIGHT = 9;
  const RADIUS = 1.15;

  const strand = (phase, color) => {
    const positions = new Float32Array(POINTS * 3);
    const colors = new Float32Array(POINTS * 3);
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      const angle = t * Math.PI * 2 * TURNS + phase;
      positions[i * 3] = Math.cos(angle) * RADIUS;
      positions[i * 3 + 1] = (t - 0.5) * HEIGHT;
      positions[i * 3 + 2] = Math.sin(angle) * RADIUS;
      const c = color.clone().lerp(TEAL_DEEP, t * 0.4);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  };

  const geoA = strand(0, TEAL);
  const geoB = strand(Math.PI, GOLD);

  const lineMatA = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
  const lineMatB = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4 });
  group.add(new THREE.Line(geoA, lineMatA));
  group.add(new THREE.Line(geoB, lineMatB));

  const sprite = glowTexture();
  const dotMat = (size, opacity) =>
    new THREE.PointsMaterial({
      size,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
  group.add(new THREE.Points(geoA.clone(), dotMat(0.16, 0.9)));
  group.add(new THREE.Points(geoB.clone(), dotMat(0.13, 0.7)));

  /* rungs between the strands */
  const RUNGS = 26;
  const rungPositions = new Float32Array(RUNGS * 2 * 3);
  for (let i = 0; i < RUNGS; i++) {
    const t = i / (RUNGS - 1);
    const angle = t * Math.PI * 2 * TURNS;
    const y = (t - 0.5) * HEIGHT;
    rungPositions[i * 6] = Math.cos(angle) * RADIUS;
    rungPositions[i * 6 + 1] = y;
    rungPositions[i * 6 + 2] = Math.sin(angle) * RADIUS;
    rungPositions[i * 6 + 3] = Math.cos(angle + Math.PI) * RADIUS;
    rungPositions[i * 6 + 4] = y;
    rungPositions[i * 6 + 5] = Math.sin(angle + Math.PI) * RADIUS;
  }
  const rungGeo = new THREE.BufferGeometry();
  rungGeo.setAttribute('position', new THREE.BufferAttribute(rungPositions, 3));
  group.add(
    new THREE.LineSegments(
      rungGeo,
      new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.16 })
    )
  );

  /* position the helix toward the right of the hero */
  group.position.x = 3.1;
  group.rotation.z = 0.12;

  /* subtle mouse parallax */
  let targetX = 0;
  let targetY = 0;
  if (host.hasAttribute('data-helix-parallax')) {
    window.addEventListener(
      'pointermove',
      (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 0.35;
        targetY = (e.clientY / window.innerHeight - 0.5) * 0.18;
      },
      { passive: true }
    );
  }

  runLoop(host, renderer, (t) => {
    group.rotation.y = t * 0.00012 + targetX;
    group.rotation.x += (targetY - group.rotation.x) * 0.04;
    camera.aspect = host.clientWidth / host.clientHeight || 1;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
}

/* ============================================================
   Cell field — drifting stem-cell-like particles with soft glow
   ============================================================ */
function mountCells(host) {
  const renderer = makeRenderer(host);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.z = 10;

  const COUNT = 170;
  const SPREAD = { x: 16, y: 8, z: 6 };
  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = (Math.random() - 0.5) * SPREAD.x;
    base[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
    base[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.2 + Math.random() * 0.5;
    const c = Math.random() < 0.22 ? GOLD : TEAL.clone().lerp(TEAL_DEEP, Math.random() * 0.6);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.32,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  scene.add(points);

  runLoop(host, renderer, (t) => {
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
    camera.aspect = host.clientWidth / host.clientHeight || 1;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
}

export function initThree() {
  document.querySelectorAll('[data-three]').forEach((host) => {
    try {
      if (host.dataset.three === 'helix') mountHelix(host);
      else if (host.dataset.three === 'cells') mountCells(host);
      host.classList.add('three-active');
    } catch {
      /* WebGL unavailable — the SVG fallback stays visible */
    }
  });
}
