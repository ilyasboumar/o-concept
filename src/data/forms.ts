/**
 * Forms, as content — src/content/forms/*.json.
 *
 * The clinic decides what it asks. Every field on every form is a row the owner
 * adds, names, orders and marks required in the CMS: what it is called on screen,
 * what the answer is called in the data that comes back, which of the nine field
 * types it is, and how wide it sits. Adding a question to the membership
 * application is content work, not a code change.
 *
 * Two things are deliberately NOT the owner's to type:
 *
 *   · The membership dropdown. It reads `optionsFrom: "membershipTiers"` and
 *     takes its choices from the tiers themselves, so adding a fourth tier adds
 *     it to the application form automatically and renaming one renames it
 *     everywhere. A list of tiers typed a second time is a list that will
 *     eventually disagree with the cards above it.
 *
 *   · Where the answers go. See `endpoint` below.
 */
import { membership } from './home';

const files = import.meta.glob<{ default: FormDefinition }>('../content/forms/*.json', { eager: true });

/** The field types the CMS offers. Each maps to one real control. */
export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'time'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'checkbox';

export interface FormField {
  type: FieldType;
  /** What the answer is called in the data the clinic receives. */
  name: string;
  /** What the patient reads above the box. */
  label: string;
  required?: boolean;
  /** 'half' pairs two fields on one line at tablet width and up. */
  width?: 'half' | 'full';
  placeholder?: string;
  /** A quiet line under the field. */
  help?: string;
  /** For select, radio and checkboxes. */
  options?: string[];
  /** Instead of typing options, take them from somewhere that already knows. */
  optionsFrom?: 'membershipTiers';
  /** Lets a browser offer what it already knows — "email", "tel", "given-name". */
  autocomplete?: string;
}

export interface FormDefinition {
  title: string;
  eyebrow?: string;
  heading: string;
  intro?: string;
  submitLabel: string;
  /** The reassurance under the button. */
  note?: string;
  /**
   * Where a completed form is sent.
   *
   * Empty — as it ships — nothing is sent anywhere: the form validates, shows
   * its thank-you, and the answers go no further than the browser. That is the
   * honest state for a prototype, and it is visible rather than hidden, because
   * a membership application that looks like it sent and did not is worse than
   * one that never claimed to.
   *
   * Paste a form-handling URL here (the clinic's CRM, or a service such as
   * Formspree or Netlify Forms) and the same form starts posting to it. That is
   * the only change needed to make these live — no code, no rebuild of the
   * fields, and the owner can do it himself.
   */
  endpoint?: string;
  success: { heading: string; text: string };
  error?: { heading: string; text: string };
  fields: FormField[];
}

/** A field that patients can actually answer. */
const usable = (f: FormField) => Boolean(f?.label?.trim() && f?.name?.trim() && f?.type);

/** Choices, wherever they come from. */
export function choicesFor(field: FormField): string[] {
  if (field.optionsFrom === 'membershipTiers') return membership.tiers.map((t) => t.name);
  return (field.options ?? []).map((o) => String(o).trim()).filter(Boolean);
}

/**
 * Forms by file name — "membership-application", "plan-your-visit".
 *
 * Unusable rows are dropped the way unwritten treatment sections are: a field
 * half-added in the editor never reaches a patient as a nameless box.
 */
export const forms: Record<string, FormDefinition> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => {
    const slug = path.split('/').pop()!.replace(/\.json$/, '');
    const def = mod.default;
    return [slug, { ...def, fields: (def.fields ?? []).filter(usable) }];
  })
);

export const getForm = (slug: string): FormDefinition | undefined => forms[slug];
