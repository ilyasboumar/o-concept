/**
 * Minimal WebGL layer for the lab.
 *
 * Canvas 2D tops out at line-and-dot work — fine for diagrams, but it can't
 * do volume, light or material, which is exactly what "wow" needs here. These
 * scenes are full-screen fragment shaders: every pixel is lit per frame, so we
 * get depth, bloom and fluid motion that 2D simply cannot reach.
 *
 * Raw WebGL1 GLSL (no #version) rather than three.js — a full-screen triangle
 * needs none of three's scene graph, and this keeps the lab bundle small.
 *
 * A scene supplies its fragment shader plus a uniform-writer. Everything else
 * — pointer trail, resize, teardown — lives here so the shader files stay
 * readable.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** Shared GLSL: hashes, value noise, fbm, worley. Prepended to every shader. */
export const GLSL_LIB = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uPts[8];   // x, y (pixels), age 0..1 — the pointer's wake
uniform vec4  uP0;       // scene params
uniform vec4  uP1;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2  hash22(vec2 p){ float n = hash21(p); return vec2(n, hash21(p + n)); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

/** Worley / cellular noise — returns (distance to nearest, distance to 2nd). */
vec2 worley(vec2 p, float t){
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(n + g);
      // cells drift, so the tissue is never static
      o = 0.5 + 0.42 * sin(t * 0.6 + 6.2831 * o);
      float d = length(g + o - f);
      if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
    }
  }
  return vec2(d1, d2);
}

/** Combined energy from the pointer wake at a given pixel. */
float wake(vec2 px, float radius){
  float e = 0.0;
  for (int i = 0; i < 8; i++){
    float age = uPts[i].z;
    if (age <= 0.0) continue;
    float d = distance(px, uPts[i].xy);
    float k = 1.0 - smoothstep(0.0, radius * (0.45 + age * 0.55), d);
    e = max(e, k * age);
  }
  return e;
}
`;

const TRAIL = 8;

export function makeShaderScene({ id, name, blurb, placement, params, frag, uniforms, extraUniforms, bg, resScale }) {
  return {
    id,
    name,
    blurb,
    placement,
    params,
    bg,
    resScale,
    type: 'webgl',

    create(canvas, w, h, p) {
      const gl =
        canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false }) ||
        canvas.getContext('experimental-webgl');
      if (!gl) return { step() {}, destroy() {} };

      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error(`[lab:${id}]`, gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, GLSL_LIB + frag);
      if (!vs || !fs) return { step() {}, destroy() {} };

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      /* one big triangle covers the viewport with no wasted fragments */
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const extra = {};
      for (const nm of extraUniforms || []) extra[nm] = gl.getUniformLocation(prog, nm);

      const U = {
        res: gl.getUniformLocation(prog, 'uRes'),
        time: gl.getUniformLocation(prog, 'uTime'),
        pts: gl.getUniformLocation(prog, 'uPts'),
        p0: gl.getUniformLocation(prog, 'uP0'),
        p1: gl.getUniformLocation(prog, 'uP1'),
        extra,
      };

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      /* pointer wake — a short history so movement leaves a trail that heals
         over, rather than a single hard spotlight */
      const pts = new Float32Array(TRAIL * 3);
      let cursor = { x: -9999, y: -9999, live: false };
      let dropClock = 0;

      const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        cursor.x = e.clientX - r.left;
        cursor.y = r.height - (e.clientY - r.top); // GL origin is bottom-left
        cursor.live = true;
      };
      const onLeave = () => (cursor.live = false);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);

      let t = 0;

      return {
        step(dt) {
          t += dt;

          /* age the wake, and drop a fresh point a few times a second */
          for (let i = 0; i < TRAIL; i++) {
            pts[i * 3 + 2] = Math.max(0, pts[i * 3 + 2] - dt * 0.55);
          }
          dropClock += dt;
          if (cursor.live && dropClock > 0.06) {
            dropClock = 0;
            let oldest = 0;
            for (let i = 1; i < TRAIL; i++) if (pts[i * 3 + 2] < pts[oldest * 3 + 2]) oldest = i;
            pts[oldest * 3] = cursor.x;
            pts[oldest * 3 + 1] = cursor.y;
            pts[oldest * 3 + 2] = 1;
          }

          const dpr = canvas.width / Math.max(1, w);
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(U.res, canvas.width, canvas.height);
          gl.uniform1f(U.time, t);
          gl.uniform3fv(U.pts, scalePts(pts, dpr));
          uniforms(gl, U, p, { t, w, h });
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        destroy() {
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerleave', onLeave);
          gl.deleteBuffer(buf);
          gl.deleteProgram(prog);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          /* Deliberately NOT calling WEBGL_lose_context here. getContext()
             returns the *same* context object for a given canvas, and every
             slider change re-seeds the scene — losing the context would leave
             each shader panel permanently blank after the first drag. GL
             objects are released above, which is the part that matters. */
        },
      };
    },
  };
}

/* the shader works in device pixels; the pointer arrives in CSS pixels */
const scaled = new Float32Array(TRAIL * 3);
function scalePts(pts, dpr) {
  for (let i = 0; i < TRAIL; i++) {
    scaled[i * 3] = pts[i * 3] * dpr;
    scaled[i * 3 + 1] = pts[i * 3 + 1] * dpr;
    scaled[i * 3 + 2] = pts[i * 3 + 2];
  }
  return scaled;
}
