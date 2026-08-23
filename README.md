# The O Concept™ — Website Prototype

Client prototype for **The O Concept™**, the flagship sexual rejuvenation and regenerative
programme of Dr Sherif Wakil (Dr SW Clinics, 77 Harley Street, London).

## Stack

- **Astro 5** (static output) + **Tailwind CSS v4** (Vite plugin, `@theme` tokens in
  `src/styles/global.css` — no `tailwind.config.js`)
- **Three.js** for the DNA hero, ambient helix and stem-cell particle field
- **GSAP + ScrollTrigger** for scroll animation, **Lenis** for smooth scrolling
- **Fontsource** — Cormorant Garamond (display serif) + Manrope (geometric sans)
- `@astrojs/sitemap` + hand-written JSON-LD (`MedicalClinic`, `Physician`, per-page schema)
- No CMS, no backend. All forms are non-functional demos (`preventDefault` + success state).

## Commands

```sh
npm install       # requires Node >= 22.16.0
npm run dev       # local dev server — http://localhost:4321/o-concept/
npm run build     # production build → dist/
npm run preview   # preview the production build
```

There is no test suite or linter — `npm run build` is the check.

The site is configured with `base: '/o-concept'`, so dev and preview serve under
`/o-concept/`, not the bare root. All internal links and local assets go through
`withBase()` / `imageUrl()` in `src/lib/url.js`.

## Pages

`/` · `/for-him` · `/for-her` · `/longevity` · `/treatments` · `/membership` ·
`/about-dr-wakil` · `/training` · `/international` · `/shop`

## Deployment

GitHub Pages, via `.github/workflows/deploy.yml` — builds and deploys on every push to
`main` (Node 22.16.0, `npm ci && npm run build`, publishes `dist/`).

`site` and `base` in `astro.config.mjs` are tied to the Pages URL; both must change together
if the site moves to another host.

## Prototype features

- **Confidential Self-Assessment** — 4-step client-side quiz opened from the fixed edge tab
  (≥1400px) or the bottom-left pill on smaller screens. Recommendations are drawn from
  `src/data/treatments.ts`; nothing is stored or sent.
- **Condition finder** — "diagnostic console" indexing conditions by body system, linking
  through to the treatment catalogue.
- **Discreet Patient Concierge** — floating chat bubble, scripted demo exchanges.
- **Welcome popup** — once per session, after 6 s or 40 % scroll; remembers dismissal in
  `sessionStorage`.
- Reduced motion is fully respected (`prefers-reduced-motion`) across CSS and the 3D layer;
  WebGL scenes pause offscreen and fall back to static SVG where unavailable.

## Content status

Imagery, patient video testimonials and Dr Wakil's biography/awards are real client material
(some hotlinked from drswclinics.com). Pricing, membership tiers, testimonial copy and team
members other than Dr Wakil remain illustrative placeholders. The full treatment catalogue
(100+ treatments) has not been supplied — only the 16 signature protocols are in the data
layer.

See `CLAUDE.md` for architecture notes and working conventions.
