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

  /**
   * The photograph behind the top of the treatment's own page.
   *
   * Separate from `image` because the two are doing different jobs: the card
   * image is a small square read at a glance in a grid, the hero is a wide
   * banner with the treatment's name and opening paragraph sitting on top of it.
   * A portrait crop that works in the grid is usually the wrong shape here, and
   * a busy one puts detail behind the headline.
   *
   * Optional — left empty, the card image is used, which is what every page did
   * before this field existed.
   */
  heroImage?: string;
  heroImageAlt?: string;

  /**
   * Search keywords — the words a patient would type that appear nowhere else
   * on the treatment.
   *
   * The finder already searches the name, the description and both wordings of
   * every condition. This is for everything else: the abbreviation ("ED"), the
   * old or blunt word ("impotence"), the brand a patient arrives already asking
   * for ("Viagra", "Emsella"), the symptom in their words ("leaking",
   * "can't finish"), and common misspellings.
   *
   * It is the clinic's search-engine field in the literal sense: adding a word
   * here makes the site's own finder answer it, so widening what the finder
   * understands is content work, not a code change. Nothing here is shown to
   * patients, which is exactly why it can hold words too clinical, too crude or
   * too commercial to print on a card.
   */
  keywords?: string[];

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

  /** Pricing. Deliberately strings, not numbers — clinics quote ranges,
      "from", and "confirmed at consultation", and a numeric field forces a
      precision the clinic may not want published. */
  price?: {
    /** The headline figure, e.g. "From £1,200". */
    from?: string;
    /** What the figure covers, e.g. "per session" or "for a course of three". */
    unit?: string;
    /** Finance terms, e.g. "0% finance available over 12 months". */
    finance?: string;
    /** The caveat, e.g. "Confirmed at consultation." */
    note?: string;
  };

  /** Why a patient would choose it. */
  benefits?: string[];

  /** The steps of a session, in order. */
  howItWorks?: { title: string; detail: string }[];

  /** Page-specific questions. Also feeds FAQ structured data. */
  faqs?: { q: string; a: string }[];

  /**
   * Per-section switches for the CMS.
   *
   * Omitting content already hides a section — this is for the other case:
   * keeping the content but taking the section off the page for now, without
   * deleting work. Everything defaults to shown, so an older treatment file
   * with no `show` block behaves exactly as before.
   *
   * Whatever is hidden, the page re-stripes itself: surfaces are assigned to
   * the sections that actually render, so two same-coloured bands can never
   * end up adjacent. See the `surface` map in pages/treatments/[slug].astro.
   */
  show?: {
    practicalFacts?: boolean;
    steps?: boolean;
    whyChoose?: boolean;
    photographs?: boolean;
    questions?: boolean;
    reassurance?: boolean;
  };

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

/** A string that actually says something, or nothing at all. */
const said = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : undefined;
};

/**
 * Drop everything unwritten, before the page ever sees it.
 *
 * A CMS produces blanks constantly: a row added and not filled in, a field
 * cleared, a photograph removed but its caption left behind, a section started
 * and abandoned. Every one of those is a chance for the live site to show a
 * patient an empty panel, a bullet with no text, or a question with no answer.
 *
 * So emptiness is resolved here, once, rather than guarded against in each
 * template. A section renders only if something real survives this: a step needs
 * both its name and what happens; a question needs its answer; a photograph
 * needs its file; a price block needs a price. Anything that doesn't, isn't
 * there — and the page re-stripes itself around what remains.
 *
 * The effect Dr Wakil sees is the one he asked for: the page never shows a gap
 * where his writing isn't, and filling a field in is the only thing that ever
 * changes the layout.
 */
function onlyWhatIsWritten(raw: Treatment): Treatment {
  const t: Treatment = { ...raw };

  t.name = said(t.name) ?? t.name;
  t.desc = said(t.desc) ?? '';
  t.tag = said(t.tag) ?? '';

  t.intro = said(t.intro);
  t.heroImage = said(t.heroImage);
  t.heroImageAlt = said(t.heroImageAlt);

  t.keywords = (t.keywords ?? []).map(said).filter((k): k is string => Boolean(k));

  t.conditions = (t.conditions ?? []).filter((c) => said(c.clinical) && said(c.plain));

  const facts = Object.fromEntries(
    Object.entries(t.facts ?? {}).filter(([, v]) => said(v))
  ) as Treatment['facts'];
  t.facts = facts && Object.keys(facts).length ? facts : undefined;

  /* a price block with no price is not a price — it is an empty box saying "Investment" */
  t.price = said(t.price?.from)
    ? (Object.fromEntries(Object.entries(t.price!).filter(([, v]) => said(v))) as Treatment['price'])
    : undefined;

  const benefits = (t.benefits ?? []).map(said).filter((b): b is string => Boolean(b));
  t.benefits = benefits.length ? benefits : undefined;

  const steps = (t.howItWorks ?? []).filter((s) => said(s.title) && said(s.detail));
  t.howItWorks = steps.length ? steps : undefined;

  const faqs = (t.faqs ?? []).filter((f) => said(f.q) && said(f.a));
  t.faqs = faqs.length ? faqs : undefined;

  /* a photograph with no file is nothing; one with no alt text still describes
     itself with the treatment's own description rather than going out bare */
  const gallery = (t.gallery ?? [])
    .filter((g) => said(g.image))
    .map((g) => ({ ...g, alt: said(g.alt) ?? t.imageAlt ?? t.name }));
  t.gallery = gallery.length ? gallery : undefined;

  return t;
}

export const treatments: Treatment[] = Object.values(files)
  .map((m) => onlyWhatIsWritten(m.default))
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

/**
 * Everything a query is matched against, as one lower-case haystack per
 * treatment: name, description, tag, both wordings of every condition, and the
 * keywords. Built once, because the finder runs this on every keystroke.
 */
const haystack = new Map<string, string>(
  treatments.map((t) => [
    t.slug,
    [
      t.name,
      t.desc,
      t.tag,
      ...t.conditions.flatMap((c) => [c.clinical, c.plain]),
      ...(t.keywords ?? []),
    ]
      .join(' · ')
      .toLowerCase(),
  ])
);

/**
 * Words carried by every sentence in English and by no symptom in particular.
 *
 * They are dropped before matching, because they otherwise decide the results.
 * "Difficulty keeping an erection" scored a point on "an" for treatments that
 * have nothing to do with erections — enough, against a one-word query for a
 * rare term, to put a treatment for women in front of a man asking about
 * erectile dysfunction. Dropping them leaves the words that carry the meaning.
 *
 * The test for this list is whether a word can describe a symptom on its own.
 * "Leaking", "dryness" and "erection" can, and are not here. "Get" and "keep"
 * cannot — nobody is treated for getting or keeping — and both are here,
 * because "cant get an erection" otherwise scored a point on "get" for a
 * treatment whose keyword reads "hard to get aroused", putting a women's
 * treatment in a man's results on a word that meant nothing in either sentence.
 *
 * Nothing clinical belongs here: no symptom, no anatomy, no body part, no
 * treatment name. If a word is ever the answer to "what is wrong?", it stays.
 */
const STOPWORDS = new Set(
  (
    'a an and the this that these those my me mine our ours your yours their its his her hers ' +
    'i we you he she it they them us him ' +
    'is am are was were be been being do does did doing have has had having ' +
    'get gets getting got keep keeps keeping ' +
    'to of in on at for with from by about as into over during after before again ' +
    'when while if but or so too very just still also not no yes any all some ' +
    'can could would should will shall may might must'
  ).split(' ')
);

/**
 * Free-text search across names, conditions (clinical AND plain) and keywords.
 *
 * A patient types what is wrong in their own words — a phrase, two words, or a
 * whole sentence — and gets the treatments that answer it, best match first.
 * They never see why: the keywords that did the matching are never printed on a
 * card or a page, so the clinic can index a treatment under "impotence" and
 * "ED" while the site still says "erectile dysfunction" to the patient.
 *
 * Matching is word by word rather than on the whole string. Patients type
 * "difficulty keeping an erection" and the condition on file reads "difficulty
 * getting or keeping an erection", so a single whole-string match found nothing
 * for the most natural query on the page — it was the example in the search
 * box's own placeholder.
 *
 * Deliberately not fuzzy: a doctor who adds a word expects that word to work,
 * and approximate matching on medical terms produces confidently wrong answers.
 * Synonyms, abbreviations and misspellings are handled by adding them to
 * `keywords`, where they are visible to the clinic and under its control.
 */
export function findTreatments(query: string): Treatment[] {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  if (!words.length) return [];

  /**
   * Long words match inside words, so "erection" finds "erections". Short ones
   * have to be whole words, because a two-letter substring sits inside half the
   * catalogue: "ED" otherwise matched "reducED sensation" and answered a man
   * asking about erectile dysfunction with two treatments for women.
   *
   * The boundary is spelled out rather than using \b because \b treats an
   * apostrophe as a boundary, so the "t" of "can't" counted as a standalone
   * word and a search for "low T" turned up a treatment for women.
   */
  const tests = words.map((w) => {
    if (w.length > 3) return (text: string) => text.includes(w);
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^a-z0-9'’])${safe}(?:[^a-z0-9'’]|$)`);
    return (text: string) => re.test(text);
  });

  /**
   * Score each treatment by how many of the query's meaningful words it matches,
   * and answer with the best-matching band: everything that matched all three
   * words if anything did, otherwise everything that matched two, and so on.
   *
   * The band, rather than every word, is what makes a sentence work. "Leaking
   * when I laugh" has words no treatment can match, and an all-or-nothing search
   * answered the most clearly described symptom on the page with "no direct
   * match". The band, rather than everything that matched anything, is what
   * keeps it honest: a query that lands squarely on one treatment returns that
   * one treatment, and never pads the row out with near misses.
   *
   * Between them they also cover the query that names nothing on file: "cant get
   * an erection" matches no treatment on "cant", so the band falls to the word
   * that does carry meaning and returns the three erectile-dysfunction
   * protocols — which is the answer that man was looking for.
   */
  let best = 0;
  const scored = treatments.map((t) => {
    const text = haystack.get(t.slug) ?? '';
    let score = 0;
    for (const match of tests) if (match(text)) score++;
    if (score > best) best = score;
    return { t, score };
  });
  if (best === 0) return [];
  /* catalogue order within the band — pathway, then name — so the row is stable */
  return scored.filter((s) => s.score === best).map((s) => s.t);
}

export function treatmentsByPathway(pathway: Pathway): Treatment[] {
  return treatments.filter((t) => t.pathway === pathway);
}
