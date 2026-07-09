# The O Concept™ — Website Prototype

Client prototype for **The O Concept™**, the flagship sexual rejuvenation programme of
Dr Sherif Wakil (Dr SW Clinics, 77 Harley Street, London).

## Stack

- **Astro 5** (static output) + **Tailwind CSS v4** (Vite plugin, `@theme` tokens — no `tailwind.config.js`)
- **GSAP + ScrollTrigger** for scroll animation, **Lenis** for smooth scrolling
- **Fontsource** — Cormorant Garamond (display serif) + Manrope (geometric sans)
- No CMS, no backend. All forms are non-functional demos (`preventDefault` + success state).
- Imagery is placeholder only (placehold.co + CSS gradients + SVG line art).

## Commands

```sh
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # preview the production build
```

## Deploying to Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `NODE_VERSION=22.16.0`

## Prototype features

- **AI Treatment Match** — 4-step client-side quiz (embedded on the home page and as a
  modal via the fixed side tab / CTA buttons). Simulated recommendations only.
- **Discreet AI Concierge** — floating chat bubble, scripted demo exchanges.
- **Personalised Protocol Dashboard** — static mock UI (progress ring, sessions, sparkline).
- **Welcome popup** — once per session, after 6 s or 40 % scroll; remembers dismissal
  in `sessionStorage`.
- Reduced motion is fully respected (`prefers-reduced-motion`).

All pricing, testimonials, team members (other than Dr Wakil) and award years are
illustrative placeholders for the discovery meeting.
