/**
 * Reassurance copy — the emotional spine of the site.
 *
 * The client's brief: patients should be told, repeatedly and in different
 * places, that they are in the right hands. These are the concerns people
 * actually arrive with — embarrassment, doubt that anything can be done, fear
 * of being judged — answered plainly.
 *
 * Kept out of the templates so the same voice repeats across the site from one
 * place: the words themselves live in src/content/assurances/*.json, one file
 * per set, and the clinic edits them there. Reword one, and every page that
 * uses that set follows.
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

/**
 * One file per set — welcome, guidance, authority. The file name is the name a
 * page asks for with `variant`, so adding a set means adding a file and a page
 * that asks for it.
 */
const files = import.meta.glob<{ default: AssuranceSet }>('../content/assurances/*.json', { eager: true });

const byName = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [
    path.split('/').pop()!.replace(/\.json$/, ''),
    { ...mod.default, items: (mod.default.items ?? []).filter((i) => i?.title?.trim() && i?.body?.trim()) },
  ])
) as Record<string, AssuranceSet>;

export const sets = byName;
export type AssuranceSetName = 'welcome' | 'guidance' | 'authority';
