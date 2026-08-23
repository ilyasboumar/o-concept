/**
 * The golden fibre channel — shared environment for both cell scenes.
 *
 * The client's two reference renders share one set: the camera sits inside a
 * large vessel whose wall is made of parallel golden cords, sweeping away in
 * perspective and converging toward a vanishing point. Both animations differ
 * only in what drifts through it.
 *
 * Implementation notes that matter for quality:
 *
 * - The wall is an **analytic ray/cylinder intersection**, not a raymarch.
 *   Closed-form means no step artefacts, no surface acne, and it stays perfectly
 *   crisp at full device resolution — which is exactly what a raymarched or
 *   upscaled version could not deliver.
 * - Each cord is shaded as a real half-round section: the surface normal is bent
 *   across the cord's width, so the specular travels around it as the geometry
 *   turns. That rolling highlight is what reads as spun metal rather than as a
 *   striped texture.
 * - Cords are lit anisotropically (highlight stretched along the fibre), which
 *   is how brushed and drawn metal actually behaves.
 */

/** GLSL appended after GLSL_LIB, before each scene's own main(). */
export const CHANNEL_GLSL = `
vec3 C_DEEP   = vec3(0.055, 0.042, 0.030);
vec3 C_GOLD   = vec3(0.855, 0.686, 0.396);
vec3 C_LIGHT  = vec3(0.980, 0.898, 0.706);
vec3 C_BRONZE = vec3(0.451, 0.325, 0.184);

/* Ray vs. the inside of an infinite cylinder about the z axis.
   We are inside, so we want the forward exit hit. Returns -1.0 on miss. */
float cylHit(vec3 ro, vec3 rd, float R){
  float a = dot(rd.xy, rd.xy);
  if (a < 1e-6) return -1.0;
  float b = dot(ro.xy, rd.xy);
  float c = dot(ro.xy, ro.xy) - R * R;
  float disc = b * b - a * c;
  if (disc < 0.0) return -1.0;
  return (-b + sqrt(disc)) / a;
}

/**
 * Shade the channel wall for a ray.
 * cordN   how many cords around the circumference
 * twist   cords spiral along the vessel instead of running dead straight
 * flow    cords drift along the axis
 */
vec3 channel(vec3 ro, vec3 rd, float t, float cordN, float twist, float flow, out float hitT){
  float R = 1.0;
  hitT = cylHit(ro, rd, R);
  if (hitT < 0.0) return C_DEEP * 0.5;

  vec3 p = ro + rd * hitT;
  float ang = atan(p.y, p.x);
  float z = p.z;

  /* the cord lattice, spiralling and flowing */
  float u = (ang / 6.28318) * cordN + z * twist + t * flow;
  float cordPhase = fract(u) - 0.5;          // -0.5..0.5 across one cord
  float w = abs(cordPhase) * 2.0;            // 0 at crest, 1 at the seam

  /* half-round section: height and slope of the cord surface */
  float prof  = sqrt(max(0.0, 1.0 - w * w));
  float slope = (w < 1.0) ? (-cordPhase * 2.0) / max(prof, 0.12) : 0.0;

  /* frame on the cylinder wall */
  vec3 nRad = -normalize(vec3(p.xy, 0.0));            // inward
  vec3 tAng = normalize(vec3(-p.y, p.x, 0.0));        // around
  vec3 nCord = normalize(nRad + tAng * slope * 0.75); // bent across the cord
  vec3 fibre = normalize(vec3(0.0, 0.0, 1.0) + tAng * twist * 0.35);

  /* Two warm sources, aimed so their half-vectors land near the wall normal.
     Looking down the vessel the wall is almost edge-on, so lights with a large
     backward component never produce a highlight at all. */
  vec3 L1 = normalize(vec3( 0.25,  0.92,  0.30));
  vec3 L2 = normalize(vec3(-0.72,  0.34,  0.18));
  vec3 v  = -rd;

  float diff = max(0.0, dot(nCord, L1)) * 0.85 + max(0.0, dot(nCord, L2)) * 0.35;

  /* Blinn specular off the *cord* normal, not the fibre tangent.
     The earlier version used a classic anisotropic lobe along the fibre — which
     is right for brushed metal viewed broadside, and completely wrong here: the
     view runs parallel to the fibres, so the half-vector sits along the cord
     axis, sin(theta) stays small, and a high power drove the highlight to
     literally zero. Shading off nCord works because the normal sweeps across
     each cord's half-round section, so somewhere on every cord it lines up with
     the light and a highlight runs the length of the fibre. */
  vec3 h1 = normalize(L1 + v);
  vec3 h2 = normalize(L2 + v);
  float nh1 = max(0.0, dot(nCord, h1));
  float nh2 = max(0.0, dot(nCord, h2));

  float aniso  = pow(nh1, 16.0);
  float crest  = pow(nh1, 44.0);
  float aniso2 = pow(nh2, 7.0);

  /* seams between cords stay dark — this is what gives the wall its relief */
  float seam = smoothstep(0.86, 1.0, w);

  vec3 col = C_DEEP;
  col += C_GOLD  * diff * 0.78;
  col += C_LIGHT * aniso * 2.60 * prof;
  col += vec3(1.0) * crest * 1.35 * prof;             // the hot crest itself
  col += C_GOLD  * aniso2 * 0.55 * prof;
  col += C_BRONZE * prof * 0.16;
  col *= 1.0 - seam * 0.88;

  /* the vessel darkens with distance, which is what builds the depth */
  float fog = 1.0 - exp(-hitT * 0.085);
  col = mix(col, C_DEEP * 0.35, fog * 0.92);

  /* a soft pool of light near the camera keeps the foreground rich */
  col += C_GOLD * exp(-hitT * 0.30) * 0.10;

  return col;
}
`;
