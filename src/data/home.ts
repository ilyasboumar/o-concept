/**
 * The home page, as content.
 *
 * Every word and every photograph on the landing page comes from
 * src/content/home/*.json — one file per section, which is one item in the
 * CMS sidebar. This module is the typed read side, exactly as site.ts is for
 * site.json and treatments.ts is for the treatment files.
 *
 * Three rules hold this together:
 *
 *  1. NO HTML IN CONTENT. Emphasis is *asterisks* and trademarks are just ™ —
 *     src/lib/copy.ts turns both into markup. See that file for why.
 *  2. EVERY LIST IS AN ARRAY. Awards, testimonials, press names, science
 *     steps, pathway cards, membership tiers, benefits: all arrays, because an
 *     array is what a CMS renders as "add a row / remove a row / drag to
 *     reorder". Sections read their length rather than assuming three of
 *     anything, so adding a fourth card is a content edit, not a code change.
 *  3. EVERY SECTION HAS A `show` SWITCH. Turning a section off takes it off
 *     the page and keeps the writing behind it — the same pattern the
 *     individual treatment pages already use.
 *
 * Imports are static and named rather than a glob: these are seven known
 * sections, not a collection that grows, and a named import means a typo in a
 * filename fails the build instead of silently emptying a section.
 */
import heroData from '../content/home/hero.json';
import recognitionData from '../content/home/recognition.json';
import positioningData from '../content/home/positioning.json';
import scienceData from '../content/home/science.json';
import pathwaysData from '../content/home/pathways.json';
import finderData from '../content/home/finder.json';
import membershipData from '../content/home/membership.json';

/** The three brand accents a section can be tuned to. Anything else falls back
 *  to gold, so an unrecognised value can never render an uncoloured card. */
export type Accent = 'gold' | 'rose' | 'teal';

export interface Link {
  /** The words on the button or link. */
  text: string;
  /** Either an in-page anchor ("#begin") or a site path ("for-him"). */
  href: string;
}

export interface Picture {
  image: string;
  alt?: string;
  caption?: string;
}

/* ---------------------------------------------------------------- hero ---- */

/** No `show` switch: a landing page without its hero is not a landing page. */
export interface Hero {
  eyebrow: string;
  headline: string;
  sub: string;
  primaryCta: Link;
  secondaryCta: Link;
  scrollCue: string;
  /** The pathway titles that fade past as the camera flies through the rings. */
  gates: { title: string; text: string; accent: Accent }[];
  body: {
    eyebrow: string;
    headline: string;
    text: string;
    cta: Link;
    credentials: { value: string; label: string }[];
  };
  portrait: Picture & { name: string; role: string };
}

/* -------------------------------------------------------- recognition ---- */

export interface Recognition {
  show?: boolean;
  doctor: Picture & { name: string; role: string; note: string };
  /** Patient video testimonials come from src/data/videos.ts — this only says
   *  whether they join the stream. */
  includeVideos?: boolean;
  awards: Picture[];
  quotes: { text: string; who: string }[];
  press: { name: string }[];
}

/* -------------------------------------------------------- positioning ---- */

export interface Positioning {
  show?: boolean;
  quote: string;
  photo: Picture;
  pressBadge: Picture;
  eyebrow: string;
  paragraphs: string[];
  /** `value` is typed as it should read — "25,000+", "1st". See copy.statParts. */
  stats: { value: string; label: string }[];
}

/* ------------------------------------------------------------ science ---- */

export interface Science {
  show?: boolean;
  eyebrow: string;
  heading: string;
  intro: string;
  image: Picture;
  steps: { title: string; text: string; detail?: string }[];
  handover: Picture;
  closing: {
    eyebrow: string;
    heading: string;
    text: string;
    primaryCta: Link;
    secondaryCta: Link;
  };
}

/* ----------------------------------------------------------- pathways ---- */

export interface Pathways {
  show?: boolean;
  eyebrow: string;
  heading: string;
  ctaLabel: string;
  cards: {
    /** The small accented label above the title — "For Him". */
    kicker: string;
    title: string;
    text: string;
    accent: Accent;
    href: string;
    points: string[];
  }[];
}

/* ------------------------------------------------------------- finder ---- */

export interface Finder {
  show?: boolean;
  eyebrow: string;
  heading: string;
  intro: string;
  placeholder: string;
  catalogueNote: string;
  catalogueLinkLabel: string;
  emptyNote: string;
  emptyLinkLabel: string;
  emptyNoteEnd: string;
}

/* --------------------------------------------------------- membership ---- */

export interface Membership {
  show?: boolean;
  eyebrow: string;
  heading: string;
  intro: string;
  /** The badge on the highlighted tier — "Most Chosen". */
  highlightLabel: string;
  applyLabelPrefix: string;
  tiers: {
    name: string;
    price: string;
    priceNote: string;
    tagline: string;
    /** Only the first tier switched on is highlighted — see `membership` below. */
    highlight?: boolean;
    benefits: string[];
  }[];
  packages: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    text: string;
    points: string[];
    cta: Link;
  };
}

export const hero = heroData as Hero;
export const recognition = recognitionData as Recognition;
export const positioning = positioningData as Positioning;
export const science = scienceData as Science;
export const pathways = pathwaysData as Pathways;
export const finder = finderData as Finder;

/**
 * Membership, with one thing normalised on the way through: exactly one tier
 * can be highlighted.
 *
 * The CMS field is a switch per tier, because that is the control that makes
 * sense next to a tier ("is this the one we recommend?"). But the highlighted
 * card is physically taller than its neighbours and wears a badge, so two of
 * them reads as an accident and three defeats the purpose. Rather than police
 * it in the editor, the first one switched on wins and the rest render as
 * ordinary tiers — whatever he does with the switches, the section looks
 * deliberate.
 */
export const membership: Membership = (() => {
  const m = membershipData as Membership;
  let taken = false;
  return {
    ...m,
    tiers: m.tiers.map((t) => {
      const highlight = Boolean(t.highlight) && !taken;
      if (highlight) taken = true;
      return { ...t, highlight };
    }),
  };
})();

/** A section renders unless it has been explicitly switched off. */
export const shown = (section: { show?: boolean }) => section.show !== false;
