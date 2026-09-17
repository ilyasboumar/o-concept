/**
 * The standalone pages, as content — src/content/pages/*.json.
 *
 * Same arrangement as data/home.ts, for the pages that are not the landing
 * page. Membership is here; the pathway pages join it the same way.
 *
 * What is NOT here is as deliberate as what is. The membership tiers and the
 * "open to everyone" packages panel live in the membership section content and
 * are rendered on both the home page and this page, so the prices, the benefits
 * and the recommended tier are edited once and can never disagree between the
 * two pages a patient compares before applying.
 */
import membershipData from '../content/pages/membership.json';
import aboutData from '../content/pages/about.json';
import teachingData from '../content/pages/teaching.json';
import trainingData from '../content/pages/training.json';
import type { Link, Picture } from './home';

export interface MembershipPage {
  hero: {
    eyebrow: string;
    /** *Asterisks* mark the words that take the accent colour. */
    heading: string;
    sub: string;
    /** The quiet line under the tiers — "Pricing confirmed at application". */
    note?: string;
  };
  packages: { show?: boolean };
  comparison: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    /** Heading for the first column, the one listing what is being compared. */
    featureLabel: string;
    note?: string;
    /**
     * One row per benefit. `values` lines up with the membership tiers in order
     * — first value for the first tier, and so on — because the columns ARE the
     * tiers: their names and prices are read from the tier content rather than
     * typed again here, so renaming a tier or changing its price cannot leave
     * the table saying something different from the cards above it.
     *
     * A row with too few values is padded, so adding a fourth tier shows an
     * honest "—" in every row until those cells are filled in.
     */
    rows: { feature: string; values: string[] }[];
  };
  concierge: { show?: boolean };
  faqs: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    items: { q: string; a: string }[];
  };
  finalCta: { heading: string; sub: string };
}

export const membershipPage = membershipData as MembershipPage;

export type { Link };

/* ------------------------------------------------------------------ about --- */

/**
 * About Dr Wakil.
 *
 * SOURCING RULE, inherited from data/credentials.ts and still binding: this is a
 * physician's professional record. Every credential, milestone, figure and named
 * award here must come from the clinic. Nothing may be invented to make a
 * section look fuller — a plausible-looking qualification that was never earned
 * is a liability on a doctor's page, not a presentational choice.
 *
 * The same applies to the team: a card carries a real person's name, face and
 * title. It ships with its names deliberately marked as placeholders rather than
 * filled with something plausible.
 */
export interface AboutPage {
  hero: {
    eyebrow: string;
    /** *Asterisks* mark the words that take the accent colour. */
    heading: string;
    tagline: string;
    portrait: Picture;
  };
  /** The badges in the hero's rotating ring. */
  awards: { show?: boolean; items: Picture[] };
  physician: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    photo: Picture;
  };
  credentials: { show?: boolean; eyebrow: string; items: string[] };
  milestones: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    /** `mark` is the gold line — a year, a count, a name. */
    items: { mark: string; text: string }[];
  };
  promise: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    photo: Picture;
    chips: string[];
  };
  team: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    intro?: string;
    /** `brief` is optional: a card with only a name and a title is complete. */
    members: { image: string; alt?: string; name: string; title: string; brief?: string }[];
  };
  finalCta: { heading: string; sub: string };
}

/** Teaching & speaking — shown on both the About page and the Training page,
 *  so it is edited once. The programmes and congresses beneath it stay one
 *  file per entry in their own collections. */
export interface TeachingBlock {
  eyebrow: string;
  heading: string;
  intro: string;
  /** Figures the clinic can stand behind — see the sourcing rule above. */
  stats: { value: string; label: string; note?: string }[];
  curriculumEyebrow: string;
  congressesEyebrow: string;
}

export const aboutPage = aboutData as AboutPage;
export const teaching = teachingData as TeachingBlock;

/** A team card needs a face and a name; anything less is not shown. */
export const teamMembers = aboutPage.team.members.filter((m) => m?.image?.trim() && m?.name?.trim());

/* --------------------------------------------------------------- training --- */

/**
 * Training & IAAGSW.
 *
 * The sourcing rule from the About page applies here too: the IAAGSW facts, the
 * fellowship's structure and anything said about certification are professional
 * claims, not marketing copy, and come from the clinic.
 */
export interface TrainingPage {
  hero: { eyebrow: string; heading: string; sub: string; chips: string[] };
  banner: { show?: boolean } & Picture & { eyebrow?: string };
  positioning: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    /** Who the fellowship is for — one line each. */
    audience: string[];
    photo: Picture;
  };
  fellowship: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    intro: string;
    photo: Picture;
    /** Numbered automatically from their order, never typed. */
    steps: { title: string; text: string }[];
    note?: string;
  };
  iaagsw: {
    show?: boolean;
    eyebrow: string;
    heading: string;
    tagline: string;
    paragraphs: string[];
    photo: Picture;
    /** The facts panel — `k` is the label, `v` the answer. */
    facts: { k: string; v: string }[];
    link: Link;
  };
  delegates: { show?: boolean; eyebrow: string; heading: string };
  apply: { show?: boolean; eyebrow: string; heading: string; sub: string };
  finalCta: { heading: string; sub: string };
}

export const trainingPage = trainingData as TrainingPage;
