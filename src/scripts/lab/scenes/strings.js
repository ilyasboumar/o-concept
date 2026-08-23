/**
 * INTERTWINING LIGHT STRINGS
 *
 * Jewellery-gauge threads of gold and copper weaving into an endless loop, with
 * pulses of light travelling along them and soft bokeh drifting behind.
 *
 * Canvas rather than a shader on purpose: the look here is thin bright lines
 * over dark, and the two things that sell it — real motion blur and out-of-focus
 * bokeh — are cheap here and awkward in a fragment shader. The blur is a true
 * accumulation buffer: instead of clearing, each frame washes the previous one
 * toward the background, so every thread drags a genuine trail rather than a
 * faked smear.
 *
 * The strands are a torus-knot weave in 3D, projected with perspective and
 * lit by depth — nearer thread is thicker, brighter and warmer, which is what
 * gives a flat canvas the illusion of a solid object turning in space.
 */
import { rand, TAU, LUX, rgba } from '../harness.js';

const STRAND_TONES = [LUX.champagne, LUX.gold, LUX.roseGold, LUX.bronze];

export default {
  id: 'strings',
  name: 'Intertwining light strings',
  blurb:
    'Fine gold and copper threads weaving an endless loop, with pulses of light travelling along them and bokeh drifting behind. Real motion blur from an accumulation buffer.',
  placement:
    'Works small — a side panel, a card, or beside a headline. The only candidate that keeps its character at modest size.',
  bg: '#141010',

  params: {
    strands: { label: 'Threads', min: 2, max: 10, step: 1, value: 5 },
    weave: { label: 'Weave', min: 2, max: 9, step: 1, value: 3 },
    spin: { label: 'Rotation', min: 2, max: 60, step: 2, value: 16 },
    blur: { label: 'Motion blur', min: 0, max: 95, step: 5, value: 70 },
    pulses: { label: 'Light pulses', min: 0, max: 40, step: 2, value: 14 },
    bokeh: { label: 'Bokeh', min: 0, max: 40, step: 2, value: 14 },
  },

  create(ctx, w, h, p) {
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.30;
    const SEG = 190;

    const strands = Array.from({ length: p.strands.value }, (_, i) => ({
      phase: (i / p.strands.value) * TAU,
      tone: STRAND_TONES[i % STRAND_TONES.length],
      wob: rand(0, TAU),
    }));

    const pulses = Array.from({ length: p.pulses.value }, () => ({
      s: (Math.random() * p.strands.value) | 0,
      u: Math.random(),
      v: rand(0.05, 0.16),
      len: rand(0.012, 0.045),
    }));

    const bokeh = Array.from({ length: p.bokeh.value }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(h * 0.03, h * 0.10),
      a: rand(0.02, 0.07),
      vx: rand(-4, 4),
      vy: rand(-3, 3),
      tone: Math.random() < 0.5 ? LUX.champagne : LUX.roseGold,
    }));

    let t = 0;

    /* point on strand `s` at parameter u, already rotated and projected */
    const project = (s, u, rotY, rotX) => {
      const a = u * TAU;
      const q = p.weave.value;
      const rr = R * 0.30;
      const ring = R + rr * Math.cos(q * a + s.phase);

      let x = Math.cos(a) * ring;
      let y = Math.sin(a) * ring;
      let z = rr * Math.sin(q * a + s.phase) + Math.sin(a * 2 + s.wob) * R * 0.10;

      // rotate Y then X
      let x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
      let z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
      let y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
      let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

      const camZ = R * 4.2;
      const k = camZ / (camZ - z2);
      return { x: cx + x1 * k, y: cy + y1 * k, k, depth: z2 / R };
    };

    return {
      step(dt) {
        t += dt;
        const rotY = t * (p.spin.value / 100) * 0.9;
        const rotX = Math.sin(t * (p.spin.value / 100) * 0.35) * 0.5;

        /* accumulation buffer: wash toward the ground instead of clearing.
           This is the motion blur — the trails are real, not drawn. */
        const keep = p.blur.value / 100;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(LUX.obsidian, 1 - keep * 0.92);
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';

        /* bokeh sits behind everything, permanently out of focus */
        for (const b of bokeh) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < -b.r) b.x = w + b.r;
          if (b.x > w + b.r) b.x = -b.r;
          if (b.y < -b.r) b.y = h + b.r;
          if (b.y > h + b.r) b.y = -b.r;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, rgba(b.tone, b.a));
          g.addColorStop(0.6, rgba(b.tone, b.a * 0.35));
          g.addColorStop(1, rgba(b.tone, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, TAU);
          ctx.fill();
        }

        /* the threads */
        ctx.lineCap = 'round';
        for (const s of strands) {
          let prev = project(s, 0, rotY, rotX);
          for (let i = 1; i <= SEG; i++) {
            const cur = project(s, i / SEG, rotY, rotX);
            // depth shading: near thread is thicker, brighter, warmer
            const dep = (cur.depth + 1) * 0.5;
            const alpha = 0.10 + dep * 0.42;
            ctx.strokeStyle = rgba(s.tone, alpha);
            ctx.lineWidth = Math.max(0.35, 0.5 + dep * 1.5);
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();
            prev = cur;
          }
        }

        /* pulses travelling the wire */
        for (const pu of pulses) {
          pu.u = (pu.u + pu.v * dt) % 1;
          const s = strands[pu.s % strands.length];
          if (!s) continue;
          const head = project(s, pu.u, rotY, rotX);
          const dep = (head.depth + 1) * 0.5;

          // short bright tail along the thread
          for (let j = 0; j < 6; j++) {
            const u2 = (pu.u - (j / 6) * pu.len + 1) % 1;
            const q = project(s, u2, rotY, rotX);
            const fade = (1 - j / 6) * (0.25 + dep * 0.75);
            ctx.strokeStyle = rgba(LUX.pearl, fade * 0.5);
            ctx.lineWidth = Math.max(0.5, 1.0 + dep * 1.6);
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            const q2 = project(s, (u2 + 0.004) % 1, rotY, rotX);
            ctx.lineTo(q2.x, q2.y);
            ctx.stroke();
          }

          const rr = (2.5 + dep * 5) * head.k * 0.6;
          const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, rr * 3);
          g.addColorStop(0, rgba(LUX.pearl, 0.5 * (0.3 + dep)));
          g.addColorStop(0.35, rgba(LUX.champagne, 0.28 * (0.3 + dep)));
          g.addColorStop(1, rgba(LUX.champagne, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(head.x, head.y, rr * 3, 0, TAU);
          ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
      },
      destroy() {
        strands.length = 0;
        pulses.length = 0;
        bokeh.length = 0;
      },
    };
  },
};
