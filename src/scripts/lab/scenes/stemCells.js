/**
 * STEM CELLS — rebuilt in code from the client's reference render.
 *
 * Translucent cells with gold inclusions, drifting through the same golden
 * fibre channel as Golden cells. Same set, different payload — the two are
 * meant to cut together.
 *
 * The detail that makes the reference expensive is refraction: the cords bend
 * as they pass behind each sphere. That is reproduced properly here — the view
 * ray is refracted at the surface with Snell's law and the channel is then
 * sampled *along the bent ray*, so what you see through a cell is the real wall,
 * genuinely displaced. It is not a blur or a distortion texture.
 *
 * On top of that: Fresnel weighting between reflection and transmission (rims
 * go reflective, centres stay clear, which is how glass actually behaves), a
 * gold nucleus suspended inside, and a specular highlight on the shell.
 *
 * Cells are analytic ray/sphere intersections and occlude correctly. Full
 * device resolution — nothing is upscaled.
 */
import { makeShaderScene } from '../webgl.js';
import { CHANNEL_GLSL } from '../channel.js';

const N = 24;

const frag =
  CHANNEL_GLSL +
  `
#define NCELL ${N}
uniform vec4 uCell[NCELL];   // xyz = centre, w = radius
uniform vec4 uCore[NCELL];   // xyz = nucleus offset, w = nucleus radius

vec3 SHELL = vec3(0.796, 0.741, 0.686);
vec3 CORE  = vec3(0.855, 0.663, 0.325);
vec3 CORE2 = vec3(0.976, 0.878, 0.639);

float sphHit(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 o = ro - c;
  float b = dot(o, rd);
  float cc = dot(o, o) - r * r;
  float d = b * b - cc;
  if (d < 0.0) return -1.0;
  float t = -b - sqrt(d);
  return t > 0.0 ? t : -1.0;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;

  float cordN = uP0.x;
  float twist = uP0.y;
  float expo  = uP0.w;
  float ior   = uP1.x;
  float coreI = uP1.y;

  vec3 ro = vec3(0.0, -0.34, 0.0);
  vec3 fwd = normalize(vec3(0.16, -0.10, 1.0));
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 upv = cross(fwd, rgt);
  vec3 rd = normalize(fwd * 1.28 + rgt * uv.x + upv * uv.y);

  float wallT;
  vec3 col = channel(ro, rd, uTime, cordN, twist, 0.06, wallT);
  if (wallT < 0.0) wallT = 1e9;

  float best = wallT;
  int bi = -1;
  vec4 bCell = vec4(0.0);
  vec4 bCore = vec4(0.0);
  for (int i = 0; i < NCELL; i++){
    float t = sphHit(ro, rd, uCell[i].xyz, uCell[i].w);
    if (t > 0.0 && t < best){ best = t; bi = i; bCell = uCell[i]; bCore = uCore[i]; }
  }

  if (bi >= 0){
    vec3 c = bCell.xyz;
    float r = bCell.w;
    vec3 p = ro + rd * best;
    vec3 n = normalize(p - c);
    vec3 v = -rd;

    float fres = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(n, v)), 4.2);

    /* TRANSMISSION — refract into the cell and sample the wall along the bent
       ray. This is the whole reason the reference looks expensive: the cords
       genuinely displace behind each sphere. */
    vec3 rr = refract(rd, n, 1.0 / ior);
    float dummy;
    vec3 through = channel(p + rr * 0.02, rr, uTime, cordN, twist, 0.06, dummy);
    through *= SHELL;

    /* REFLECTION — the wall mirrored off the shell */
    vec3 rl = reflect(rd, n);
    vec3 mirror = channel(p + rl * 0.02, rl, uTime, cordN, twist, 0.06, dummy);

    vec3 cc = mix(through, mirror, fres);

    /* the gold nucleus, seen through the shell */
    vec3 ctr = c + bCore.xyz;
    float ct = sphHit(p + rr * 0.02, rr, ctr, bCore.w);
    if (ct > 0.0){
      vec3 cp = p + rr * (0.02 + ct);
      vec3 cn = normalize(cp - ctr);
      vec3 L1 = normalize(vec3(0.45, 0.80, -0.40));
      float cd = max(0.0, dot(cn, L1));
      float cf = pow(1.0 - max(0.0, dot(cn, -rr)), 2.4);
      vec3 core = CORE * (0.28 + cd * 0.95) + CORE2 * cf * 0.55;
      core += CORE2 * pow(max(0.0, dot(reflect(-L1, cn), -rr)), 30.0) * 0.7;
      cc = mix(cc, core * coreI, 0.86);
    }

    /* shell highlight and a bright edge where the sphere turns away */
    vec3 L1 = normalize(vec3(0.45, 0.80, -0.40));
    cc += vec3(1.0, 0.95, 0.86) * pow(max(0.0, dot(reflect(-L1, n), v)), 46.0) * 0.85;
    cc += SHELL * pow(fres, 1.5) * 0.18;

    float fog = 1.0 - exp(-best * 0.085);
    cc = mix(cc, C_DEEP * 0.35, fog * 0.8);
    col = cc;
  }

  col *= expo;
  col = pow(max(col, 0.0), vec3(0.95));
  float vig = 1.0 - 0.34 * pow(length(uv) * 0.95, 2.0);
  col *= vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default makeShaderScene({
  id: 'stemCells',
  name: 'Stem cells',
  blurb:
    'Translucent stem cells with gold nuclei in the same golden channel — rebuilt in code. True refraction: the cords are sampled along the bent ray, so they genuinely displace behind each cell rather than being blurred.',
  placement:
    'Hero, or the second beat after Golden cells — same set, different payload, so they cut together as a sequence.',
  bg: '#120E0B',
  extraUniforms: ['uCell', 'uCore'],
  params: {
    cords: { label: 'Cord count', min: 30, max: 160, step: 5, value: 88 },
    twist: { label: 'Cord twist', min: -60, max: 60, step: 5, value: 22 },
    drift: { label: 'Cell drift', min: 5, max: 90, step: 5, value: 26 },
    density: { label: 'Cell count', min: 4, max: 24, step: 1, value: 17 },
    size: { label: 'Cell size', min: 5, max: 20, step: 1, value: 12 },
    ior: { label: 'Refraction', min: 105, max: 175, step: 5, value: 140 },
    core: { label: 'Nucleus brightness', min: 0, max: 200, step: 10, value: 100 },
    expo: { label: 'Exposure', min: 60, max: 170, step: 5, value: 105 },
  },
  frag,
  uniforms(gl, U, p, st) {
    const n = N;
    const cells = new Float32Array(n * 4);
    const cores = new Float32Array(n * 4);
    const live = p.density.value;
    const t = st.t;
    const speed = p.drift.value / 100;
    const r0 = p.size.value / 100;

    for (let i = 0; i < n; i++) {
      if (i >= live) {
        cells[i * 4 + 3] = -1;
        cores[i * 4 + 3] = -1;
        continue;
      }
      const s = i * 12.9898;
      const h1 = Math.abs(Math.sin(s) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin(s + 1.7) * 22578.145) % 1;
      const h3 = Math.abs(Math.sin(s + 4.1) * 13141.77) % 1;

      const span = 15.0;
      const z = ((h1 * span + t * speed * 2.2) % span) - 1.0;
      const ang = h2 * Math.PI * 2 + t * 0.04;
      const rad = 0.16 + h3 * 0.58;
      const rr = r0 * (0.68 + h3 * 0.75);

      cells[i * 4] = Math.cos(ang) * rad;
      cells[i * 4 + 1] = Math.sin(ang) * rad * 0.72 - 0.16;
      cells[i * 4 + 2] = z;
      cells[i * 4 + 3] = rr;

      /* the nucleus sits off-centre and drifts inside the shell */
      cores[i * 4] = Math.cos(t * 0.5 + h1 * 6.28) * rr * 0.26;
      cores[i * 4 + 1] = Math.sin(t * 0.42 + h2 * 6.28) * rr * 0.26;
      cores[i * 4 + 2] = Math.sin(t * 0.36 + h3 * 6.28) * rr * 0.22;
      cores[i * 4 + 3] = rr * 0.50;
    }

    gl.uniform4fv(U.extra.uCell, cells);
    gl.uniform4fv(U.extra.uCore, cores);
    gl.uniform4f(U.p0, p.cords.value, p.twist.value / 1000, 0.06, p.expo.value / 100);
    gl.uniform4f(U.p1, p.ior.value / 100, p.core.value / 100, 0, 0);
  },
});
