/**
 * Three.js layer — the persistent helix backdrop + the stem-cell particle field.
 * Lazily imported from main.js whenever a [data-three] host exists.
 *
 * The backdrop (data-three="helix-bg") is mounted once, at the layout level, on
 * a fixed full-viewport canvas behind every section. It is the site's single
 * signature object: one enormous horizontal DNA helix, cropped at both edges,
 * that tells the story of the protocol as the visitor descends —
 *
 *   dormant → activation → separation → replication → renewed
 *
 * States are anchored to real [data-helix-state] sections and interpolated
 * against global scroll, so the transformation is felt, never stepped.
 *
 * Non-negotiables:
 *  - pixel ratio capped at 2
 *  - geometry is built once; every frame updates uniforms only
 *  - loops pause offscreen (IntersectionObserver) and on hidden tabs
 *  - prefers-reduced-motion: one static frame in the dormant state, no loop
 *  - full geometry/material/texture disposal on pagehide
 *  - canvases never intercept pointer events; hosts are pre-sized (no CLS)
 *  - the helix attenuates behind text blocks so every section stays WCAG AA
 */
import * as THREE from 'three';

const GOLD = new THREE.Color('#C9A96E');
const TEAL = new THREE.Color('#2DD4BF');
const TEAL_DEEP = new THREE.Color('#0EA5E9');
const INK = 0x0a0a0b;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = !window.matchMedia('(min-width: 1024px)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* The shared Lenis instance, handed over by main.js — the single source of
   scroll truth. Null under reduced motion (Lenis is never constructed). */
let sharedLenis = null;

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

function createScene(host, tick, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: opts.antialias !== false,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (opts.fog !== false) scene.fog = new THREE.Fog(INK, 8, 16);

  const camera = new THREE.PerspectiveCamera(
    opts.fov || 42,
    (host.clientWidth || 1) / (host.clientHeight || 1),
    0.1,
    opts.far || 100
  );

  const record = { host, renderer, scene, camera, raf: null, visible: true, disposed: false };

  const frame = (t) => {
    tick(t, record);
    if (record.disposed) return; // tick may have torn the scene down
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
  record.render = () => !record.disposed && renderer.render(scene, camera);
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
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

function cssColor(name, fallback) {
  const raw = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
  return new THREE.Color(raw);
}

/* ==================================================================
   The persistent helix backdrop
   ================================================================== */

/* The five scroll states. Every value is interpolated between the
   neighbouring stops, so the molecule is never caught mid-step.

   pitch    coil tightness (× base); higher = tighter wind
   sep      strand separation, in radii — the unzip
   amp      helix radius (× base)
   lum      strand luminance
   rung     base-pair rung opacity — falls away as the strands release
   detach   fraction of node drift — free-floating bases
   ignite   replication sweep intensity
   spin     rotation rate (× base) */
const HELIX_STATES = {
  dormant: { pitch: 1.0, sep: 0.0, amp: 1.0, lum: 0.8, rung: 1.0, detach: 0.0, ignite: 0.0, spin: 1.0 },
  activation: { pitch: 0.74, sep: 0.06, amp: 1.06, lum: 0.95, rung: 0.94, detach: 0.02, ignite: 0.0, spin: 1.3 },
  separation: { pitch: 0.54, sep: 0.62, amp: 1.02, lum: 1.05, rung: 0.22, detach: 1.0, ignite: 0.0, spin: 0.8 },
  replication: { pitch: 0.86, sep: 0.08, amp: 1.04, lum: 1.55, rung: 0.9, detach: 0.22, ignite: 1.0, spin: 1.45 },
  renewed: { pitch: 1.32, sep: 0.0, amp: 0.98, lum: 1.25, rung: 1.0, detach: 0.0, ignite: 0.16, spin: 1.12 },
};
const STATE_ORDER = ['dormant', 'activation', 'separation', 'replication', 'renewed'];
const STATE_KEYS = Object.keys(HELIX_STATES.dormant);

/* ---- shared GLSL: one analytic definition of the molecule ---------
   Every vertex shader below places itself with helixAt(), so strands,
   rungs and nodes can never disagree about where the helix is. */
const HB_COMMON = /* glsl */ `
  #define PI 3.141592653589793

  uniform float uLength;
  uniform float uTravel;
  uniform float uPitch;
  uniform float uRadius;
  uniform float uSep;
  uniform float uCurve;
  uniform float uSpin;
  uniform float uZSquash;
  uniform vec4  uPluck[4];
  uniform float uWaveSpeed;
  uniform float uWaveWidth;

  /* Sum of the live plucks — each a pulse travelling outward along the
     axis from its origin, decaying in time like a wave on a string. */
  float pluckAt(float s) {
    float d = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 pk = uPluck[i];
      float dt = pk.y;
      float dist = abs(s - pk.x);
      float e = (dist - uWaveSpeed * dt) / uWaveWidth;
      d += pk.z * exp(-e * e) * exp(-dt * 1.5) * (1.0 + 0.22 * sin(dist * 0.7 - dt * 7.0));
    }
    return d;
  }

  /* xyz of the strand at axis position x; .w is the depth cue (-1 far, +1 near).
     uCurve bends the ends away from the camera, so the molecule recedes toward
     a vanishing point past each edge of the frame. */
  vec4 helixAt(float x, float strand) {
    float s = x + uTravel;
    float ph = s * uPitch + strand * PI + uSpin;
    float y = cos(ph) * uRadius + (strand * 2.0 - 1.0) * uSep + pluckAt(s);
    /* The coil is flattened along the view axis: depth is read from opacity
       (uZSquash keeps base-pair rungs near-vertical instead of splaying into
       a web), while uCurve still bends the ends away toward the edges. */
    float z = sin(ph) * uRadius * uZSquash - uCurve * x * x;
    return vec4(x, y, z, sin(ph));
  }
`;

/* Screen-space ribbon expansion — gives exact pixel line widths at any DPR,
   which THREE.Line (always 1px) cannot. */
const HB_RIBBON = /* glsl */ `
  uniform vec2 uRes;
  uniform float uHalfW;

  vec4 ribbon(vec3 here, vec3 ahead, float side) {
    vec4 c0 = projectionMatrix * modelViewMatrix * vec4(here, 1.0);
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(ahead, 1.0);
    vec2 s0 = c0.xy / c0.w;
    vec2 d = (c1.xy / c1.w - s0) * uRes;
    float l = length(d);
    vec2 dir = l > 0.0001 ? d / l : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    return vec4((s0 + nrm * side * uHalfW * 2.0 / uRes) * c0.w, c0.z, c0.w);
  }
`;

/* Text-legibility attenuation: the helix ducks behind the text blocks that
   are actually on screen, so contrast is never compromised. */
const HB_TEXTDIM = /* glsl */ `
  uniform vec4 uRects[10];
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uTextDim;

  float textDim() {
    vec2 p = gl_FragCoord.xy / uDpr;
    p.y = uRes.y - p.y;              // to CSS pixels, origin top-left
    const float F = 30.0;            // feather, px
    float inside = 0.0;
    for (int i = 0; i < 10; i++) {
      vec4 r = uRects[i];
      float ix = smoothstep(r.x - F, r.x + F, p.x) * (1.0 - smoothstep(r.z - F, r.z + F, p.x));
      float iy = smoothstep(r.y - F, r.y + F, p.y) * (1.0 - smoothstep(r.w - F, r.w + F, p.y));
      inside = max(inside, ix * iy);
    }
    return mix(1.0, uTextDim, inside);
  }
`;

const HB_STRAND_VERT =
  HB_COMMON +
  HB_RIBBON +
  /* glsl */ `
  attribute float aU;
  attribute float aSide;
  attribute float aStrand;
  varying float vDepth;
  varying float vEdge;
  varying float vS;

  void main() {
    float x = (aU - 0.5) * uLength;
    float du = uLength * 0.0016;
    vec4 h = helixAt(x, aStrand);
    vDepth = h.w;
    vEdge = aSide;
    vS = x + uTravel;
    gl_Position = ribbon(h.xyz, helixAt(x + du, aStrand).xyz, aSide);
  }
`;

const HB_RUNG_VERT =
  HB_COMMON +
  HB_RIBBON +
  /* glsl */ `
  attribute float aIdx;
  attribute float aEnd;
  attribute float aSide;
  uniform float uRungSpacing;
  varying float vDepth;
  varying float vEdge;
  varying float vS;

  void main() {
    /* wrap the base pair into the drawn window; the seam sits off-screen */
    float x = mod(aIdx * uRungSpacing - uTravel + uLength * 0.5, uLength) - uLength * 0.5;
    vec4 h = helixAt(x, aEnd);
    vec4 o = helixAt(x, 1.0 - aEnd);
    vDepth = h.w;
    vEdge = aSide;
    vS = x + uTravel;
    gl_Position = ribbon(h.xyz, o.xyz, aSide);
  }
`;

const HB_LINE_FRAG =
  HB_TEXTDIM +
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uLineW;
  uniform float uHalfW;
  uniform float uLum;
  uniform float uIgnite;
  uniform float uFront;
  uniform float uFrontW;
  varying float vDepth;
  varying float vEdge;
  varying float vS;

  void main() {
    float dpx = abs(vEdge) * uHalfW;
    float a = 1.0 - smoothstep(uLineW * 0.5 - 0.5, uLineW * 0.5 + 0.5, dpx);
    if (a <= 0.001) discard;
    a *= uAlpha * mix(0.35, 1.0, smoothstep(-1.0, 1.0, vDepth));   // depth by opacity, never blur
    float e = (vS - uFront) / uFrontW;
    float ig = uIgnite * exp(-e * e);
    /* luminance rides the alpha, never the hue: quiet gold is still gold,
       never brown. Past full it overdrives the colour instead. */
    float lum = uLum + ig * 0.8;
    a *= min(1.0, lum) * textDim();
    gl_FragColor = vec4(uColor * max(1.0, lum), clamp(a, 0.0, 1.0));
  }
`;

const HB_NODE_VERT =
  HB_COMMON +
  /* glsl */ `
  attribute float aIdx;
  attribute float aEnd;
  attribute vec3 aRand;
  uniform float uRungSpacing;
  uniform float uDetach;
  uniform float uNodeSize;
  uniform float uDpr;
  uniform float uCamZ;
  varying float vDepth;
  varying float vS;
  varying float vWave;

  void main() {
    float x = mod(aIdx * uRungSpacing - uTravel + uLength * 0.5, uLength) - uLength * 0.5;
    vec4 h = helixAt(x, aEnd);
    vS = x + uTravel;
    vDepth = h.w;
    vWave = abs(pluckAt(vS));
    /* a share of the bases break loose and drift while the strands are open */
    vec3 p = h.xyz + (aRand - 0.5) * 2.0 * uDetach * step(0.62, aRand.x) * uRadius * 0.9;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uNodeSize * uDpr * (uCamZ / max(1.0, -mv.z));
  }
`;

const HB_NODE_FRAG =
  HB_TEXTDIM +
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uLum;
  uniform float uIgnite;
  uniform float uFront;
  uniform float uFrontW;
  uniform float uWaveGain;
  varying float vDepth;
  varying float vS;
  varying float vWave;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float m = 1.0 - smoothstep(0.5 - fwidth(d) * 1.5, 0.5, d);   // crisp disc, anti-aliased
    if (m <= 0.001) discard;
    float e = (vS - uFront) / uFrontW;
    float ig = uIgnite * exp(-e * e);
    float w = vWave * uWaveGain;                       // the pluck passing through
    float a = m * uAlpha * mix(0.35, 1.0, smoothstep(-1.0, 1.0, vDepth));
    float lum = uLum * 1.25 + ig * 0.9 + w;
    a *= min(1.0, lum) * textDim();
    gl_FragColor = vec4(uColor * max(1.0, lum), clamp(a, 0.0, 1.0));
  }
`;

function mountHelixBackdrop(host) {
  const SEG = isMobile ? 420 : 900; // strand samples across the frame
  const RUNGS = isMobile ? 34 : 60; // base pairs in the drawn window (~10 per turn)
  const CAM_Z = 60;
  const FOV = 45;
  const canPluck = finePointer && !isMobile && !reduced;

  const GOLDL = cssColor('--color-goldlight', '#e3c992'); // strands — bright champagne
  const CREAM = cssColor('--color-cream', '#f4f1ec'); // rungs — pale platinum
  const NODE = new THREE.Color('#fdfaf3'); // nodes — near-white hot points

  /* ---- geometry: built once, never rebuilt. Everything moves in the
     vertex shaders, driven by uniforms. ---- */

  const strandGeo = () => {
    const n = SEG + 1;
    const verts = n * 2 * 2; // 2 strands × 2 ribbon edges
    const aU = new Float32Array(verts);
    const aSide = new Float32Array(verts);
    const aStrand = new Float32Array(verts);
    const idx = new Uint32Array(SEG * 6 * 2);
    let v = 0;
    let q = 0;
    for (let s = 0; s < 2; s++) {
      const base = v;
      for (let i = 0; i < n; i++) {
        const u = i / SEG;
        aU[v] = u;
        aSide[v] = -1;
        aStrand[v] = s;
        v++;
        aU[v] = u;
        aSide[v] = 1;
        aStrand[v] = s;
        v++;
      }
      for (let i = 0; i < SEG; i++) {
        const a = base + i * 2;
        idx[q++] = a;
        idx[q++] = a + 1;
        idx[q++] = a + 2;
        idx[q++] = a + 1;
        idx[q++] = a + 3;
        idx[q++] = a + 2;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
    g.setAttribute('aStrand', new THREE.BufferAttribute(aStrand, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    // positions are computed in the shader; keep three from culling the mesh
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    return g;
  };

  const rungGeo = () => {
    const verts = RUNGS * 4; // 2 ends × 2 ribbon edges
    const aIdx = new Float32Array(verts);
    const aEnd = new Float32Array(verts);
    const aSide = new Float32Array(verts);
    const idx = new Uint32Array(RUNGS * 6);
    let v = 0;
    let q = 0;
    for (let r = 0; r < RUNGS; r++) {
      const base = v;
      for (let e = 0; e < 2; e++) {
        for (let sd = -1; sd <= 1; sd += 2) {
          aIdx[v] = r;
          aEnd[v] = e;
          aSide[v] = sd;
          v++;
        }
      }
      idx[q++] = base;
      idx[q++] = base + 1;
      idx[q++] = base + 2;
      idx[q++] = base + 1;
      idx[q++] = base + 3;
      idx[q++] = base + 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 1));
    g.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    return g;
  };

  const nodeGeo = () => {
    const n = RUNGS * 2;
    const aIdx = new Float32Array(n);
    const aEnd = new Float32Array(n);
    const aRand = new Float32Array(n * 3);
    for (let r = 0; r < RUNGS; r++) {
      for (let e = 0; e < 2; e++) {
        const i = r * 2 + e;
        aIdx[i] = r;
        aEnd[i] = e;
        aRand[i * 3] = Math.random();
        aRand[i * 3 + 1] = Math.random();
        aRand[i * 3 + 2] = Math.random();
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 1));
    g.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
    g.setAttribute('aRand', new THREE.BufferAttribute(aRand, 3));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  };

  /* ---- uniforms: one shared set, so the three materials cannot drift ---- */
  // (x, y, z, w) = (origin along the axis, age in seconds, signed amplitude,
  // in use). Vector4 defaults w to 1, so spell the empty slots out.
  const pluckSlots = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0));
  const rects = Array.from({ length: 10 }, () => new THREE.Vector4(-9999, -9999, -9999, -9999));

  const shared = {
    uLength: { value: 100 },
    uTravel: { value: 0 },
    uPitch: { value: 0.5 },
    uRadius: { value: 10 },
    uSep: { value: 0 },
    uCurve: { value: 0 },
    uSpin: { value: 0 },
    uZSquash: { value: 0.4 },
    uPluck: { value: pluckSlots },
    uWaveSpeed: { value: 46 },
    uWaveWidth: { value: 9 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
    uRects: { value: rects },
    /* Sized against the worst case on the page: a strand pixel landing on a
       glyph of the dimmest body copy (cream/60, 15px). At 0.2 that pixel
       still clears 4.5:1, so AA holds even where the molecule crosses text.
       The near-white nodes are brighter again, so they duck harder still. */
    uTextDim: { value: 0.2 },
    uLum: { value: 1 },
    uIgnite: { value: 0 },
    uFront: { value: 0 },
    uFrontW: { value: 26 },
    uRungSpacing: { value: 1 },
    uDetach: { value: 0 },
  };
  const withShared = (extra) => Object.assign({}, shared, extra);

  const STRAND_W = isMobile ? 1.9 : 2.3; // CSS px at any DPR
  const RUNG_W = isMobile ? 1.1 : 1.35;
  const feather = 1.0;

  const strandMat = new THREE.ShaderMaterial({
    vertexShader: HB_STRAND_VERT,
    fragmentShader: HB_LINE_FRAG,
    uniforms: withShared({
      uColor: { value: GOLDL },
      uAlpha: { value: 1 },
      uLineW: { value: STRAND_W },
      uHalfW: { value: STRAND_W * 0.5 + feather },
    }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const rungMat = new THREE.ShaderMaterial({
    vertexShader: HB_RUNG_VERT,
    fragmentShader: HB_LINE_FRAG,
    uniforms: withShared({
      uColor: { value: CREAM },
      uAlpha: { value: 0.44 },
      uLineW: { value: RUNG_W },
      uHalfW: { value: RUNG_W * 0.5 + feather },
    }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const nodeMat = new THREE.ShaderMaterial({
    vertexShader: HB_NODE_VERT,
    fragmentShader: HB_NODE_FRAG,
    uniforms: withShared({
      uColor: { value: NODE },
      uAlpha: { value: 0.95 },
      uNodeSize: { value: isMobile ? 4.2 : 5.2 },
      uCamZ: { value: CAM_Z },
      uWaveGain: { value: 0 },
      uTextDim: { value: 0.12 }, // near-white: ducks harder than the strands
    }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  const group = new THREE.Group();
  const strands = new THREE.Mesh(strandGeo(), strandMat);
  const rungs = new THREE.Mesh(rungGeo(), rungMat);
  const nodes = new THREE.Points(nodeGeo(), nodeMat);
  // shader-placed geometry: bounding volumes are meaningless, so never cull
  [strands, rungs, nodes].forEach((o) => {
    o.frustumCulled = false;
    o.renderOrder = 1;
  });
  rungs.renderOrder = 0;
  nodes.renderOrder = 2;
  group.add(rungs, strands, nodes);

  const rec = createScene(host, tick, { antialias: false, fog: false, fov: FOV, far: 400 });
  rec.camera.position.set(0, 0, CAM_Z);
  rec.scene.add(group);

  /* ---- viewport-derived scale: recomputed on resize, never per frame ---- */
  let halfH = 1;
  let halfW = 1;
  let basePitch = 1;
  let baseRadius = 1;

  const syncSize = () => {
    if (rec.disposed) return;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    rec.renderer.setPixelRatio(dpr);
    rec.renderer.setSize(w, h);
    rec.camera.aspect = w / h;
    rec.camera.updateProjectionMatrix();

    halfH = Math.tan((FOV * Math.PI) / 180 / 2) * CAM_Z;
    halfW = halfH * rec.camera.aspect;

    const L = halfW * 3.2; // overruns the frame — the molecule is clearly cropped
    shared.uLength.value = L;
    shared.uRungSpacing.value = L / RUNGS;
    // ends pushed back ~45% of the camera distance: real recession toward
    // a vanishing point past each edge
    shared.uCurve.value = (0.45 * CAM_Z) / ((L * 0.5) * (L * 0.5));
    baseRadius = halfH * 0.6; // ≈62% of viewport height, peak to peak
    basePitch = (4 * Math.PI) / halfW; // four turns across the frame when dormant
    shared.uWaveSpeed.value = halfW * 1.1;
    shared.uWaveWidth.value = halfW * 0.22;
    shared.uFrontW.value = halfW * 0.6;
    shared.uRes.value.set(w, h);
    shared.uDpr.value = dpr;
    // normalises the pluck displacement (world units) into a 0..1 node flare
    nodeMat.uniforms.uWaveGain.value = 1 / Math.max(0.001, baseRadius * 0.45);
    if (reduced) {
      applyState(0, 0);
      updateRects();
      rec.render();
    }
  };
  window.addEventListener('resize', syncSize, { passive: true });

  /* ---- scroll narrative: anchored to the real sections on the page ---- */
  let stops = null; // document offsets, one per state, ascending

  const measureStops = () => {
    /* Each state peaks when its section is centred in the viewport, so a long
       section (the protocol runs to nearly 4000px) reaches its state in the
       middle of the reading, not at its first pixel. */
    const els = [...document.querySelectorAll('[data-helix-state]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.dataset.helixState, top: r.top + window.scrollY + r.height * 0.5 - window.innerHeight * 0.5 };
      })
      .filter((s) => STATE_ORDER.includes(s.name))
      .sort((a, b) => a.top - b.top);
    const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (els.length < 3) {
      // no narrative markup on this page — spread the story over its length
      stops = STATE_ORDER.map((_, i) => (i / (STATE_ORDER.length - 1)) * limit);
      return;
    }
    const byName = new Map(els.map((s) => [s.name, s.top]));
    let prev = 0;
    stops = STATE_ORDER.map((name, i) => {
      const raw = byName.has(name) ? Math.max(0, byName.get(name)) : (i / (STATE_ORDER.length - 1)) * limit;
      prev = Math.max(prev + 1, Math.min(raw, limit));
      return prev;
    });
  };
  measureStops();
  window.addEventListener('resize', measureStops, { passive: true });
  window.addEventListener('load', measureStops);
  setTimeout(measureStops, 1200); // after lazy images and ScrollTrigger settle

  /* Interpolate the state parameters at a document scroll offset. */
  const state = {};
  function sampleState(y) {
    if (!stops) measureStops();
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1]) i++;
    const a = HELIX_STATES[STATE_ORDER[i]];
    const b = HELIX_STATES[STATE_ORDER[i + 1]];
    const k = smoothstep(clamp01((y - stops[i]) / Math.max(1, stops[i + 1] - stops[i])));
    for (const key of STATE_KEYS) state[key] = a[key] + (b[key] - a[key]) * k;
    return i + k; // fractional state index, for the axis drift
  }

  /* ---- the pluck: the cursor catches the strand and lets it go ---- */
  let slot = 0;
  if (canPluck) {
    let lastAt = 0;
    let lastY = null;
    window.addEventListener(
      'pointermove',
      (e) => {
        const dy = lastY === null ? 0 : e.clientY - lastY;
        lastY = e.clientY;
        const now = performance.now();
        if (now - lastAt < 110) return;
        // world Y under the cursor (screen Y runs down, world Y runs up)
        const wy = -(e.clientY / window.innerHeight - 0.5) * 2 * halfH;
        // only while the pointer is over the band the molecule occupies
        if (Math.abs(wy - group.position.y) > baseRadius * 1.4 + shared.uSep.value) return;
        const speed = Math.min(1, Math.abs(dy) / 34);
        if (speed < 0.12) return;
        lastAt = now;
        const p = pluckSlots[slot];
        slot = (slot + 1) % pluckSlots.length;
        // material coordinate of the strand under the cursor
        p.x = (e.clientX / window.innerWidth - 0.5) * 2 * halfW + shared.uTravel.value;
        p.y = 0; // age, seconds
        p.z = -Math.sign(dy) * (0.45 + speed) * baseRadius * 0.4; // the strand follows the hand
        p.w = 1;
      },
      { passive: true }
    );
  }

  /* ---- per-frame state application ---- */
  let spin = 0;
  let travel = 0;
  let axisY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let smoothLum = 0;

  function applyState(y, time) {
    const idx = sampleState(y);
    shared.uPitch.value = basePitch * state.pitch;
    shared.uRadius.value = baseRadius * state.amp;
    shared.uSep.value = baseRadius * state.sep;
    shared.uDetach.value = state.detach;
    shared.uIgnite.value = state.ignite;
    rungMat.uniforms.uAlpha.value = 0.44 * state.rung;
    smoothLum = reduced ? state.lum : lerp(smoothLum, state.lum, 0.08);
    shared.uLum.value = smoothLum;

    // the whole molecule slides along its own axis as the page moves
    travel = y * 0.55 + time * 4.0;
    shared.uTravel.value = travel;
    // the replication front runs the axis, reigniting bases in sequence
    const L = shared.uLength.value;
    shared.uFront.value = travel + ((time * 42) % (L * 1.6)) - L * 0.3;
    // never pinned: the axis drifts gently as the story advances
    axisY = reduced ? 0 : lerp(axisY, Math.sin(idx * 0.9) * halfH * 0.09, 0.05);
    group.position.y = axisY;
  }

  /* ---- text-legibility rects: only the blocks actually on screen ---- */
  const TEXT_SEL = 'h1,h2,h3,h4,p,li,blockquote,dd,dt,figcaption,label,summary';
  const blocks = new Map(); // section element → cached text descendants
  const onScreen = new Set();
  let rectObserver = null;

  const initRects = () => {
    const sections = document.querySelectorAll('main > section, main > div > section, footer');
    if (!sections.length) return;
    rectObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
      },
      { rootMargin: '10% 0px' }
    );
    sections.forEach((s) => {
      blocks.set(s, [...s.querySelectorAll(TEXT_SEL)]);
      rectObserver.observe(s);
    });
  };
  initRects();

  /* Group the on-screen text into columns: a block joins a group when it
     shares most of its width with it and sits close below. A whole-section
     bounding box would blanket the viewport and put the molecule out entirely;
     this keeps the dimming to the copy itself, so the helix visibly ducks
     behind a paragraph and stays bright in the margins around it. */
  const GAP = 60; // px of vertical slack that still counts as one column
  const groups = [];

  const updateRects = () => {
    const vh = window.innerHeight;
    groups.length = 0;
    for (const sec of onScreen) {
      for (const el of blocks.get(sec) || []) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 6 || r.bottom < 0 || r.top > vh) continue;
        let merged = false;
        for (const g of groups) {
          const overlap = Math.min(g[2], r.right) - Math.max(g[0], r.left);
          if (overlap < 0.45 * Math.min(g[2] - g[0], r.width)) continue;
          if (r.top > g[3] + GAP || r.bottom < g[1] - GAP) continue;
          g[0] = Math.min(g[0], r.left);
          g[1] = Math.min(g[1], r.top);
          g[2] = Math.max(g[2], r.right);
          g[3] = Math.max(g[3], r.bottom);
          merged = true;
          break;
        }
        if (!merged && groups.length < rects.length) groups.push([r.left, r.top, r.right, r.bottom]);
      }
    }
    for (let i = 0; i < rects.length; i++) {
      const g = groups[i];
      if (g) rects[i].set(g[0], g[1], g[2], g[3]);
      else rects[i].set(-9999, -9999, -9999, -9999);
    }
  };

  /* ---- the loop ---- */
  const scrollY = () => (sharedLenis ? sharedLenis.scroll : window.scrollY);
  let last = 0;
  let frames = 0;

  function tick(t) {
    const time = t * 0.001;

    if (reduced) {
      // one composed frame in the dormant state — no rotation, no story
      shared.uSpin.value = 0.55;
      applyState(0, 0);
      updateRects();
      return;
    }

    const dt = last ? Math.min(0.05, (t - last) * 0.001) : 0.016;
    last = t;

    applyState(scrollY(), time);

    spin += dt * 0.28 * state.spin;
    shared.uSpin.value = spin;

    // age the live plucks; a spent slot zeroes out and drops from the sum
    for (const p of pluckSlots) {
      if (p.w === 0) continue;
      p.y += dt;
      if (p.y > 3.2) p.set(0, 0, 0, 0);
    }

    // heavily damped parallax tilt
    if (finePointer && !isMobile) {
      tiltX = lerp(tiltX, cursor.y * 0.09, 0.03);
      tiltY = lerp(tiltY, cursor.x * 0.03, 0.03);
      group.rotation.x = tiltX;
      group.rotation.y = tiltY;
    }

    if ((frames++ & 3) === 0) updateRects();
  }

  /* Everything the loop reads now exists. Measure, then place the molecule
     before anything is painted — otherwise the first frame would show the
     uniforms' construction-time defaults rather than this viewport's helix. */
  syncSize();
  applyState(scrollY(), 0);
  updateRects();
  window.addEventListener('pagehide', () => rectObserver?.disconnect());
}

/* ==================================================================
   Stem-cell particle field
   ================================================================== */

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

/* ------------------------------------------------------------------ */

export function initThree(opts = {}) {
  sharedLenis = opts.lenis || null;
  document.querySelectorAll('[data-three]').forEach((host) => {
    if (host.dataset.threeMounted) return;
    try {
      if (host.dataset.three === 'helix-bg') mountHelixBackdrop(host);
      else if (host.dataset.three === 'cells') mountCells(host);
      else return;
      host.dataset.threeMounted = '1';
      host.classList.add('three-active');
    } catch {
      /* WebGL unavailable — the static fallback stays visible */
    }
  });
}
