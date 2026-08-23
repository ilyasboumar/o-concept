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

/** The IAAGSW curriculum — programme names as published by the association. */
export const programmes: Programme[] = [
  {
    name: 'Intimate Female Rejuvenation',
    detail: 'Aesthetic gynaecology and female sexual well-being, including the O-Shot® technique.',
  },
  {
    name: 'Intimate Male Rejuvenation',
    detail: 'Male sexual health and regenerative technique, including the P-Shot®.',
  },
  {
    name: 'Foundation Aesthetic Training',
    detail: 'Entry-level certification — toxin and dermal filler technique for clinicians new to the field.',
  },
  {
    name: 'Advanced & Masterclass',
    detail: 'PRP therapies, thread lifts and advanced regenerative protocol for experienced practitioners.',
  },
  {
    name: 'The O Concept™ Fellowship',
    detail: 'A structured pathway from foundation to certification in the full protocol.',
  },
];

/**
 * Congresses and invited lectures.
 *
 * TODO — CLIENT INPUT NEEDED. Only the entry below is confirmed (it already
 * appears on the /training page). Dr Wakil has asked for his speaking record
 * to be listed here; we need event names, cities and years from him before
 * anything else goes in. Each additional entry is one object in this array —
 * no template changes required.
 */
export const speaking: Engagement[] = [
  {
    event: '1st World IAAGSW Congress',
    place: 'Royal Society of Medicine, London',
    role: 'Founder & President — host and faculty',
  },
];
