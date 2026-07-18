/**
 * The O Concept™ — treatments ↔ conditions data model.
 *
 * Single source of truth for:
 *  - the "Find Your Treatment" condition finder (homepage)
 *  - the /treatments grid
 *  - quiz result matching
 *  - MedicalProcedure JSON-LD structured data
 *
 * Every condition carries BOTH clinical and plain-language phrasing —
 * the plain phrasing is what patients actually type and search.
 */

export type Pathway = 'him' | 'her' | 'longevity';

export interface Condition {
  /** Clinical term, e.g. "Erectile dysfunction" */
  clinical: string;
  /** Plain-language phrasing patients actually use */
  plain: string;
}

export interface Treatment {
  slug: string;
  name: string;
  pathway: Pathway;
  tag: string;
  desc: string;
  conditions: Condition[];
  /**
   * Card imagery. Local files live in public/images/ and are stored here as
   * site-relative paths ("images/…") — prefix with withBase()/BASE_URL when
   * rendering. Stable drswclinics.com production hotlinks are stored as full
   * URLs and used verbatim.
   */
  image: string;
  /** Alt text for the card image */
  imageAlt: string;
}

export const PATHWAY_LABELS: Record<Pathway, string> = {
  him: 'For Him',
  her: 'For Her',
  longevity: 'Longevity',
};

export const treatments: Treatment[] = [
  {
    slug: 'p-shot',
    name: 'P-Shot®',
    pathway: 'him',
    tag: 'Regenerative',
    desc: 'Autologous platelet-rich plasma to regenerate vascular and erectile tissue — introduced to the UK by Dr Wakil.',
    image: 'images/tx-p-shot.webp',
    imageAlt: 'P-Shot® platelet-rich plasma treatment at Dr SW Clinics',
    conditions: [
      { clinical: 'Erectile dysfunction', plain: 'difficulty getting or keeping an erection' },
      { clinical: 'Peyronie’s disease', plain: 'curvature or scarring of the penis' },
      { clinical: 'Loss of sensitivity', plain: 'reduced sensation during intimacy' },
      { clinical: 'Post-prostatectomy rehabilitation', plain: 'recovery of function after prostate surgery' },
    ],
  },
  {
    slug: 'eswt',
    name: 'O Concept™ ESWT',
    pathway: 'him',
    tag: 'Energy-based',
    desc: 'Low-intensity extracorporeal shockwave therapy, stimulating new blood-vessel growth at the root cause.',
    image: 'images/tx-eswt.jpg',
    imageAlt: 'Low-intensity shockwave (ESWT) treatment for erectile dysfunction',
    conditions: [
      { clinical: 'Erectile dysfunction', plain: 'weaker or unreliable erections' },
      { clinical: 'Vasculogenic ED', plain: 'poor blood flow affecting performance' },
      { clinical: 'Peyronie’s disease', plain: 'curvature or plaque in the penis' },
    ],
  },
  {
    slug: 'bocox',
    name: 'Bocox™',
    pathway: 'him',
    tag: 'Injectable',
    desc: 'A targeted botulinum protocol improving blood flow and spontaneous function, with results lasting months.',
    image: 'images/tx-pe.jpg',
    imageAlt: 'Discreet clinical treatment for performance concerns at Dr SW Clinics',
    conditions: [
      { clinical: 'Erectile dysfunction', plain: 'difficulty with spontaneous erections' },
      { clinical: 'Premature ejaculation', plain: 'finishing sooner than you would like' },
      { clinical: 'Performance-related physical causes', plain: 'physical causes behind performance anxiety' },
    ],
  },
  {
    slug: 'endo-test',
    name: 'Endo Test',
    pathway: 'longevity',
    tag: 'Diagnostics',
    desc: 'Our comprehensive hormonal and metabolic panel — the evidence base on which every protocol is built.',
    image: 'images/tx-ed.jpg',
    imageAlt: 'Confidential diagnostic consultation at Dr SW Clinics, Harley Street',
    conditions: [
      { clinical: 'Andropause / low testosterone', plain: 'low energy, low drive, weight gain in men over 40' },
      { clinical: 'Hormonal imbalance', plain: 'feeling "off" — tired, flat, not yourself' },
      { clinical: 'Low libido', plain: 'loss of interest in intimacy' },
      { clinical: 'Unexplained fatigue', plain: 'tired all the time despite sleeping' },
    ],
  },
  {
    slug: 'o-concept-chair',
    name: 'O Concept™ Chair',
    pathway: 'him',
    tag: 'Non-invasive',
    desc: 'High-intensity electromagnetic pelvic-floor strengthening. Fully clothed, in a course of short sessions.',
    image: 'images/tx-chair.jpg',
    imageAlt: 'The O Concept™ Chair — electromagnetic pelvic-floor strengthening',
    conditions: [
      { clinical: 'Urinary incontinence', plain: 'leaking when you laugh, cough or exercise' },
      { clinical: 'Pelvic floor weakness', plain: 'weak pelvic muscles affecting control and performance' },
      { clinical: 'Erectile dysfunction', plain: 'erection quality linked to pelvic-floor strength' },
    ],
  },
  {
    slug: 'o-shot',
    name: 'O-Shot®',
    pathway: 'her',
    tag: 'Regenerative',
    desc: 'Platelet-rich plasma therapy for sensation, natural lubrication and urinary confidence — brought to the UK by Dr Wakil.',
    image: 'images/tx-o-shot.jpg',
    imageAlt: 'O-Shot® treatment for women at Dr SW Clinics',
    conditions: [
      { clinical: 'Loss of sensitivity', plain: 'reduced sensation or difficulty reaching orgasm' },
      { clinical: 'Vaginal dryness', plain: 'dryness or discomfort during intimacy' },
      { clinical: 'Urinary incontinence', plain: 'leaking when you laugh, cough or exercise' },
      { clinical: 'Low arousal', plain: 'finding it harder to become aroused' },
    ],
  },
  {
    slug: 'thermiva',
    name: 'ThermiVa',
    pathway: 'her',
    tag: 'Radiofrequency',
    desc: 'Gentle radiofrequency for tissue laxity and comfort, with no downtime and no anaesthetic required.',
    image: 'images/tx-thermiva.jpg',
    imageAlt: 'ThermiVa radiofrequency treatment at Dr SW Clinics',
    conditions: [
      { clinical: 'Vaginal laxity', plain: 'feeling of looseness, often after childbirth' },
      { clinical: 'Mild urinary incontinence', plain: 'small leaks with exercise or sneezing' },
      { clinical: 'Vulvovaginal discomfort', plain: 'discomfort or self-consciousness in intimate areas' },
    ],
  },
  {
    slug: 'co2re-intima',
    name: 'CO2RE Intima',
    pathway: 'her',
    tag: 'Laser',
    desc: 'Fractional CO2 laser restoring mucosal health — particularly valued after childbirth and through menopause.',
    image: 'images/tx-menopause.png',
    imageAlt: 'Treatment for menopause-related intimate symptoms',
    conditions: [
      { clinical: 'Genitourinary syndrome of menopause', plain: 'menopause symptoms — dryness, irritation, discomfort' },
      { clinical: 'Vaginal atrophy', plain: 'thinning, fragile intimate tissue' },
      { clinical: 'Post-natal changes', plain: 'changes after childbirth that never quite resolved' },
    ],
  },
  {
    slug: 'ultra-femme-360',
    name: 'Ultra Femme 360',
    pathway: 'her',
    tag: 'Radiofrequency',
    desc: 'Complete 360° radiofrequency rejuvenation, internal and external, in a course of comfortable eight-minute sessions.',
    image: 'images/tx-vaginal-rejuv.jpg',
    imageAlt: 'Radiofrequency vaginal rejuvenation treatment at Dr SW Clinics',
    conditions: [
      { clinical: 'Vaginal laxity', plain: 'laxity affecting comfort and confidence' },
      { clinical: 'Loss of sensitivity', plain: 'reduced sensation during intimacy' },
      { clinical: 'External skin laxity', plain: 'loss of tone in the external intimate area' },
    ],
  },
  {
    slug: 'clitoxin',
    name: 'Clitoxin™',
    pathway: 'her',
    tag: 'Signature',
    desc: 'A pioneering protocol developed by Dr Wakil to enhance sensation and ease of arousal — precise and discreet.',
    image: 'images/tx-prp-her.jpg',
    imageAlt: 'Clitoxin™ — sensation and arousal treatment for women',
    conditions: [
      { clinical: 'Anorgasmia', plain: 'difficulty reaching orgasm' },
      { clinical: 'Low arousal', plain: 'arousal that takes longer, or feels muted' },
      { clinical: 'Loss of sensitivity', plain: 'reduced clitoral sensation' },
    ],
  },
  {
    slug: 'dafne',
    name: 'DAFNE',
    pathway: 'her',
    tag: 'Signature',
    desc: 'Dr Wakil’s signature multi-layer rejuvenation of the external intimate area — tone, volume and skin quality.',
    image: 'images/tx-dafne.png',
    imageAlt: 'DAFNE — Dr Wakil’s signature external rejuvenation protocol',
    conditions: [
      { clinical: 'Vulval volume loss', plain: 'deflation or sagging of the external intimate area' },
      { clinical: 'Skin laxity', plain: 'crepey or lax intimate skin' },
      { clinical: 'Post-menopausal changes', plain: 'changes in appearance through menopause' },
    ],
  },
  {
    slug: 'hormone-optimisation',
    name: 'Hormone Optimisation',
    pathway: 'longevity',
    tag: 'Longevity',
    desc: 'Physician-led balancing of testosterone, thyroid and adrenal function — dosed from your diagnostics, reviewed continuously.',
    image: 'images/tx-p-shot-2.jpg',
    imageAlt: 'A couple restored to vitality — hormone optimisation at Dr SW Clinics',
    conditions: [
      { clinical: 'Andropause / low testosterone', plain: 'low energy, low drive, weight gain in men over 40' },
      { clinical: 'Menopause & perimenopause', plain: 'hot flushes, mood changes, disrupted sleep' },
      { clinical: 'Low libido', plain: 'loss of desire in men and women' },
      { clinical: 'Brain fog', plain: 'poor focus, low mood, mental fatigue' },
    ],
  },
  {
    slug: 'iv-nutrition',
    name: 'IV Nutritional Therapy',
    pathway: 'longevity',
    tag: 'Longevity',
    desc: 'Clinically formulated intravenous vitamin, mineral and amino-acid infusions — absorbed fully, felt quickly.',
    image: 'https://drswclinics.com/wp-content/uploads/2024/12/Homepage-9-e1733484520778.jpg',
    imageAlt: 'Clinical technology suite at Dr SW Clinics, Harley Street',
    conditions: [
      { clinical: 'Chronic fatigue', plain: 'exhaustion that rest doesn’t fix' },
      { clinical: 'Nutritional deficiency', plain: 'run down, slow recovery, frequent illness' },
      { clinical: 'Post-illness recovery', plain: 'rebuilding energy after illness or burnout' },
    ],
  },
  {
    slug: 'regenerative-medicine',
    name: 'Regenerative Cell Therapy',
    pathway: 'longevity',
    tag: 'Regenerative',
    desc: 'Stem cells, growth factors and the body’s own blood products, deployed to repair and renew tissue at source.',
    image: 'images/tx-cell-therapy.webp',
    imageAlt: 'Regenerative cell therapy — stem cells and growth factors',
    conditions: [
      { clinical: 'Tissue degeneration', plain: 'joints, skin and tissue ageing faster than you are' },
      { clinical: 'Erectile dysfunction', plain: 'restoring erectile tissue at the cellular level' },
      { clinical: 'Loss of sensitivity', plain: 'regenerating nerve and tissue response' },
    ],
  },
  {
    slug: 'weight-metabolic',
    name: 'Weight & Metabolic Programme',
    pathway: 'longevity',
    tag: 'Longevity',
    desc: 'Expert dietician programmes with hormonal-balance management — weight addressed as physiology, not willpower.',
    image: 'images/tx-lipogems.jpg',
    imageAlt: 'Metabolic and weight-management medicine at Dr SW Clinics',
    conditions: [
      { clinical: 'Weight gain / metabolic slowdown', plain: 'weight that won’t shift despite diet and exercise' },
      { clinical: 'Insulin resistance', plain: 'energy crashes and stubborn midsection weight' },
      { clinical: 'Hormonal weight gain', plain: 'weight gain in men over 40, or through menopause' },
    ],
  },
  {
    slug: 'life-optimisation',
    name: 'Life Optimisation & Coaching',
    pathway: 'longevity',
    tag: 'Longevity',
    desc: 'Bio-hacking, supplementation, life coaching and kinetic body-movement therapy — one integrated performance programme.',
    image: 'https://drswclinics.com/wp-content/uploads/2024/12/Homepage-8.jpg',
    imageAlt: 'The clinic environment at Dr SW Clinics, Harley Street',
    conditions: [
      { clinical: 'Suboptimal performance', plain: 'functioning, but nowhere near your best' },
      { clinical: 'Stress & burnout', plain: 'running on empty, mentally and physically' },
      { clinical: 'Healthy ageing', plain: 'staying strong, sharp and capable for decades' },
    ],
  },
];

/**
 * "Treatment of the Month" — page → featured treatment slug.
 * Swapping the monthly feature is a one-line change here.
 */
export const featured: Record<'for-him' | 'for-her' | 'longevity' | 'treatments', string> = {
  'for-him': 'p-shot',
  'for-her': 'o-shot',
  longevity: 'regenerative-medicine',
  treatments: 'p-shot',
};

/** Flat, de-duplicated list of conditions for chips & search */
export function allConditions(): Condition[] {
  const seen = new Set<string>();
  const out: Condition[] = [];
  for (const t of treatments) {
    for (const c of t.conditions) {
      if (!seen.has(c.clinical)) {
        seen.add(c.clinical);
        out.push(c);
      }
    }
  }
  return out;
}

/** Case-insensitive search across names, clinical + plain condition language */
export function findTreatments(query: string): Treatment[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return treatments.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.conditions.some((c) => c.clinical.toLowerCase().includes(q) || c.plain.toLowerCase().includes(q))
  );
}

export function treatmentsByPathway(pathway: Pathway): Treatment[] {
  return treatments.filter((t) => t.pathway === pathway);
}
