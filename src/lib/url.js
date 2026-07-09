/**
 * Prefix a site-internal path with the configured base URL.
 * Safe whether or not BASE_URL carries a trailing slash, and
 * whether or not the path carries a leading one.
 */
export const withBase = (path = '') => {
  const base = import.meta.env.BASE_URL;
  return (base.endsWith('/') ? base : base + '/') + String(path).replace(/^\//, '');
};
