/**
 * Reassurance copy — the emotional spine of the site.
 *
 * The client's brief: patients should be told, repeatedly and in different
 * places, that they are in the right hands. These are the concerns people
 * actually arrive with — embarrassment, doubt that anything can be done, fear
 * of being judged — answered plainly.
 *
 * Kept in the data layer rather than written into templates so the same voice
 * repeats across the site from one place, and so it maps to a single editable
 * block after the CMS migration. Reword here, and every page follows.
 *
 * Tone rules, learned from the rest of the site's copy: no exclamation marks,
 * no "don't worry", no promises about outcomes. Calm, specific, and always
 * pointing at the next concrete step.
 */

export interface Assurance {
  /** Short enough to read in a glance — this is the line that lands. */
  title: string;
  /** One or two sentences. Says *why* the reassurance is true. */
  body: string;
}

export interface AssuranceSet {
  eyebrow: string;
  heading: string;
  items: Assurance[];
}

/** The core set — used at the point where a patient is deciding to act. */
export const welcome: AssuranceSet = {
  eyebrow: 'Before you go any further',
  heading: 'You are in the right place.',
  items: [
    {
      title: 'We are here to help',
      body: 'Whatever you have come to ask about, it is something we treat every week. Nothing you say will surprise us, and nothing you say leaves the room.',
    },
    {
      title: 'We will take your hand through this',
      body: 'You do not need to know which treatment you need — that is our job. Every programme begins with diagnostics, so the plan is chosen from evidence, not guesswork.',
    },
    {
      title: 'You are in expert hands',
      body: 'Every clinician here is trained by Dr Sherif Wakil, who created The O Concept™ and has taught this medicine to more than 3,000 doctors worldwide.',
    },
  ],
};

/** Shorter set, for treatment and pathway pages where space is tighter. */
export const guidance: AssuranceSet = {
  eyebrow: 'You are not the first to ask',
  heading: 'This is more common than you think.',
  items: [
    {
      title: 'No judgement, ever',
      body: 'These are medical matters with medical answers. Our consultations are unhurried, private, and free of embarrassment.',
    },
    {
      title: 'A protocol, not a guess',
      body: 'The O Concept™ treats the cause rather than the symptom, which is why the first step is always a full diagnostic picture.',
    },
    {
      title: 'One team, start to finish',
      body: 'The same clinicians see you through diagnostics, treatment and review. You will not be handed between strangers.',
    },
  ],
};

/** For the training and about pages — reassurance aimed at the profession. */
export const authority: AssuranceSet = {
  eyebrow: 'Why patients travel for this',
  heading: 'The doctors who teach the doctors.',
  items: [
    {
      title: 'Taught by the originator',
      body: 'Dr Wakil created The O Concept™ and brought the O-Shot® and P-Shot® to the UK. Clinicians fly in to learn these techniques from him directly.',
    },
    {
      title: 'More than 3,000 clinicians trained',
      body: 'Through the IAAGSW, Dr Wakil has trained over 3,000 international medical professionals in aesthetic gynaecology and sexual well-being.',
    },
    {
      title: 'Standards, not shortcuts',
      body: 'Training runs in cohorts of no more than six, so every delegate is supervised hands-on. The same standard governs the clinic.',
    },
  ],
};

export const sets = { welcome, guidance, authority };
export type AssuranceSetName = keyof typeof sets;
