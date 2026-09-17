/**
 * Treatment placeholders — fill them in, or take them out.
 *
 *   npm run placeholders:fill     every section visible, marked as a placeholder
 *   npm run placeholders:clear    only what has actually been written
 *
 * Two audiences need opposite things from the same content. Building the site,
 * you need to see every section a treatment page can have, whether or not
 * anyone has written it yet — a page that renders four sections tells you
 * nothing about the five it is hiding. Patients need the opposite: a page that
 * shows only what the clinic has actually said.
 *
 * So this is a switch rather than a decision. Fill while the structure is being
 * reviewed; clear before the content goes to patients.
 *
 * Two rules keep it safe to run either way:
 *
 *   1. FILL NEVER OVERWRITES. A field with real writing in it is left alone, so
 *      running fill on a finished treatment adds nothing and breaks nothing.
 *   2. CLEAR ONLY REMOVES ITS OWN MARK. Every placeholder contains the literal
 *      word "placeholder" in brackets, and clear removes exactly those — it can
 *      never take out a sentence the clinic wrote. Anything left half-empty
 *      afterwards is pruned, because the site renders only complete rows.
 *
 * The hero background image is deliberately not filled: the page falls back to
 * the treatment's own photograph, which looks like the finished design, and
 * swapping in a grey rectangle would make sixteen pages look broken to make one
 * CMS field visible — the field is visible in CloudCannon regardless.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/treatments';
const PHOTO = 'images/placeholder-photo.webp';

/**
 * The mark that says "nobody wrote this".
 *
 * It matches the bracketed word itself, in either wording, so the text can read
 * however it likes to whoever is reviewing the structure — what clear looks for
 * is the bracket and the word, never the sentence around it. Matching on the
 * exact phrase is what broke the first version of this: the placeholders read
 * "(this is a placeholder — …)", the pattern looked for "(placeholder", and
 * clear silently found nothing to remove.
 */
const PLACEHOLDER = /\((?:this is a |a )?placeholder\b/i;

const isPlaceholder = (v) => typeof v === 'string' && PLACEHOLDER.test(v);
const written = (v) => typeof v === 'string' && v.trim() && !isPlaceholder(v);
const P = (what) => `(this is a placeholder — ${what})`;

/* What a fully-structured treatment looks like. Only missing pieces are added. */
const TEMPLATE = {
  intro: P('the opening paragraph a patient reads first'),
  facts: {
    duration: P('how long a session takes'),
    sessions: P('how many sessions'),
    downtime: P('downtime'),
    anaesthetic: P('anaesthetic'),
    results: P('when results appear'),
  },
  price: {
    from: P('the price'),
    unit: P('what the price covers'),
    finance: P('finance terms'),
    note: P('the note under the price'),
  },
  benefits: [1, 2, 3, 4].map((n) => P(`reason ${n} a patient chooses this treatment`)),
  howItWorks: [1, 2, 3, 4].map((n) => ({
    title: P(`step ${n}`),
    detail: P(`what happens in step ${n}`),
  })),
  faqs: [1, 2, 3].map((n) => ({
    q: P(`question ${n} patients ask about this treatment`),
    a: P(`the answer to question ${n}, in plain language`),
  })),
  show: {
    practicalFacts: true,
    steps: true,
    whyChoose: true,
    photographs: true,
    questions: true,
    reassurance: true,
  },
};

/* Two extra photographs, so every page shows both states of the consent tick:
   an ordinary clinic photograph, and one held behind the 18+ gate. */
const GALLERY = [
  { image: PHOTO, alt: P('an ordinary clinic photograph'), caption: P('a caption'), sensitive: false },
  {
    image: PHOTO,
    alt: P('a clinical photograph, held behind the consent gate'),
    caption: P('a caption — this one needs consent'),
    sensitive: true,
  },
];

function fill(t) {
  if (!written(t.intro)) t.intro = TEMPLATE.intro;

  t.facts = { ...TEMPLATE.facts, ...Object.fromEntries(Object.entries(t.facts ?? {}).filter(([, v]) => written(v))) };
  t.price = { ...TEMPLATE.price, ...Object.fromEntries(Object.entries(t.price ?? {}).filter(([, v]) => written(v))) };

  const realBenefits = (t.benefits ?? []).filter(written);
  t.benefits = realBenefits.length ? realBenefits : TEMPLATE.benefits;

  const realSteps = (t.howItWorks ?? []).filter((s) => written(s.title) && written(s.detail));
  t.howItWorks = realSteps.length ? realSteps : TEMPLATE.howItWorks;

  const realFaqs = (t.faqs ?? []).filter((f) => written(f.q) && written(f.a));
  t.faqs = realFaqs.length ? realFaqs : TEMPLATE.faqs;

  /* keep every real photograph, and make sure both consent states are shown */
  const realPhotos = (t.gallery ?? []).filter((g) => g.image && !g.image.includes('placeholder-photo'));
  const hasGated = realPhotos.some((g) => g.sensitive);
  t.gallery = [...realPhotos, ...(hasGated ? [GALLERY[0]] : GALLERY)];

  t.show = { ...TEMPLATE.show, ...(t.show ?? {}) };
  return t;
}

function clear(t) {
  if (isPlaceholder(t.intro)) delete t.intro;

  for (const key of ['facts', 'price']) {
    if (!t[key]) continue;
    const kept = Object.fromEntries(Object.entries(t[key]).filter(([, v]) => written(v)));
    if (Object.keys(kept).length) t[key] = kept;
    else delete t[key];
  }
  /* a price block with no price is an empty box labelled "Investment" */
  if (t.price && !written(t.price.from)) delete t.price;

  const prune = (key, keep) => {
    const kept = (t[key] ?? []).filter(keep);
    if (kept.length) t[key] = kept;
    else delete t[key];
  };
  prune('benefits', written);
  prune('howItWorks', (s) => written(s.title) && written(s.detail));
  prune('faqs', (f) => written(f.q) && written(f.a));
  prune('gallery', (g) => g.image && !g.image.includes('placeholder-photo'));
  if (t.gallery) {
    t.gallery = t.gallery.map((g) => {
      const out = { image: g.image, alt: written(g.alt) ? g.alt : t.imageAlt };
      if (written(g.caption)) out.caption = g.caption;
      if (g.sensitive) out.sensitive = true;
      return out;
    });
  }
  return t;
}

const mode = process.argv[2];
if (!['fill', 'clear'].includes(mode)) {
  console.error('Usage: node scripts/placeholders.mjs fill|clear');
  process.exit(1);
}

let changed = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(DIR, file);
  const before = readFileSync(path, 'utf8');
  const after = JSON.stringify((mode === 'fill' ? fill : clear)(JSON.parse(before)), null, 2) + '\n';
  if (before !== after) {
    writeFileSync(path, after);
    changed++;
  }
  const t = JSON.parse(after);
  const sections = ['intro', 'facts', 'price', 'benefits', 'howItWorks', 'faqs', 'gallery'].filter((k) => t[k]);
  console.log(`  ${t.name.padEnd(30)} ${sections.length}/7 sections${mode === 'fill' ? '' : ' written'}`);
}
console.log(`\n${mode === 'fill' ? 'Filled' : 'Cleared'} — ${changed} file(s) changed.`);
if (mode === 'fill') console.log('Run `npm run placeholders:clear` before the content goes live.');
