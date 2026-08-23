/**
 * Motion lab controller — wires the page's controls to the scenes.
 * Lives only under /lab; nothing here is loaded by the website.
 */
import { mountScene } from './harness.js';
import goldenCells from './scenes/goldenCells.js';
import stemCells from './scenes/stemCells.js';
import helix from './scenes/helix.js';
import fusion from './scenes/fusion.js';
import strings from './scenes/strings.js';

const SCENES = { goldenCells, stemCells, helix, fusion, strings };

/* deep-ish clone so each panel owns its own live values and Reset has
   something honest to fall back to */
const cloneParams = (params) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { ...v }]));

const mounts = [];

document.querySelectorAll('[data-scene]').forEach((section) => {
  const scene = SCENES[section.dataset.scene];
  if (!scene) return;

  const canvas = section.querySelector('[data-canvas]');
  const fpsOut = section.querySelector('[data-fps]');
  const params = cloneParams(scene.params);
  const defaults = cloneParams(scene.params);

  const mount = mountScene({
    canvas,
    scene,
    params,
    onFps: (n) => {
      if (fpsOut) fpsOut.textContent = String(n);
    },
  });

  mounts.push({ section, mount, fpsOut });

  section.querySelectorAll('[data-param]').forEach((input) => {
    const key = input.dataset.param;
    const out = section.querySelector(`[data-out="${key}"]`);

    input.addEventListener('input', () => {
      params[key].value = Number(input.value);
      if (out) out.textContent = input.value;
      mount.refresh();
    });
  });

  section.querySelector('[data-reset]')?.addEventListener('click', () => {
    for (const [key, cfg] of Object.entries(defaults)) {
      params[key].value = cfg.value;
      const input = section.querySelector(`[data-param="${key}"]`);
      const out = section.querySelector(`[data-out="${key}"]`);
      if (input) input.value = String(cfg.value);
      if (out) out.textContent = String(cfg.value);
    }
    mount.refresh();
  });
});

/* Only the scene nearest the viewport centre runs. Keeps the page responsive
   with four full-size canvases on it, and means the fps figure each candidate
   reports is uncontended — otherwise they'd all be throttling each other and
   the numbers would say nothing about the candidate itself. */
let active = null;
function chooseActive() {
  const mid = window.innerHeight / 2;
  let best = null;
  let bestDist = Infinity;

  for (const m of mounts) {
    const r = m.section.querySelector('[data-canvas]').getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }

  if (best === active) return;
  for (const m of mounts) {
    const on = m === best;
    m.mount.setEnabled(on);
    if (!on && m.fpsOut) m.fpsOut.textContent = '—';
  }
  active = best;
}

let scrollTick = false;
const onScroll = () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    scrollTick = false;
    chooseActive();
  });
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
chooseActive();

/* Copy overlay. One scene renders the headline itself, so it opts out via
   its `ownsCopy` flag — laying the overlay on top would double the message. */
document.querySelectorAll('[data-owns-copy]').forEach((el) => el.setAttribute('hidden', ''));

const copyBtn = document.querySelector('[data-toggle-copy]');
copyBtn?.addEventListener('click', () => {
  const showing = copyBtn.getAttribute('aria-pressed') === 'true';
  document.querySelectorAll('[data-copy]:not([data-owns-copy])').forEach((el) => {
    el.toggleAttribute('hidden', showing);
  });
  copyBtn.setAttribute('aria-pressed', String(!showing));
  copyBtn.textContent = showing ? 'Show copy' : 'Hide copy';
});
