/**
 * Prefix a site-internal path with the configured base URL.
 * Safe whether or not BASE_URL carries a trailing slash, and
 * whether or not the path carries a leading one.
 */
export const withBase = (path = '') => {
  const base = import.meta.env.BASE_URL;
  return (base.endsWith('/') ? base : base + '/') + String(path).replace(/^\//, '');
};

/**
 * Resolve an image reference from the data layer: absolute URLs
 * (stable drswclinics.com hotlinks) pass through untouched; local
 * site-relative paths ("images/…") get the GitHub Pages base prefix.
 */
export const imageUrl = (src) => (/^https?:\/\//.test(src) ? src : withBase(src));
