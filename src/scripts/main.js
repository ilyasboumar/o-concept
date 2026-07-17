import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { treatments, findTreatments, PATHWAY_LABELS } from '../data/treatments';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* ============================================================
   Smooth scrolling (Lenis) + ScrollTrigger sync
   ============================================================ */

let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollLock(on) {
  document.body.style.overflow = on ? 'hidden' : '';
  if (lenis) on ? lenis.stop() : lenis.start();
}

/* Smooth in-page anchors; bare "#" links are content stubs. */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href.length < 2) {
      e.preventDefault();
      return;
    }
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -96 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ============================================================
   Header + mobile menu
   ============================================================ */

const header = document.getElementById('site-header');
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
function setMenu(open) {
  mobileMenu.classList.toggle('open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
  menuToggle.setAttribute('aria-expanded', String(open));
  scrollLock(open);
}
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a, [data-menu-close]').forEach((el) => {
    el.addEventListener('click', () => setMenu(false));
  });
}

/* ============================================================
   Scroll animations
   ============================================================ */

if (!reduced) {
  // Hero headline — word reveal
  if (document.querySelector('.hw')) {
    gsap.to('.hw', { y: 0, duration: 1.25, ease: 'power4.out', stagger: 0.09, delay: 0.25 });
  }

  // Single-element fade-up
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 1.05,
      ease: 'power3.out',
      delay: parseFloat(el.dataset.delay || '0'),
      scrollTrigger: { trigger: el, start: 'top 87%', once: true },
    });
  });

  // Staggered children
  document.querySelectorAll('[data-reveal-child]').forEach((parent) => {
    gsap.to(parent.children, {
      autoAlpha: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: parent, start: 'top 85%', once: true },
    });
  });

  // Subtle parallax
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    gsap.to(el, {
      yPercent: parseFloat(el.dataset.parallax || '-8'),
      ease: 'none',
      scrollTrigger: {
        trigger: el.closest('section') || el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  // Stat counters
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const counter = { v: 0 };
    gsap.to(counter, {
      v: target,
      duration: 2.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: () => {
        const n = Math.round(counter.v);
        el.textContent = prefix + ('plain' in el.dataset ? String(n) : n.toLocaleString('en-GB')) + suffix;
      },
    });
  });

  // Journey line draw (horizontal)
  document.querySelectorAll('[data-line-draw]').forEach((line) => {
    gsap.fromTo(
      line,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        transformOrigin: 'left center',
        scrollTrigger: {
          trigger: line.closest('section'),
          start: 'top 65%',
          end: 'bottom 80%',
          scrub: 0.6,
        },
      }
    );
  });

  // Timeline line draw (vertical, about page)
  document.querySelectorAll('[data-line-draw-y]').forEach((line) => {
    gsap.fromTo(
      line,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        transformOrigin: 'top center',
        scrollTrigger: {
          trigger: line.closest('section'),
          start: 'top 60%',
          end: 'bottom 75%',
          scrub: 0.6,
        },
      }
    );
  });
}

/* ============================================================
   Split-scroll science section — step indicator states.
   (Pinning itself is CSS sticky; ScrollTrigger drives which
   step is lit as each right-hand panel passes the viewport.)
   ============================================================ */

const scienceSteps = document.querySelectorAll('[data-science-steps] .science-step');
if (scienceSteps.length) {
  const setStep = (i) => {
    scienceSteps.forEach((s, j) => s.classList.toggle('active', j === i));
  };
  document.querySelectorAll('.science-panel').forEach((panel) => {
    const i = parseInt(panel.dataset.panel, 10);
    ScrollTrigger.create({
      trigger: panel,
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: () => setStep(i),
      onEnterBack: () => setStep(i),
    });
  });
}

/* ============================================================
   Recognition band — auto-scroll + pointer drag
   ============================================================ */

document.querySelectorAll('[data-recog]').forEach((viewport) => {
  const track = viewport.querySelector('.recog-track');
  if (!track) return;

  if (reduced) {
    viewport.style.overflowX = 'auto';
    viewport.style.cursor = 'default';
    return;
  }

  let x = 0;
  let dragging = false;
  let hovering = false;
  let startX = 0;
  let startTrackX = 0;

  const half = () => track.scrollWidth / 2;

  gsap.ticker.add((_, dt) => {
    if (!dragging && !hovering) x -= dt * 0.028;
    const h = half();
    if (h > 0) {
      if (x <= -h) x += h;
      if (x > 0) x -= h;
    }
    track.style.transform = `translate3d(${x}px,0,0)`;
  });

  viewport.addEventListener('mouseenter', () => (hovering = true));
  viewport.addEventListener('mouseleave', () => (hovering = false));

  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startTrackX = x;
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    x = startTrackX + (e.clientX - startX);
  });
  const endDrag = () => {
    dragging = false;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
});

/* ============================================================
   Micro-interactions — magnetic buttons + 3D tilt cards
   ============================================================ */

if (!reduced && finePointer) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      el.style.transform = `translate(${dx * 5}px, ${dy * 4}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });

  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = parseFloat(el.dataset.tiltMax || '3.5');
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(850px) rotateX(${(-dy * max).toFixed(2)}deg) rotateY(${(dx * max).toFixed(2)}deg)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

/* ============================================================
   Three.js — lazy chunk. three-fx.js itself decides per host:
   mobile hero hosts keep their SVG, reduced-motion renders a
   single static frame, everything else animates.
   ============================================================ */

if (document.querySelector('[data-three]')) {
  import('./three-fx.js')
    .then((m) => m.initThree())
    .catch(() => {
      /* chunk failed to load — SVG fallbacks remain */
    });
}

/* ============================================================
   All-treatments carousel — slow marquee (~40s/loop), pauses on
   hover/touch, draggable with momentum, resumes 3s after the
   interaction ends. Drags never fire the card's anchor click.
   Reduced motion: CSS turns the viewport into a scrollable row.
   ============================================================ */

document.querySelectorAll('[data-tx-carousel]').forEach((viewport) => {
  const track = viewport.querySelector('.tx-track');
  if (!track || reduced) return;

  let x = 0;
  let dragging = false;
  let paused = false;
  let resumeTimer = null;
  let startX = 0;
  let startTrackX = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let dragDistance = 0;

  const half = () => track.scrollWidth / 2;
  const scheduleResume = () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (paused = false), 3000);
  };

  gsap.ticker.add((_, dt) => {
    if (!dragging) {
      if (Math.abs(velocity) > 0.05) {
        x += velocity * dt; // drag momentum, decaying
        velocity *= Math.pow(0.94, dt / 16.7);
      } else if (!paused) {
        x -= (half() / 40000) * dt; // ~40s per seamless loop
      }
    }
    const h = half();
    if (h > 0) {
      if (x <= -h) x += h;
      if (x > 0) x -= h;
    }
    track.style.transform = `translate3d(${x}px,0,0)`;
  });

  viewport.addEventListener('mouseenter', () => {
    paused = true;
    clearTimeout(resumeTimer);
  });
  viewport.addEventListener('mouseleave', () => {
    if (!dragging) scheduleResume();
  });
  viewport.addEventListener('touchstart', () => {
    paused = true;
    clearTimeout(resumeTimer);
  }, { passive: true });
  viewport.addEventListener('touchend', scheduleResume, { passive: true });

  /* No pointer capture — capturing would retarget the click away from the
     card links, breaking plain clicks. Window listeners track the drag. */
  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    paused = true;
    clearTimeout(resumeTimer);
    velocity = 0;
    dragDistance = 0;
    startX = lastX = e.clientX;
    startTrackX = x;
    lastT = performance.now();
    viewport.classList.add('dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    x = startTrackX + (e.clientX - startX);
    dragDistance = Math.max(dragDistance, Math.abs(e.clientX - startX));
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientX - lastX) / dt; // px per ms
    lastX = e.clientX;
    lastT = now;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('dragging');
    scheduleResume();
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* a real drag must not fire the card link underneath */
  viewport.addEventListener(
    'click',
    (e) => {
      if (dragDistance > 8) {
        e.preventDefault();
        e.stopPropagation();
        dragDistance = 0;
      }
    },
    true
  );
});

/* ============================================================
   Hero photography rotation — slow crossfade (legacy pages)
   ============================================================ */

const heroSlides = document.querySelectorAll('.hero-slide');
if (heroSlides.length > 1 && !reduced) {
  let slideIdx = 0;
  setInterval(() => {
    heroSlides[slideIdx].classList.remove('active');
    slideIdx = (slideIdx + 1) % heroSlides.length;
    heroSlides[slideIdx].classList.add('active');
  }, 6500);
}

/* ============================================================
   Testimonials carousel
   ============================================================ */

const carousel = document.getElementById('testimonials');
if (carousel) {
  const slides = carousel.querySelectorAll('.t-slide');
  const dots = carousel.querySelectorAll('.t-dot');
  let idx = 0;
  let timer = null;

  const go = (n) => {
    idx = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  const restart = () => {
    clearInterval(timer);
    if (!reduced) timer = setInterval(() => go(idx + 1), 6500);
  };

  carousel.querySelector('.t-prev')?.addEventListener('click', () => (go(idx - 1), restart()));
  carousel.querySelector('.t-next')?.addEventListener('click', () => (go(idx + 1), restart()));
  dots.forEach((d, i) => d.addEventListener('click', () => (go(i), restart())));
  go(0);
  restart();
}

/* ============================================================
   Modals
   ============================================================ */

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  scrollLock(true);
}
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  scrollLock(false);
}

document.querySelectorAll('[data-modal]').forEach((modal) => {
  modal.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('[data-modal].open').forEach(closeModal);
});

const quizModal = document.getElementById('quiz-modal');
document.querySelectorAll('[data-open-quiz]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(quizModal));
});

/* ============================================================
   Welcome popup — once per session, 6s or 40% scroll
   ============================================================ */

const welcome = document.getElementById('welcome-modal');
const WELCOME_KEY = 'oc-welcome-shown';
if (welcome && !sessionStorage.getItem(WELCOME_KEY)) {
  let fired = false;
  const fire = () => {
    if (fired) return;
    if (document.querySelector('[data-modal].open') || mobileMenu?.classList.contains('open')) return;
    fired = true;
    sessionStorage.setItem(WELCOME_KEY, '1');
    openModal(welcome);
  };
  setTimeout(fire, 6000);
  const scrollCheck = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 0 && window.scrollY / max > 0.4) fire();
    if (fired) window.removeEventListener('scroll', scrollCheck);
  };
  window.addEventListener('scroll', scrollCheck, { passive: true });
}

/* ============================================================
   Demo forms — non-functional, elegant success state
   ============================================================ */

document.querySelectorAll('form[data-demo]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.classList.add('submitted');
  });
});

/* Base-aware URL prefix — resolves to the GitHub Pages subpath in production. */
const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/';

/* ============================================================
   Condition finder — instant, client-side, nothing stored
   ============================================================ */

const finderInput = document.getElementById('finder-input');
if (finderInput) {
  const chips = document.querySelectorAll('[data-finder-chips] .chip');
  const results = document.querySelector('[data-finder-results]');
  const empty = document.querySelector('[data-finder-empty]');

  const card = (t, query) => {
    const q = query.trim().toLowerCase();
    const matched = t.conditions.filter(
      (c) => !q || c.clinical.toLowerCase().includes(q) || c.plain.toLowerCase().includes(q)
    );
    const shown = (matched.length ? matched : t.conditions).slice(0, 3);
    return `
      <a href="${BASE}treatments#${t.slug}" class="finder-card group flex flex-col p-7">
        <div class="flex items-start justify-between gap-4">
          <h3 class="font-serif text-2xl text-cream">${t.name}</h3>
          <span class="pathway-tag ${t.pathway} shrink-0">${PATHWAY_LABELS[t.pathway]}</span>
        </div>
        <p class="mt-3 flex-1 text-sm leading-relaxed text-cream/55">${t.desc}</p>
        <div class="mt-5 flex flex-wrap gap-1.5">
          ${shown.map((c) => `<span class="condition-chip">${c.clinical}</span>`).join('')}
        </div>
        <span class="mt-6 inline-flex items-center gap-3 text-[10px] font-semibold tracking-[0.25em] text-teal uppercase">
          View treatment <span class="transition-transform duration-500 group-hover:translate-x-1.5">→</span>
        </span>
      </a>`;
  };

  const render = (query) => {
    const q = query.trim();
    chips.forEach((c) => c.classList.toggle('active', c.dataset.condition.toLowerCase() === q.toLowerCase()));
    if (!q) {
      results.innerHTML = '';
      empty?.classList.add('hidden');
      return;
    }
    const matches = findTreatments(q).slice(0, 6);
    results.innerHTML = matches.map((t) => card(t, q)).join('');
    empty?.classList.toggle('hidden', matches.length > 0);
  };

  finderInput.addEventListener('input', () => render(finderInput.value));
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.classList.contains('active') ? '' : chip.dataset.condition;
      finderInput.value = value;
      render(value);
    });
  });
}

/* ============================================================
   /treatments — pathway filter tabs
   ============================================================ */

const filterWrap = document.querySelector('[data-treatment-filters]');
if (filterWrap) {
  const tabs = filterWrap.querySelectorAll('.filter-tab');
  const boxes = document.querySelectorAll('[data-treatment-grid] [data-pathway]');
  const emptyMsg = document.querySelector('[data-treatment-empty]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      const f = tab.dataset.filter;
      let visible = 0;
      boxes.forEach((box) => {
        const show = f === 'all' || box.dataset.pathway === f;
        box.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      emptyMsg?.classList.toggle('hidden', visible > 0);
      ScrollTrigger.refresh();
    });
  });
}

/* ============================================================
   Video facades — lite-embed: iframe loads only on click
   ============================================================ */

document.querySelectorAll('[data-video-facade]').forEach((facade) => {
  const play = () => {
    const id = facade.dataset.videoId;
    if (!id || id.startsWith('REPLACE_WITH')) {
      facade.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span class="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">Video slot reserved</span>
          <p class="max-w-xs text-sm leading-relaxed text-cream/55">The final video is being selected from Dr Wakil's library — the real embed will load here.</p>
        </div>`;
      return;
    }
    facade.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  };
  facade.addEventListener('click', play, { once: true });
  facade.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      play();
    }
  });
});

/* ============================================================
   Confidential Self-Assessment — client-side, reviewed-by-humans
   framing throughout. Recommendations are drawn from the shared
   treatments data model; nothing is stored or sent.
   ============================================================ */

const QUIZ_STEPS = [
  {
    question: 'Who is this assessment for?',
    options: ['For him', 'For her', 'For us — as a couple', 'I’d rather not say yet'],
  },
  {
    question: 'What is your primary concern?',
    options: [
      'Function & performance',
      'Sensation & satisfaction',
      'Energy, hormones & weight',
      'Long-term health & optimisation',
    ],
  },
  {
    question: 'How long has this been on your mind?',
    options: ['Under six months', 'Six months to two years', 'More than two years', 'It comes and goes'],
  },
  {
    question: 'What matters most to you right now?',
    options: [
      'A discreet, expert diagnosis',
      'A non-surgical, evidence-led plan',
      'Long-term optimisation & prevention',
      'Simply understanding my options',
    ],
  },
];

const bySlug = (slug) => treatments.find((t) => t.slug === slug);

/* Likely pathway from (who, concern) — longevity concerns override */
function quizResult(answers) {
  const who = answers[0] ?? 3;
  const concern = answers[1] ?? 0;

  if (concern === 2 || concern === 3) {
    return {
      pathway: 'longevity',
      title: 'The O Concept™ Longevity — Optimisation Pathway',
      body: 'Your answers point towards energy, hormones and long-term optimisation. We would begin with a confidential consultation and the Endo Test, then build a physician-led programme around your diagnostics.',
      matches: ['endo-test', 'hormone-optimisation', 'iv-nutrition'].map(bySlug),
      href: `${BASE}longevity`,
    };
  }
  if (who === 0) {
    return {
      pathway: 'him',
      title: 'The O Concept™ for Him — Regenerative Pathway',
      body: 'Based on your answers, we would begin with a confidential consultation and Endo Test, then typically combine regenerative and energy-based therapies in a protocol built around your diagnostics.',
      matches: ['p-shot', 'eswt', 'endo-test'].map(bySlug),
      href: `${BASE}for-him`,
    };
  }
  if (who === 1) {
    return {
      pathway: 'her',
      title: 'The O Concept™ for Her — Restorative Pathway',
      body: 'Based on your answers, we would begin with a confidential consultation and Endo Test, then design a gentle, multi-modality protocol focused on comfort, sensation and confidence.',
      matches: ['o-shot', 'ultra-femme-360', 'endo-test'].map(bySlug),
      href: `${BASE}for-her`,
    };
  }
  if (who === 2) {
    return {
      pathway: null,
      title: 'The O Concept™ — Couples Programme',
      body: 'We would recommend parallel consultations with aligned protocols, so both partners progress together under one clinical team — with complete discretion for each of you.',
      matches: ['endo-test', 'p-shot', 'o-shot'].map(bySlug),
      href: `${BASE}membership`,
    };
  }
  return {
    pathway: null,
    title: 'A Confidential Starting Point',
    body: 'That is entirely understandable. We suggest beginning with a private consultation and Endo Test — a clear, clinical picture of where you are, with no obligation and no assumptions.',
    matches: ['endo-test'].map(bySlug),
    href: `${BASE}#begin`,
  };
}

function initQuiz(root) {
  let step = 0;
  const answers = [];

  const progressBar = (pct) =>
    `<div class="h-px w-full bg-cream/10"><div class="h-px bg-gold transition-all duration-700" style="width:${pct}%"></div></div>`;

  function renderReviewSuccess() {
    root.innerHTML = `
      <div class="quiz-inner py-6 text-center">
        <div class="hairline mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl text-gold">✓</div>
        <h3 class="mt-6 font-serif text-2xl text-cream">Request received.</h3>
        <p class="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-cream/60">
          A clinician will review and respond within 24 hours — discreetly, and with no obligation.
        </p>
        <button type="button" class="quiz-restart btn btn-ghost mt-8">Start Again</button>
        <p class="mt-5 text-[10px] uppercase tracking-[0.2em] text-cream/30">Prototype — nothing is stored or sent</p>
      </div>`;
    root.querySelector('.quiz-restart')?.addEventListener('click', () => {
      step = 0;
      answers.length = 0;
      render(1);
    });
  }

  function render(direction = 1) {
    let html = '';
    if (step < QUIZ_STEPS.length) {
      const s = QUIZ_STEPS[step];
      html = `
        <div class="quiz-inner">
          <div class="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/40">
            <span>Step ${step + 1} of ${QUIZ_STEPS.length}</span>
            ${step > 0 ? '<button type="button" class="quiz-back cursor-pointer text-gold/80 uppercase tracking-[0.3em] transition-colors duration-300 hover:text-gold">← Back</button>' : ''}
          </div>
          ${progressBar(((step + 1) / (QUIZ_STEPS.length + 1)) * 100)}
          <h3 class="mt-7 font-serif text-2xl leading-snug text-cream">${s.question}</h3>
          <div class="mt-6 space-y-3">
            ${s.options
              .map((opt, i) => `<button type="button" class="quiz-option" data-i="${i}">${opt}</button>`)
              .join('')}
          </div>
          <p class="mt-6 text-[10px] uppercase tracking-[0.2em] text-cream/30">Confidential · Reviewed by our clinical team · Nothing is stored in this prototype</p>
        </div>`;
    } else {
      const r = quizResult(answers);
      html = `
        <div class="quiz-inner">
          ${progressBar(100)}
          <div class="mt-7 flex items-center gap-3">
            <p class="eyebrow !text-[10px]">Your likely pathway</p>
            ${r.pathway ? `<span class="pathway-tag ${r.pathway}">${PATHWAY_LABELS[r.pathway]}</span>` : ''}
          </div>
          <h3 class="mt-3 font-serif text-2xl leading-snug text-cream">${r.title}</h3>
          <p class="mt-4 text-sm leading-relaxed text-cream/60">${r.body}</p>
          <ul class="mt-6 space-y-3">
            ${r.matches
              .filter(Boolean)
              .map(
                (t) =>
                  `<li class="hairline flex items-center gap-3 px-4 py-3 text-sm text-cream/80"><span class="h-1 w-1 shrink-0 rounded-full bg-gold"></span><span>${t.name}<span class="ml-2 text-cream/45">— ${t.tag.toLowerCase()}</span></span></li>`
              )
              .join('')}
          </ul>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="${r.href}" class="btn btn-gold flex-1">Book a Consultation</a>
            <button type="button" class="quiz-review btn btn-teal flex-1">Request a Doctor's Review Online</button>
          </div>
          <p class="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-cream/30">Your responses are reviewed by our clinical team — Dr Wakil's team will recommend your pathway</p>
        </div>`;
    }

    root.innerHTML = html;

    root.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[step] = parseInt(btn.dataset.i, 10);
        step += 1;
        render(1);
      });
    });
    root.querySelector('.quiz-back')?.addEventListener('click', () => {
      step -= 1;
      render(-1);
    });
    root.querySelector('.quiz-review')?.addEventListener('click', renderReviewSuccess);

    if (!reduced) {
      gsap.fromTo(
        root.querySelector('.quiz-inner'),
        { autoAlpha: 0, x: 26 * direction },
        { autoAlpha: 1, x: 0, duration: 0.55, ease: 'power2.out' }
      );
    }
  }

  render();
}

document.querySelectorAll('[data-quiz]').forEach(initQuiz);

/* ============================================================
   Discreet Patient Concierge — scripted prototype (routes to humans)
   ============================================================ */

const fab = document.getElementById('concierge-fab');
const panel = document.getElementById('concierge-panel');
const log = document.getElementById('concierge-log');
const chipsWrap = document.getElementById('concierge-chips');
const conciergeForm = document.getElementById('concierge-form');
const conciergeInput = document.getElementById('concierge-input');

const CONCIERGE_SCRIPT = [
  {
    chip: 'Is my enquiry confidential?',
    reply:
      'Completely. Your enquiry is handled under strict medical confidentiality — discreet communication, unmarked correspondence, and private appointment times on request. Nothing is shared without your explicit consent.',
  },
  {
    chip: 'What happens at a consultation?',
    reply:
      'A private one-to-one at 77 Harley Street. We listen first, then recommend an Endo Test — a full hormonal and metabolic panel — so any protocol is built on evidence, not assumptions. There is never any obligation to proceed.',
  },
  {
    chip: 'Can I book an Endo Test?',
    reply:
      'Of course. I can arrange a confidential Endo Test alongside your consultation — this month it is complimentary. Shall I ask our patient care team to call you at a time that suits, or would you prefer email?',
  },
];

const CONCIERGE_FALLBACK =
  'Thank you — in the live version I will pass that straight to the right member of our clinical team and offer appointment times. For this prototype, may I suggest one of the questions below, or a call on +44 (0)20 3006 8459?';

let conciergeStarted = false;

function addMessage(text, who) {
  const div = document.createElement('div');
  div.className = `chat-msg from-${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function conciergeReply(text) {
  const typing = document.createElement('div');
  typing.className = 'chat-msg from-ai chat-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  log.appendChild(typing);
  log.scrollTop = log.scrollHeight;
  setTimeout(() => {
    typing.remove();
    addMessage(text, 'ai');
  }, reduced ? 60 : 1100);
}

function renderChips() {
  chipsWrap.innerHTML = '';
  CONCIERGE_SCRIPT.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className =
      'cursor-pointer border border-gold/30 px-3 py-1.5 text-[10px] tracking-[0.08em] text-gold/85 transition-all duration-300 hover:border-gold hover:bg-gold/10';
    b.textContent = item.chip;
    b.addEventListener('click', () => {
      addMessage(item.chip, 'user');
      conciergeReply(item.reply);
    });
    chipsWrap.appendChild(b);
  });
}

if (fab && panel) {
  fab.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    fab.setAttribute('aria-expanded', String(open));
    if (open && !conciergeStarted) {
      conciergeStarted = true;
      renderChips();
      conciergeReply(
        'Good evening. I am the O Concept™ concierge — fully confidential, and everything you tell me reaches a human clinician. How may I help you today?'
      );
    }
  });
  panel.querySelector('[data-concierge-close]')?.addEventListener('click', () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
  });
  conciergeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = conciergeInput.value.trim();
    if (!value) return;
    addMessage(value, 'user');
    conciergeInput.value = '';
    conciergeReply(CONCIERGE_FALLBACK);
  });
}
