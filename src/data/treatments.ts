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

  /* ---------- the treatment's own page ----------
     Everything below is optional. A treatment with none of it still renders a
     complete page from the fields above — which is what lets Dr Wakil add a
     treatment today and finish writing it next week. */

  /** Opening paragraph on the page. Falls back to `desc`. */
  intro?: string;

  /** The practical questions patients ask first. Any subset renders. */
  facts?: {
    duration?: string;
    sessions?: string;
    downtime?: string;
    anaesthetic?: string;
    results?: string;
  };

  /** Pricing. Deliberately a string, not a number — clinics quote ranges,
      "from", and "confirmed at consultation", and a number invites a
      precision the clinic may not want published. */
  price?: {
    from?: string;
    note?: string;
  };

  /** Why a patient would choose it. */
  benefits?: string[];

  /** The steps of a session, in order. */
  howItWorks?: { title: string; detail: string }[];

  /** Page-specific questions. Also feeds FAQ structured data. */
  faqs?: { q: string; a: string }[];

  /**
   * Clinical photography.
   *
   * `sensitive` marks explicit medical results — intimate anatomy, before and
   * afters. Those are NOT downloaded until the visitor actively asks to see
   * them: the src is withheld rather than blurred, so an unconsented image
   * never reaches the browser, and cannot surface in a screenshot, a cache,
   * a link preview or by inspecting the page.
   *
   * Publishing any of these is the clinic's decision and requires the
   * patient's documented consent. This flag governs how the site *displays*
   * an image; it is not, and cannot be, the consent itself.
   */
  gallery?: {
    image: string;
    alt: string;
    caption?: string;
    sensitive?: boolean;
  }[];
}

export const PATHWAY_LABELS: Record<Pathway, string> = {
  him: 'For Him',
  her: 'For Her',
  longevity: 'Longevity',
};

/**
 * Loaded from src/content/treatments/*.json — one file per treatment.
 *
 * The JSON is the editable source: it is what CloudCannon shows Dr Wakil, and
 * adding a treatment is adding a file. This module is the read side, used by
 * both the Astro pages and the client-side quiz and condition finder — which
 * is why it is a synchronous glob rather than Astro's async getCollection().
 *
 * Sorted by pathway then name so the catalogue order is stable no matter what
 * order the files happen to load in.
 */
const files = import.meta.glob<{ default: Treatment }>('../content/treatments/*.json', { eager: true });

const PATHWAY_ORDER: Record<Pathway, number> = { him: 0, her: 1, longevity: 2 };

export const treatments: Treatment[] = Object.values(files)
  .map((m) => m.default)
  .sort((a, b) => PATHWAY_ORDER[a.pathway] - PATHWAY_ORDER[b.pathway] || a.name.localeCompare(b.name));

export const featured: Record<'for-him' | 'for-her' | 'longevity' | 'treatments', string> = {
  'for-him': 'p-shot',
  'for-her': 'o-shot',
  longevity: 'regenerative-medicine',
  treatments: 'p-shot',
};

/**
 * Condition "systems" — the diagnostic-console grouping for the finder.
 * With a catalogue heading past 100 treatments, a flat chip wall does not
 * scale; conditions are indexed under the body system patients think in.
 * Unmapped conditions fall back to Longevity & Recovery.
 */
export interface ConditionSystem {
  id: string;
  label: string;
}

export const SYSTEMS: ConditionSystem[] = [
  { id: 'sexual-function', label: 'Sexual Function' },
  { id: 'hormones', label: 'Hormones & Vitality' },
  { id: 'pelvic', label: 'Pelvic & Urinary' },
  { id: 'intimate', label: 'Intimate Health' },
  { id: 'metabolic', label: 'Weight & Metabolic' },
  { id: 'longevity', label: 'Longevity & Recovery' },
];

const SYSTEM_OF: Record<string, string> = {
  'Erectile dysfunction': 'sexual-function',
  'Peyronie’s disease': 'sexual-function',
  'Loss of sensitivity': 'sexual-function',
  'Post-prostatectomy rehabilitation': 'sexual-function',
  'Vasculogenic ED': 'sexual-function',
  'Premature ejaculation': 'sexual-function',
  'Performance-related physical causes': 'sexual-function',
  'Anorgasmia': 'sexual-function',
  'Low arousal': 'sexual-function',
  'Andropause / low testosterone': 'hormones',
  'Hormonal imbalance': 'hormones',
  'Low libido': 'hormones',
  'Unexplained fatigue': 'hormones',
  'Menopause & perimenopause': 'hormones',
  'Brain fog': 'hormones',
  'Urinary incontinence': 'pelvic',
  'Mild urinary incontinence': 'pelvic',
  'Pelvic floor weakness': 'pelvic',
  'Vaginal dryness': 'intimate',
  'Vaginal laxity': 'intimate',
  'Vulvovaginal discomfort': 'intimate',
  'Genitourinary syndrome of menopause': 'intimate',
  'Vaginal atrophy': 'intimate',
  'Post-natal changes': 'intimate',
  'External skin laxity': 'intimate',
  'Vulval volume loss': 'intimate',
  'Skin laxity': 'intimate',
  'Post-menopausal changes': 'intimate',
  'Weight gain / metabolic slowdown': 'metabolic',
  'Insulin resistance': 'metabolic',
  'Hormonal weight gain': 'metabolic',
  'Chronic fatigue': 'longevity',
  'Nutritional deficiency': 'longevity',
  'Post-illness recovery': 'longevity',
  'Tissue degeneration': 'longevity',
  'Suboptimal performance': 'longevity',
  'Stress & burnout': 'longevity',
  'Healthy ageing': 'longevity',
};

/** Conditions grouped by system, in SYSTEMS order; empty systems dropped */
export function conditionsBySystem(): (ConditionSystem & { conditions: Condition[] })[] {
  const all = allConditions();
  return SYSTEMS.map((s) => ({
    ...s,
    conditions: all.filter((c) => (SYSTEM_OF[c.clinical] ?? 'longevity') === s.id),
  })).filter((g) => g.conditions.length > 0);
}

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
