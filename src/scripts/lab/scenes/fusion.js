/**
 * LIQUID GOLD & SILK FUSION
 *
 * Two ribbon streams of molten champagne drift in zero gravity, swirl around
 * one another, then fuse into a single sphere that ripples and slowly parts
 * again. The whole loop breathes.
 *
 * This is raymarched rather than drawn, because the brief is about *material*
 * — reflection, fresnel, the way light rolls across a curved metal surface.
 * You cannot fake that with 2D strokes. The streams are metaball chains blended
 * with a smooth minimum, which is why they merge like liquid instead of
 * intersecting like solids: surface tension comes free from the blend.
 *
 * Rendered below display resolution on purpose (`resScale`). That IS the
 * soft-focus optic the direction asks for — a shallow, expensive-looking depth
 * of field rather than a sharp CGI edge — and it buys the frame budget the
 * march needs.
 *
 * No teal, no clinical white: champagne and rose gold on warm obsidian.
 */
import { makeShaderScene } from '../webgl.js';

const frag = `
vec3 OBSIDIAN = vec3(0.078, 0.063, 0.055);
vec3 CHAMPAGNE= vec3(0.890, 0.788, 0.573);
vec3 ROSEGOLD = vec3(0.878, 0.659, 0.600);
vec3 BRONZE   = vec3(0.659, 0.486, 0.310);
vec3 PEARL    = vec3(0.949, 0.914, 0.894);

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// a node on one of the two streams
vec3 node(float i, float side, float t, float fuse){
  float ph  = i * 1.25 + t * 0.85 * side;
  float sep = mix(1.75, 0.0, fuse) * (1.0 - i * 0.10);
  float rad = mix(0.62, 0.26, fuse);
  return vec3(
    side * sep + cos(ph) * rad * 0.62,
    sin(ph) * rad * 0.86 + sin(t * 0.6 + i) * 0.05,
    cos(ph * 0.8 + side * 1.6) * rad * 0.70
  );
}

float map(vec3 p, float t, float fuse){
  float k = 0.46;
  float d = 1e9;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float r = mix(0.22, 0.36, fuse) + 0.045 * sin(fi * 2.3);
    d = smin(d, length(p - node(fi, -1.0, t, fuse)) - r, k);
    d = smin(d, length(p - node(fi,  1.0, t, fuse)) - r, k);
  }
  // surface ripple once fused — the fluid settling
  d += sin(p.x * 11.0 + p.y * 9.0 - t * 3.2) * 0.010 * fuse;
  return d;
}

vec3 normalAt(vec3 p, float t, float fuse){
  vec2 e = vec2(1.0, -1.0) * 0.0022;
  return normalize(
    e.xyy * map(p + e.xyy, t, fuse) +
    e.yyx * map(p + e.yyx, t, fuse) +
    e.yxy * map(p + e.yxy, t, fuse) +
    e.xxx * map(p + e.xxx, t, fuse));
}

/**
 * Warm studio environment — the only light this metal ever sees.
 *
 * Broad, soft lobes on purpose. Tight exponents give a physically plausible
 * metal in a dark room, which renders as a dark blob with one hot spot; a
 * jewellery shoot uses large diffused softboxes, so most of the surface stays
 * lit and the form reads. Big soft key, warm fill, cool-ish pearl rim.
 */
vec3 env(vec3 r){
  float key  = pow(max(0.0, dot(r, normalize(vec3( 0.55, 0.72, 0.42)))), 1.7);
  float fill = pow(max(0.0, dot(r, normalize(vec3(-0.62, 0.28, 0.55)))), 1.4);
  float rim  = pow(max(0.0, dot(r, normalize(vec3( 0.10,-0.85, -0.5)))), 3.0);
  float spec = pow(max(0.0, dot(r, normalize(vec3( 0.55, 0.72, 0.42)))), 22.0);
  vec3 c = OBSIDIAN * 0.9;
  c += CHAMPAGNE * key  * 1.05;
  c += ROSEGOLD  * fill * 0.55;
  c += PEARL     * rim  * 0.30;
  c += PEARL     * spec * 1.10;              // the tight glint on the crest
  c += mix(BRONZE * 0.30, CHAMPAGNE * 0.42, r.y * 0.5 + 0.5);
  return c;
}

void main(){
  vec2 px = gl_FragCoord.xy;
  vec2 uv = (px - 0.5 * uRes.xy) / uRes.y;

  float flow    = uP0.x;
  float steps   = uP0.y;
  float glow    = uP0.z;
  float rose    = uP0.w;
  float cycle   = uP1.x;
  float radius  = uP1.y;

  float t = uTime * flow;

  // fuse cycles: apart -> together -> hold -> apart
  float ph = fract(uTime * cycle);
  float fuse = smoothstep(0.10, 0.42, ph) - smoothstep(0.66, 0.96, ph);

  // the pointer nudges the whole mass, so it feels suspended in fluid
  float e = wake(px, radius);
  vec3 ro = vec3(0.0, 0.0, 3.7);
  vec3 rd = normalize(vec3(uv * 1.15, -1.45));
  ro.xy += vec2(e * 0.10, e * -0.06);

  float d = 0.0;
  float hit = 0.0;
  vec3 p = ro;
  for (int i = 0; i < 64; i++){
    if (float(i) > steps) break;
    p = ro + rd * d;
    float s = map(p, t, fuse);
    if (s < 0.0016){ hit = 1.0; break; }
    d += s * 0.82;
    if (d > 9.0) break;
  }

  vec3 col = OBSIDIAN;

  if (hit > 0.5){
    vec3 n = normalAt(p, t, fuse);
    vec3 v = -rd;
    vec3 r = reflect(rd, n);

    float fres = pow(1.0 - max(0.0, dot(n, v)), 3.4);

    // metal: reflection carries almost everything
    vec3 base = mix(CHAMPAGNE, ROSEGOLD, rose);
    vec3 spec = env(r) * base;
    col = spec * (0.90 + 0.65 * fres);

    // a little internal warmth so it reads as liquid, not chrome
    float sss = pow(max(0.0, dot(n, normalize(vec3(0.4, 0.5, 0.7)))), 1.6);
    col += base * sss * 0.30;

    // rim light along the silhouette
    col += PEARL * pow(fres, 1.6) * 0.45;

    // A nucleus forms as the two masses become one. This is what separates
    // "cell fusion" from "two blobs touching" — without a core it is a
    // pretty abstraction with no biology in it.
    float coreD = length(p);
    col += mix(ROSEGOLD, CHAMPAGNE, 0.35) * exp(-coreD * 3.2) * 0.65 * fuse;
    col += PEARL * exp(-coreD * 6.0) * 0.35 * fuse;

    // brighter while fusing — the moment of contact
    col += base * fuse * 0.10;
    col += base * e * 0.22;
  } else {
    // ambient bloom bleeding off the mass into the dark
    float g = 0.0;
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      g += 0.055 / (0.06 + length(uv - node(fi, -1.0, t, fuse).xy * 0.42));
      g += 0.055 / (0.06 + length(uv - node(fi,  1.0, t, fuse).xy * 0.42));
    }
    col += mix(CHAMPAGNE, ROSEGOLD, rose) * g * 0.055 * glow;
  }

  // grade: warm, deep, uncluttered
  col = pow(max(col, 0.0), vec3(0.92));
  float vig = 1.0 - 0.42 * pow(length(uv) * 0.86, 2.2);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default makeShaderScene({
  id: 'fusion',
  name: 'Cell fusion in liquid gold',
  blurb:
    'Platelets and stem cells as molten champagne — two streams drift in zero gravity, fuse into a single mass, and a nucleus lights inside it. Raymarched metal: real reflection, fresnel and surface tension.',
  placement:
    'Hero centrepiece, or a band introducing PRP. The fuse — the moment two become one — is the beat to time a line of copy against.',
  bg: '#141010',
  resScale: 0.7,
  params: {
    flow: { label: 'Motion', min: 5, max: 100, step: 5, value: 32 },
    cycle: { label: 'Fusion cycle', min: 2, max: 30, step: 1, value: 7 },
    rose: { label: 'Rose gold ↔ champagne', min: 0, max: 100, step: 5, value: 35 },
    glow: { label: 'Ambient bloom', min: 0, max: 200, step: 10, value: 100 },
    radius: { label: 'Pointer drift', min: 60, max: 520, step: 20, value: 300 },
    steps: { label: 'Quality', min: 24, max: 64, step: 4, value: 48 },
  },
  frag,
  uniforms(gl, U, p) {
    gl.uniform4f(U.p0, p.flow.value / 100, p.steps.value, p.glow.value / 100, p.rose.value / 100);
    gl.uniform4f(U.p1, 1 / p.cycle.value, p.radius.value, 0, 0);
  },
});
