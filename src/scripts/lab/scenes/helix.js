/**
 * THE GOLDEN HELIX — DNA as fine jewellery.
 *
 * This is the synthesis the other candidates kept missing. The first round had
 * the right subject (DNA, stem cell, regeneration) and rendered it like a
 * textbook. The second round had the right register (molten gold, pearl,
 * zero gravity) and threw the subject away — beautiful, but it could have been
 * a perfume ad.
 *
 * Here the subject IS the jewellery: two strands of jewellery-gauge gold wire
 * spiralling in soft focus, base pairs strung between them like set pearls,
 * light pulses running the backbone. Unmistakably DNA, unmistakably luxury,
 * and nothing about it reads as clinical.
 *
 * "A place where you come to be regenerated" is the interaction: the helix is
 * dim and incomplete at rest. A regeneration front travels it, and wherever the
 * visitor moves, that stretch completes — rungs set themselves, the wire warms
 * from bronze to champagne, and the light holds before fading back.
 *
 * Canvas rather than a shader: the two things that make it expensive — true
 * motion blur from an accumulation buffer, and depth-of-field bokeh — are cheap
 * here and awkward in a fragment shader. Depth drives width, brightness and
 * glow, which is what turns flat strokes into an object turning in space.
 */
import { rand, TAU, LUX, rgba } from '../harness.js';

export default {
  id: 'helix',
  name: 'The golden helix — DNA as jewellery',
  blurb:
    'Two strands of gold wire spiralling in soft focus, base pairs set like pearls between them, light running the backbone. Dim and incomplete at rest — it completes wherever you move.',
  placement:
    'The hero. It is the brand mark, the science and the luxury register in one object, and it replaces the existing clinical DNA hero rather than sitting next to it.',
  bg: '#141010',

  params: {
    turns: { label: 'Turns', min: 1.5, max: 8, step: 0.5, value: 3.5 },
    radius: { label: 'Helix width', min: 10, max: 45, step: 1, value: 26 },
    rungs: { label: 'Base pairs', min: 8, max: 70, step: 2, value: 34 },
    spin: { label: 'Rotation', min: 2, max: 50, step: 2, value: 14 },
    blur: { label: 'Motion blur', min: 0, max: 95, step: 5, value: 62 },
    reach: { label: 'Regeneration reach', min: 60, max: 500, step: 20, value: 240 },
    bokeh: { label: 'Bokeh', min: 0, max: 30, step: 2, value: 12 },
  },

  create(ctx, w, h, p) {
    const cx = w / 2;
    const cy = h / 2;
    const SEG = 260;
    const H = h * 0.86;
    const R = Math.min(w, h) * (p.radius.value / 100);
    const camZ = Math.max(w, h) * 1.5;

    /* per-rung regeneration state: 0 = bare wire, 1 = pearl set and lit */
    const rungs = Array.from({ length: p.rungs.value }, (_, i) => ({
      u: (i + 0.5) / p.rungs.value,
      e: 0,
      seed: rand(0, TAU),
    }));

    const bokeh = Array.from({ length: p.bokeh.value }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(h * 0.035, h * 0.11),
      a: rand(0.025, 0.075),
      vx: rand(-5, 5),
      vy: rand(-4, 4),
      tone: Math.random() < 0.55 ? LUX.champagne : LUX.roseGold,
    }));

    const pointer = { x: -9999, y: -9999, on: false };
    const onMove = (e) => {
      const r = ctx.canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
    };
    const onLeave = () => (pointer.on = false);
    ctx.canvas.addEventListener('pointermove', onMove);
    ctx.canvas.addEventListener('pointerleave', onLeave);

    let t = 0;

    /* a point on strand `side` at parameter u, projected */
    const at = (u, side, rot) => {
      const a = u * p.turns.value * TAU + rot + (side > 0 ? Math.PI : 0);
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const y = (u - 0.5) * H;
      const k = camZ / (camZ - z);
      return { x: cx + x * k, y: cy + y * k, k, depth: z / R };
    };

    return {
      step(dt) {
        t += dt;
        const rot = t * (p.spin.value / 100);

        /* accumulation buffer — real motion blur, not a smear */
        const keep = p.blur.value / 100;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(LUX.obsidian, 1 - keep * 0.9);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        /* out-of-focus depth of field behind everything */
        for (const b of bokeh) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < -b.r) b.x = w + b.r;
          if (b.x > w + b.r) b.x = -b.r;
          if (b.y < -b.r) b.y = h + b.r;
          if (b.y > h + b.r) b.y = -b.r;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, rgba(b.tone, b.a));
          g.addColorStop(0.55, rgba(b.tone, b.a * 0.4));
          g.addColorStop(1, rgba(b.tone, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, TAU);
          ctx.fill();
        }

        /* the regeneration front: a band travelling the helix, plus wherever
           the visitor is. Rungs hold their light briefly, then fade. */
        const front = (t * 0.19) % 1.25 - 0.16;
        for (const rg of rungs) {
          const near = 1 - Math.min(1, Math.abs(rg.u - front) / 0.18);
          if (near > 0) rg.e = Math.max(rg.e, near);

          if (pointer.on) {
            const a = at(rg.u, -1, rot);
            const b = at(rg.u, 1, rot);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const d = Math.hypot(mx - pointer.x, my - pointer.y);
            const k = 1 - Math.min(1, d / p.reach.value);
            if (k > 0) rg.e = Math.max(rg.e, k * k);
          }
          rg.e = Math.max(0, rg.e - dt * 0.28);
        }

        /* mean energy drives how warm the whole piece reads */
        let meanE = 0;
        for (const rg of rungs) meanE += rg.e;
        meanE /= Math.max(1, rungs.length);

        /* --- base pairs, drawn before the wire so the wire sits on top --- */
        for (const rg of rungs) {
          const a = at(rg.u, -1, rot);
          const b = at(rg.u, 1, rot);
          const dep = ((a.depth + b.depth) * 0.5 + 1) * 0.5;
          const e = rg.e;

          // the bar between the strands
          ctx.strokeStyle = rgba(LUX.bronze, (0.10 + e * 0.30) * (0.35 + dep * 0.65));
          ctx.lineWidth = Math.max(0.3, (0.5 + dep * 1.1) * (0.6 + e * 0.8));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          if (e <= 0.02) continue;

          // the set pearl at the centre of the pair
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const breath = 1 + Math.sin(t * 1.8 + rg.seed) * 0.12;
          const pr = (1.1 + dep * 2.3) * breath * (0.4 + e * 0.9);

          const g = ctx.createRadialGradient(mx, my, 0, mx, my, pr * 5);
          g.addColorStop(0, rgba(LUX.pearl, 0.55 * e));
          g.addColorStop(0.3, rgba(LUX.champagne, 0.28 * e));
          g.addColorStop(1, rgba(LUX.champagne, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(mx, my, pr * 5, 0, TAU);
          ctx.fill();

          ctx.fillStyle = rgba(LUX.pearl, 0.35 + e * 0.5);
          ctx.beginPath();
          ctx.arc(mx, my, pr, 0, TAU);
          ctx.fill();
        }

        /* --- the two gold backbones --- */
        for (const side of [-1, 1]) {
          let prev = at(0, side, rot);
          for (let i = 1; i <= SEG; i++) {
            const u = i / SEG;
            const cur = at(u, side, rot);
            const dep = (cur.depth + 1) * 0.5;

            /* local energy from the nearest rungs — the wire warms where the
               helix has regenerated */
            let e = 0;
            for (const rg of rungs) {
              const d = Math.abs(rg.u - u);
              if (d < 0.05) e = Math.max(e, rg.e * (1 - d / 0.05));
            }

            // bronze when dormant, champagne when regenerated
            const tone = e > 0.35 ? LUX.champagne : e > 0.12 ? LUX.gold : LUX.bronze;
            const alpha = (0.13 + dep * 0.36) * (0.62 + e * 0.72);

            ctx.strokeStyle = rgba(tone, alpha);
            ctx.lineWidth = Math.max(0.4, (0.7 + dep * 2.0) * (0.75 + e * 0.5));
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();

            // near, regenerated wire catches a highlight
            if (dep > 0.72 && e > 0.3) {
              ctx.strokeStyle = rgba(LUX.pearl, (dep - 0.72) * e * 0.9);
              ctx.lineWidth = Math.max(0.3, 0.5 + dep * 0.8);
              ctx.stroke();
            }
            prev = cur;
          }
        }

        /* a soft warm halo behind the whole piece, breathing with the energy */
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.42);
        halo.addColorStop(0, rgba(LUX.champagne, 0.030 + meanE * 0.055));
        halo.addColorStop(1, rgba(LUX.champagne, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'source-over';
      },
      destroy() {
        ctx.canvas.removeEventListener('pointermove', onMove);
        ctx.canvas.removeEventListener('pointerleave', onLeave);
        rungs.length = 0;
        bokeh.length = 0;
      },
    };
  },
};
