/**
 * Dr Wakil's teaching and speaking record.
 *
 * SOURCING RULE — read before editing.
 * These are a physician's professional credentials. Every figure and every
 * named engagement here must come from the client or from iaagsw.com. Nothing
 * in this file may be invented or "filled in" to make a section look fuller —
 * a plausible-looking congress that never happened is worse than a short list.
 *
 * Anything still needed from the client is marked TODO and simply renders as
 * a shorter list until it arrives.
 */

export interface Programme {
  name: string;
  detail: string;
}

export interface Engagement {
  /** Congress, society or host organisation. */
  event: string;
  /** Venue and city, where known. */
  place?: string;
  /** Year or range. Omit if unconfirmed rather than guessing. */
  year?: string;
  /** Speaking, chairing, faculty, keynote… */
  role?: string;
}

/**
 * Verified against iaagsw.com (fetched 2026-08-23). If these change on the
 * association's site, change them here — do not let the two drift.
 */
export const trainingStats = {
  clinicians: {
    value: '3,000+',
    label: 'international medical professionals trained',
    note: 'in aesthetic gynaecology and facial aesthetics, through the IAAGSW',
  },
  cohort: {
    value: 'Max 6',
    label: 'delegates per cohort',
    note: 'so every delegate is supervised hands-on, not lectured at',
  },
  reach: {
    value: 'Global',
    label: 'clinicians fly in to train',
    note: 'taught by the physician who created the protocol',
  },
};

/**
 * The IAAGSW curriculum — loaded from src/content/programmes/*.json.
 * One file per programme; adding a course is adding a file.
 */
const programmeFiles = import.meta.glob<{ default: Programme & { order: number } }>(
  '../content/programmes/*.json',
  { eager: true }
);
export const programmes: Programme[] = Object.values(programmeFiles)
  .map((m) => m.default)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

/**
 * Congresses and invited lectures — src/content/congresses/*.json.
 *
 * SOURCING RULE STILL APPLIES: only engagements that actually happened. The
 * list renders however short it is, and a short list of real events reads as
 * selective. A padded one is a liability on a physician's page.
 *
 * Dr Wakil adds these himself in the CMS: one entry = one file.
 */
const congressFiles = import.meta.glob<{ default: Engagement & { order: number } }>(
  '../content/congresses/*.json',
  { eager: true }
);
export const speaking: Engagement[] = Object.values(congressFiles)
  .map((m) => m.default)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
