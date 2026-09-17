/**
 * How many columns a row of cards should use.
 *
 * Grids on this site render lists the clinic edits — five courses today, four
 * tomorrow, seven next year — so the column count cannot be a constant written
 * into a template. A fixed three columns strands the fifth card in a row of its
 * own, or worse, leaves a visible hole where a card would have been.
 *
 * So the count is chosen from the number of items actually being displayed:
 *
 *   3 items → 3 across
 *   4 items → 2 and 2, not 3 and a straggler
 *   5 items → 3 and 2
 *   6 items → 3 and 3
 *   7 items → 4 and 3 where four fit; 3, 3 and 1 where they don't
 *
 * The rule is: use the full width, and narrow it only to rescue a card that
 * would otherwise sit alone — and only while the list is short enough for that
 * lone card to be conspicuous. Past a couple of rows it stops being worth it:
 * sixteen treatments belong three across with one centred underneath, not two
 * across for eight long rows, which is what optimising purely for a clean
 * remainder produces.
 *
 * Whatever is left over, the last row is centred in CSS (`.auto-row` in
 * global.css), so even an unavoidable single card reads as a deliberate short
 * row rather than a gap on the right.
 */
export function balancedColumns(count: number, max = 3): number {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) return 1;
  if (n <= max) return n;

  const stranded = (cols: number) => n % cols === 1;

  /* a lone last card only justifies a narrower row while the list is short —
     roughly two rows' worth, where the eye still reads it as one block */
  if (stranded(max) && n <= max * 2) {
    for (let cols = max - 1; cols >= 2; cols--) {
      if (!stranded(cols)) return cols;
    }
  }
  return max;
}

/**
 * The inline custom properties `.auto-row` reads.
 *
 * Two breakpoints, because a layout that is right on a laptop is wrong on a
 * phone: the small screen never goes past two across, and one card stays one
 * card. Written as a style attribute rather than classes because the numbers
 * are computed per list — Tailwind cannot generate a class for a value that is
 * only known once the clinic has finished adding rows.
 */
export function autoRowStyle(count: number, maxLarge = 3, maxSmall = 2): string {
  const lg = balancedColumns(count, maxLarge);
  const sm = Math.min(balancedColumns(count, maxSmall), lg);
  return `--cols-lg:${lg}; --cols-sm:${sm}`;
}
