# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A client-facing marketing prototype for **The O Concept™**, the sexual-rejuvenation and
regenerative-medicine programme of Dr Sherif Wakil (Dr SW Clinics, 77 Harley Street, London).
Astro 5 static site, no CMS, no backend. Every form and "AI" feature is a client-side demo.

Presentation is the product here: motion, 3D and copy are the deliverable, not decoration.
Content (award years, pricing tiers, some team members) is a mix of real client material and
illustrative placeholder — check with the user before treating any figure as authoritative.

## Commands

```sh
npm install          # Node >= 22.16.0 required (engines field)
npm run dev          # dev server, http://localhost:4321/o-concept/
npm run build        # static build → dist/ (10 pages)
npm run preview      # serve the built dist/
```

There is no test suite, linter or formatter. **`npm run build` is the verification step** —
run it after every change batch; Astro fails the build on template/type errors.

Note the `base: '/o-concept'` in `astro.config.mjs`: dev and preview serve under
`/o-concept/`, *not* the bare root. That is expected, not a bug.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, on push to `main` only. `site` +
`base` in `astro.config.mjs` must match the Pages URL — changing the host means changing
both. (The README's older Cloudflare instructions are no longer the live path.)

## Architecture

### Page shell

Every page is `Base.astro` + section components. `Base.astro` owns the `<head>` (canonical,
OG, favicon, sitemap link), emits **global JSON-LD** (`MedicalClinic` + `Physician` for Dr
Wakil) on every page, and mounts the four persistent overlays: `SideTab`, `Concierge`,
`QuizModal`, `WelcomePopup`. Pages pass `title`, `description`, and optional extra `schema`
objects (FAQPage, MedicalProcedure) that are appended to the global set.

The SEO/JSON-LD layer is deliberate — the site is written to be readable by LLM answer
engines as much as by search crawlers. Don't strip schema when refactoring sections.

### URL handling — the single most common source of bugs

Because of the `/o-concept` base path, **every internal link and every local asset must go
through `withBase()`** from `src/lib/url.js`. A bare `href="/for-him"` or
`src="/images/x.jpg"` works in dev preview under some conditions and 404s in production.

- `withBase('for-him')` → `/o-concept/for-him`
- `imageUrl(src)` → passes absolute `https://drswclinics.com/...` hotlinks through untouched,
  prefixes site-relative `images/…` paths. Used by the data layer.

### Behaviour layer — `src/scripts/main.js` (~1150 lines)

One module, imported once from `Base.astro`, organised into banner-commented sections. It is
**attribute-driven**: components opt into behaviour by emitting `data-*` attributes, and
`main.js` queries for them globally. There is no per-component script. Before adding markup,
check whether an attribute already does the job:

| Attribute | Behaviour |
| --- | --- |
| `data-reveal`, `data-reveal-child`, `data-delay` | GSAP/ScrollTrigger entrance animation |
| `data-parallax`, `data-line-draw`, `data-count` (+`data-suffix`/`data-plain`) | scroll parallax, SVG line draw, number count-up |
| `data-magnetic`, `data-tilt` (+`data-tilt-max`) | cursor micro-interactions |
| `data-modal`, `data-close`, `data-open-quiz` | modal open/close + scroll lock |
| `data-three` (`helix` \| `cells`) | lazy-loads the Three.js chunk |
| `data-video-facade`, `data-video-id` | lite YouTube embed — iframe mounts on click |
| `data-dropdown`, `data-acc`, `data-filter`, `data-system` | nav, mobile accordions, filters, condition-finder tabs |

Lenis drives smooth scrolling and is synced to ScrollTrigger at the top of the file.

Several fixed bugs live in this file as *deliberate* patterns — don't "simplify" them back:
cursor-following effects cache `getBoundingClientRect()` on `mouseenter` and ease via rAF
(re-measuring mid-transform caused jitter); carousels keep `hovering` and drag-`paused` as
separate flags (sharing one flag froze the strip indefinitely).

### 3D layer

Two independent implementations — know which one you're in:

- **`src/scripts/three-fx.js`** — the shared ambient layer (DNA helix presets `ambient` /
  `showpiece`, stem-cell particle field with plexus links). Lazily imported by `main.js` only
  when a `[data-three]` host exists; mounted via `initThree()`. Hosts are `DnaHelix.astro` and
  `CellField.astro`.
- **`src/components/OPortal.astro`** — the homepage hero ("The DNA Journey"), a self-contained
  scroll-driven Three.js scene with its own rAF loop. It deliberately avoids
  `data-parallax`/`data-count`/`data-reveal` because `main.js` claims those.

Non-negotiable constraints for all 3D work (documented in `three-fx.js`'s header and honoured
by `OPortal`): pixel ratio capped at 2 · loops pause offscreen and on hidden tabs ·
`prefers-reduced-motion` renders one static frame · full geometry/material/texture disposal on
`pagehide` · canvases never intercept pointer events · hosts pre-sized so there's no layout
shift · SVG fallback stays visible if WebGL throws or the chunk fails to load.

Mobile generally keeps the static SVG (`data-mobile="svg"`), and heavier effects are gated
behind `min-width: 1024px`.

### Styling — `src/styles/global.css` (~1360 lines)

Tailwind v4 via the Vite plugin. **There is no `tailwind.config.js`** — the palette and fonts
are `@theme` tokens at the top of `global.css` (`ink`/`ink2`/`ink3`, `cream`, `gold`/`goldlight`,
`oxblood`, `rose`, and the sci-fi accents `teal`/`tealdeep`). Add design tokens there, not in a
config file. Reusable classes (`.wrap`, `.eyebrow`, `.hairline*`, `.btn`, `.grid-overlay`,
`.scan-sweep`, HUD corner brackets) live in `@layer components`.

Colour carries meaning: **gold** = brand/luxury, **rose** = For Her, **teal** = science, data
and interactive UI, **oxblood** = accent. Keep pathway sections on their own accent.

All motion must be gated on `prefers-reduced-motion` — CSS animations and JS both.

### Legibility rules — do not regress these

The patient demographic is 50s–70s. The site was re-tuned for aging eyes in a dedicated pass;
the constraints below are load-bearing, not preferences. The client wants dark, so the answer
is never "make it lighter overall" — it's the specific rules here.

- **Surfaces are lifted off true black** (`inkdeep` → `ink` → `ink2` → `ink3`, darkest to
  lightest). Near-black starves an older retina of light *and* makes light text halate. Never
  reintroduce `#0a0a0b`, `#070708`, `#131419` or similar — use the tokens. The ramp was
  lifted twice (Jul and Aug 2026); the owner likes dark, so it goes up in steps, never grey.
- **Text opacity floor is 62%.** Tiers are `cream` at 100 / 90 / 75 / 62. Nothing a patient
  reads goes below `text-cream/62` (6.45:1 on the base surface). Hierarchy comes from size and
  weight — do not fade text further to de-emphasise it.
- **Type floor is 11px** (12px on phones, via the unlayered media query in `global.css`).
  Body copy is 16px. The `--text-xs/sm/base` tokens are deliberately one step above Tailwind's
  defaults with generous leading — don't "fix" them back.
- **Letter-spacing caps at 0.22em**, and that only on the largest labels. Wide tracking on
  small uppercase destroys word-shape recognition.
- **Three.js fog and clear colours must track the surface tokens** (currently `0x1c1e24`). If the page
  base changes and the fog doesn't, distant geometry fades to a colour that isn't the
  background and the canvas reads as a dark patch.

Contrast ratios were never the failure here — `cream/60` on the old near-black already passed
AA. Size, tracking and halation were. Reaching for whiter text on blacker backgrounds makes
this demographic's experience worse, not better.

### Data layer

- `src/data/treatments.ts` — the 16 signature protocols plus the condition taxonomy: `SYSTEMS`
  (6 body-system groups), `SYSTEM_OF` (condition → system), and helpers `conditionsBySystem()`,
  `allConditions()`, `findTreatments()`, `treatmentsByPathway()`. The condition finder and the
  self-assessment quiz both read from here — add a treatment here, not in a page.
  **Open item:** the client's stated 100+ treatment catalogue has never been entered; only the
  16 signature protocols exist.
- `src/data/videos.ts` — real YouTube patient testimonials + the training-page delegate video.

### Images

Local files live in `public/images/` and are referenced site-relative (`images/…`) through
`withBase()`/`imageUrl()`. Some imagery is hotlinked from `drswclinics.com` — those absolute
URLs are intentional and pass through `imageUrl()` untouched.

`public/images/` also contains stale assets from earlier design directions
(`hero-o-*`, `team-*.jpg`, `abstract-1.png`) that nothing references.

### Treatment squares

`TreatmentCard.astro` + `TreatmentGrid.astro` render **every** treatment listing on the site
(`/treatments`, `/for-him`, `/for-her`, `/longevity`). Don't hand-build another treatment
card — extend these.

- `TreatmentGrid` takes `pathway`, or `items` for pages that cross-list from other pathways
  (For Him adds the diagnostics + hormone protocols; For Her adds the O Concept™ Chair).
  `keepCondition` filters conditions per context — For Her uses it to hide the Chair's male
  conditions. `grouped` splits the full catalogue into labelled pathway runs.
- The card's interaction: at rest it reads as clinical medicine; engaged, a scan line sweeps,
  the image drifts and dims, and a readout rises listing what the treatment treats **in the
  patient's own words** (`condition.plain`). That plain phrasing is the point of the card —
  it used to be buried in a `title` tooltip, invisible on desktop and unreachable on touch.
- State is a single `.is-open` class owned by `main.js`. Hover only engages on
  `(hover: hover) and (pointer: fine)`, so a tap never leaves a card stuck open; the button is
  the primary control on touch and keyboard. Don't add a CSS `:hover` variant alongside it.
- Without JS the readout falls back to a static list in normal flow — never make it depend on
  JS to be readable.

An earlier `TreatmentCarousel` marquee sat above these grids on all four pages showing the
same treatments twice. It was removed on client feedback; don't reintroduce a second index.

### `/lab` — motion sandbox, not part of the website

`src/pages/lab.astro` + `src/scripts/lab/**` are an isolated playground for developing motion
before it touches the site. It deliberately does **not** use `Base.astro` (no header, footer,
concierge, quiz or `main.js`), is `noindex`, is filtered out of the sitemap in
`astro.config.mjs`, and nothing links to it. Changes there cannot affect the live site.

Each candidate is a plain module under `scripts/lab/scenes/` exposing
`{ id, name, blurb, placement, params, create(ctx, w, h, params) }`. `harness.js` owns the
shared guards — DPR cap, offscreen/hidden-tab pause, reduced motion, disposal — so candidates
are compared on equal terms, and only the scene nearest the viewport centre runs at a time.

Every candidate renders behind the real hero copy, because the brief is "more animation
without distracting from the message" — an effect judged in isolation doesn't answer that.

The client's art direction (Aug 2026) is **ultra-luxury, not clinical**: the register of Aesop or
Tom Ford rather than a medical textbook. Champagne gold, rose gold, blush and pearl on warm
obsidian; slow zero-gravity motion; soft-focus optics. **Teal and any bright blue are ruled
out** as surgical, which is a live tension with the site's existing teal accent — if this
direction is adopted beyond the hero, the site palette needs a decision.

Scenes are either Canvas 2D (default) or `type: 'webgl'`, built with `makeShaderScene()` from
`webgl.js` — a full-screen fragment shader with a shared GLSL library (fbm, worley, pointer
wake). Shaders are where depth, light and material come from; 2D canvas tops out at line work.

Traps already hit here, worth remembering:
- **Scale motion by `dt`, never per frame.** Per-frame angle noise made vessel tips scribble in
  place at 90Hz instead of growing.
- **Never call `WEBGL_lose_context` on teardown.** `getContext()` returns the *same* object for
  a canvas, and every slider change re-seeds the scene — losing the context leaves the panel
  permanently blank after the first drag. Delete programs/shaders/buffers instead.
- **GLSL ES 1.00 is stricter than it looks.** `flat` is a reserved word, and a uniform array may
  only be indexed by a constant or loop variable — `uCell[bestIndex]` will not compile. Capture
  the value inside the loop instead. Both failures are silent: the panel just goes blank, so
  always check the console for `[lab:<id>]` after touching a shader.
- **Match the specular model to the viewing geometry.** An anisotropic lobe along the fibre is
  right for brushed metal seen broadside and produces literally zero highlight when the camera
  looks *down* the fibres — the half-vector lands on the tangent and a high power annihilates it.
- A blank canvas and a stalled screenshot usually mean `document.hidden` is true and the guards
  are doing their job — not that the scene is broken.

### Unused components

`BioSequence.astro`, `WireHero.astro`, `ScienceInterlude.astro`, `LongevityTeaser.astro` and
`VideoTestimonials.astro` are not imported by any page — they are parked earlier attempts kept
for reference. Confirm with the user before reviving or deleting them.

## Heading for a CMS — weigh every change against this

The site will eventually move to a platform where the (non-technical) clinic owner edits text,
images, links and pages himself. The platform is undecided; the prep work is the same either
way, so do it as you go rather than as a migration project:

- **One reusable prop-driven component beats N bespoke sections.** Every hand-built section
  becomes a CMS block someone has to model and wire. `TreatmentCard`/`TreatmentGrid` is the
  pattern to copy.
- **Content belongs in `src/data/`, not in templates.** Every string hardcoded in an `.astro`
  file is a string that has to be hand-migrated. `treatments.ts` and `videos.ts` are the model.
- Known debt, not yet fixed: contact details are duplicated across many files (phone in 12,
  address in 16) and 15 images are hotlinked from `drswclinics.com` rather than held locally.

## Branch layout

Design directions live on long-lived branches rather than being merged: `main`,
`futuristic-redesign`, `3d-1st-attempt`, `3d-2nd-attempt`, `ilyas-concierge-attempt`,
`dna-ring-motions-and-site-fixations`. Ask which branch a change belongs on rather than
assuming `main`.

## Prototype features (all client-side, all fake by design)

- **Confidential Self-Assessment** — 4-step quiz, in `main.js`, recommendations drawn from
  `treatments.ts`. Opened from the edge tab (≥1400px) or the bottom-left pill (md→1400px).
- **Discreet Patient Concierge** — floating bubble, scripted exchanges, routes to humans.
- **Welcome popup** — once per session (6s or 40% scroll), dismissal in `sessionStorage`.
- **Demo forms** — `preventDefault()` + an elegant success state. Nothing is submitted or
  stored anywhere; keep it that way unless the user asks for a backend.
