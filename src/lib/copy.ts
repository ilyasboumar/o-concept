/**
 * Copy helpers — the two things editable text needs that plain strings can't do.
 *
 * The rule this file exists to protect: nothing in src/content/ contains HTML.
 * A doctor typing into a CMS field should never have to know what a <span> is,
 * and any markup he could type would be markup we'd have to trust and escape.
 * So the two pieces of presentation the copy genuinely needs are expressed in
 * characters he already types, and turned into markup here.
 */

export interface Segment {
  text: string;
  /** Inside *asterisks* — the component decides what "emphasis" looks like. */
  em: boolean;
  /** A ™ or ® that should render as a superscript rather than full size. */
  sup: boolean;
}

/**
 * Split editable copy into renderable segments.
 *
 *   "Function, sensation — *measured, restored.*"  →  accented emphasis
 *   "The O Concept™"                              →  superscript trademark
 *
 * Returned as data, not a string of HTML: components map over it with ordinary
 * JSX, so the text is escaped by Astro like any other interpolated value and
 * there is no set:html anywhere in the content path.
 */
export function segments(input: string | undefined | null = ''): Segment[] {
  const out: Segment[] = [];
  /* split on a capture group: even chunks are plain, odd chunks were *starred* */
  String(input ?? '')
    .split(/\*([^*]+)\*/g)
    .forEach((chunk, i) => {
      if (!chunk) return;
      const em = i % 2 === 1;
      chunk.split(/([™®])/g).forEach((piece) => {
        if (piece) out.push({ text: piece, em, sup: piece === '™' || piece === '®' });
      });
    });
  return out;
}

export interface StatParts {
  /** The number the counter animates towards. */
  count: number;
  /** Whatever followed the number — "+", "st", "%". */
  suffix: string;
  /** True when the number should NOT be thousands-separated as it counts. */
  plain: boolean;
}

/**
 * Read a stat the way it was typed, so the CMS field is just "what you want
 * patients to see" — "25,000+", "20+", "1st", "2025" — and the count-up
 * animation is derived rather than configured.
 *
 * Whether to group thousands comes from the value itself: someone who typed a
 * comma wants 25,000; someone who typed 2025 wants a year, not 2,025.
 *
 * Returns null when the value doesn't begin with a number ("IAAGSW", "From £—"),
 * which is the signal to render it as static text with no counter.
 */
export function statParts(value: string | undefined | null): StatParts | null {
  const m = String(value ?? '').match(/^([\d,]*\d)(.*)$/);
  if (!m) return null;
  const count = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(count)) return null;
  return { count, suffix: m[2], plain: !m[1].includes(',') };
}

/** Ordinal values ("1st") keep the letters as a superscript, as set by hand before. */
export function ordinal(value: string | undefined | null): { number: string; suffix: string } | null {
  const m = String(value ?? '').match(/^(\d+)(st|nd|rd|th)$/i);
  return m ? { number: m[1], suffix: m[2] } : null;
}
