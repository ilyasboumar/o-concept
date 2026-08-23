/**
 * GOLDEN CELLS — rebuilt in code from the client's reference render.
 *
 * Red blood cells drifting through the golden fibre channel.
 *
 * The cells are real geometry, not sprites: each is an oriented oblate
 * ellipsoid solved by closed-form ray intersection, so it occludes the wall and
 * its neighbours correctly, and it turns in space with genuine perspective.
 * Every cell carries the biconcave dimple that makes a red cell recognisable —
 * shaded from the radial coordinate across its face, so the dip reads when the
 * cell is face-on and disappears as it turns edge-on, exactly as it should.
 *
 * Depth sorting is done per pixel by keeping the nearest hit, which is what lets
 * cells pass in front of one another cleanly.
 *
 * Rendered at full device resolution — analytic intersection has no march steps
 * to trade away, so there is nothing to soften.
 */
import { makeShaderScene } from '../webgl.js';
import { CHANNEL_GLSL } from '../channel.js';

const N = 26;

const frag =
  CHANNEL_GLSL +
  `
#define NCELL ${N}
uniform vec4 uCell[NCELL];   // xyz = centre, w = radius
uniform vec3 uCellAx[NCELL]; // disc face normal (unit)

vec3 RBC_DEEP = vec3(0.239, 0.035, 0.031);
vec3 RBC_MID  = vec3(0.482, 0.075, 0.055);
vec3 RBC_RIM  = vec3(0.729, 0.216, 0.137);

/* Ray vs. oblate spheroid: squash along the disc axis, then it is a sphere. */
float discHit(vec3 ro, vec3 rd, vec3 c, float r, vec3 ax, float squash, out vec3 nrm, out vec2 loc){
  vec3 o = ro - c;
  float oa = dot(o, ax), da = dot(rd, ax);
  vec3 oP = o - ax * oa, dP = rd - ax * da;      // in-plane parts
  float k = 1.0 / squash;                           // axial squash

  float A = dot(dP, dP) + da * da * k * k;
  float B = 2.0 * (dot(oP, dP) + oa * da * k * k);
  float C = dot(oP, oP) + oa * oa * k * k - r * r;
  float disc = B * B - 4.0 * A * C;
  if (disc < 0.0) return -1.0;

  float t = (-B - sqrt(disc)) / (2.0 * A);
  if (t < 0.0) return -1.0;

  vec3 p = ro + rd * t;
  vec3 d = p - c;
  float da2 = dot(d, ax);
  vec3 dP2 = d - ax * da2;
  nrm = normalize(dP2 + ax * da2 * k * k);
  loc = vec2(length(dP2) / r, da2);              // radial 0..1, signed axial
  return t;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;

  float cordN = uP0.x;
  float twist = uP0.y;
  float flow  = uP0.z;
  float expo  = uP0.w;
  float pitch = uP1.x;
  float yaw   = uP1.y;

  /* camera inside the vessel, off-axis and angled so the cords converge */
  vec3 ro = vec3(0.0, -0.34, 0.0);
  vec3 fwd = normalize(vec3(sin(yaw) * 0.30, -0.10 + pitch, 1.0));
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 upv = cross(fwd, rgt);
  vec3 rd = normalize(fwd * 1.28 + rgt * uv.x + upv * uv.y);

  float wallT;
  vec3 col = channel(ro, rd, uTime, cordN, twist, flow, wallT);
  if (wallT < 0.0) wallT = 1e9;

  /* nearest cell in front of the wall wins the pixel */
  float best = wallT;
  vec3 bn; vec2 bloc; vec3 bAx; int bi = -1;
  for (int i = 0; i < NCELL; i++){
    vec3 n; vec2 lc;
    float t = discHit(ro, rd, uCell[i].xyz, uCell[i].w, uCellAx[i], 0.34, n, lc);
    if (t > 0.0 && t < best){ best = t; bn = n; bloc = lc; bAx = uCellAx[i]; bi = i; }
  }

  if (bi >= 0){
    vec3 p = ro + rd * best;
    vec3 v = -rd;
    vec3 L1 = normalize(vec3( 0.45,  0.80, -0.40));
    vec3 L2 = normalize(vec3(-0.65,  0.25, -0.72));

    float diff = max(0.0, dot(bn, L1)) * 0.9 + max(0.0, dot(bn, L2)) * 0.35;
    float fres = pow(1.0 - max(0.0, dot(bn, v)), 3.0);

    /* the biconcave dimple: darker at the centre of the face, brightening to
       the rim. Driven by the radial coordinate, so it fades out as the cell
       turns edge-on — which is exactly how a real cell reads. */
    float face = 1.0 - abs(dot(bn, normalize(bAx)));
    float dip  = smoothstep(0.62, 0.0, bloc.x) * (1.0 - face);

    vec3 body = mix(RBC_MID, RBC_DEEP, dip * 0.85);
    vec3 cc = body * (0.30 + diff * 0.85);
    cc += RBC_RIM * fres * 0.55;
    cc += vec3(1.0, 0.88, 0.72) * pow(max(0.0, dot(reflect(-L1, bn), v)), 26.0) * 0.35;

    /* wall light bleeding through the thin rim of the cell */
    cc += RBC_RIM * smoothstep(0.80, 1.0, bloc.x) * 0.22;

    float fog = 1.0 - exp(-best * 0.085);
    cc = mix(cc, C_DEEP * 0.35, fog * 0.85);
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
  id: 'goldenCells',
  name: 'Golden cells',
  blurb:
    'Red blood cells drifting through a channel of golden fibre cords — rebuilt in code from the client reference. Real ellipsoid geometry with the biconcave dimple, correct occlusion, anisotropic metal on the cords.',
  placement:
    'Hero or full-bleed band. Warm and horizontal, with the darker upper region giving copy somewhere to sit.',
  bg: '#120E0B',
  extraUniforms: ['uCell', 'uCellAx'],
  params: {
    cords: { label: 'Cord count', min: 30, max: 160, step: 5, value: 88 },
    twist: { label: 'Cord twist', min: -60, max: 60, step: 5, value: 22 },
    drift: { label: 'Cell drift', min: 5, max: 90, step: 5, value: 30 },
    density: { label: 'Cell count', min: 4, max: 26, step: 1, value: 20 },
    size: { label: 'Cell size', min: 4, max: 16, step: 1, value: 9 },
    expo: { label: 'Exposure', min: 60, max: 170, step: 5, value: 105 },
  },
  frag,
  uniforms(gl, U, p, st) {
    const n = N;
    const cells = new Float32Array(n * 4);
    const axes = new Float32Array(n * 3);
    const live = p.density.value;
    const t = st.t;
    const speed = p.drift.value / 100;
    const r0 = p.size.value / 100;

    for (let i = 0; i < n; i++) {
      if (i >= live) {
        cells[i * 4 + 3] = -1; // radius < 0 → never hit
        axes[i * 3] = 0; axes[i * 3 + 1] = 1; axes[i * 3 + 2] = 0;
        continue;
      }
      /* deterministic scatter, so the field never re-randomises on a slider */
      const s = i * 12.9898;
      const h1 = Math.abs(Math.sin(s) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin(s + 1.7) * 22578.145) % 1;
      const h3 = Math.abs(Math.sin(s + 4.1) * 13141.77) % 1;

      const span = 16.0;
      /* travel toward the camera and wrap — the vessel never empties */
      const z = ((h1 * span + t * speed * 2.4) % span) - 1.2;
      const ang = h2 * Math.PI * 2 + t * 0.05;
      const rad = 0.18 + h3 * 0.62;

      cells[i * 4] = Math.cos(ang) * rad;
      cells[i * 4 + 1] = Math.sin(ang) * rad * 0.75 - 0.18;
      cells[i * 4 + 2] = z;
      cells[i * 4 + 3] = r0 * (0.72 + h3 * 0.62);

      /* each cell tumbles slowly on its own axis */
      const ax = t * (0.25 + h2 * 0.45) + h1 * 6.28;
      const ay = t * (0.18 + h3 * 0.38) + h2 * 6.28;
      const cxs = Math.cos(ax), sxs = Math.sin(ax);
      const cys = Math.cos(ay), sys = Math.sin(ay);
      axes[i * 3] = sxs * cys;
      axes[i * 3 + 1] = sys;
      axes[i * 3 + 2] = cxs * cys;
    }

    gl.uniform4fv(U.extra.uCell, cells);
    gl.uniform3fv(U.extra.uCellAx, axes);
    gl.uniform4f(U.p0, p.cords.value, p.twist.value / 1000, 0.06, p.expo.value / 100);
    gl.uniform4f(U.p1, 0, 0, 0, 0);
  },
});
