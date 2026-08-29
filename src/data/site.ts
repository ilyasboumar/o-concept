/**
 * Site settings — the facts that appear in more than one place.
 *
 * The values live in site.json because that is what CloudCannon can edit: Dr
 * Wakil changes the phone number once, in "Clinic details", and it updates
 * every page, every tel: link and the structured data Google reads.
 *
 * This file is the typed read side — it adds nothing the CMS needs to know
 * about, only the derived helpers below.
 *
 * SCOPE RULE — what belongs in site.json and what does not:
 *   IN   structured, repeated facts: phone, email, address parts, clinic list.
 *   OUT  prose. "…consultations at 77 Harley Street. We listen first…" is
 *        copy, not data. Templating a sentence fragment makes it HARDER to
 *        edit in a CMS, not easier — that stays as editable page copy.
 */
import data from './site.json';

export interface Clinic {
  city: string;
  country: string;
  /** Marks the headquarters — used for the JSON-LD postal address. */
  primary?: boolean;
}

export const site = data;

/** "London, Dubai and Egypt" — built from the list so it can never drift. */
export const clinicSentence = (() => {
  const cities = site.clinics.map((c) => c.city);
  return cities.length > 1
    ? `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}`
    : cities[0];
})();
