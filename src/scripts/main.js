import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
   Hero photography rotation — slow crossfade
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

/* ============================================================
   AI Treatment Match — client-side quiz engine
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
      'Hormonal balance, energy & drive',
      'Confidence & intimacy',
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

/* Base-aware URL prefix — resolves to the GitHub Pages subpath in production. */
const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/';

const QUIZ_RESULTS = [
  {
    title: 'The O Concept™ for Him — Regenerative Pathway',
    body: 'Based on your answers, we would begin with a confidential consultation and Endo Test, then typically combine regenerative and energy-based therapies in a protocol built around your diagnostics.',
    items: ['P-Shot® — platelet-rich plasma therapy', 'O Concept™ ESWT — low-intensity shockwave', 'Endo Test — full hormonal diagnostics'],
    href: `${BASE}for-him`,
  },
  {
    title: 'The O Concept™ for Her — Restorative Pathway',
    body: 'Based on your answers, we would begin with a confidential consultation and Endo Test, then design a gentle, multi-modality protocol focused on comfort, sensation and confidence.',
    items: ['O-Shot® — platelet-rich plasma therapy', 'Ultra Femme 360 — radiofrequency rejuvenation', 'Endo Test — full hormonal diagnostics'],
    href: `${BASE}for-her`,
  },
  {
    title: 'The O Concept™ — Couples Programme',
    body: 'Based on your answers, we would recommend parallel consultations with aligned protocols, so both partners progress together under one clinical team — with complete discretion for each of you.',
    items: ['Paired confidential consultations', 'Individual Endo Test diagnostics', 'Membership — continuity of care for two'],
    href: `${BASE}membership`,
  },
  {
    title: 'A Confidential Starting Point',
    body: 'That is entirely understandable. We suggest beginning with a private consultation and Endo Test — a clear, clinical picture of where you are, with no obligation and no assumptions.',
    items: ['Confidential consultation at 77 Harley Street', 'Endo Test — full hormonal diagnostics', 'A written protocol, only if appropriate'],
    href: `${BASE}#begin`,
  },
];

function initQuiz(root) {
  let step = 0;
  const answers = [];

  const progressBar = (pct) =>
    `<div class="h-px w-full bg-cream/10"><div class="h-px bg-gold transition-all duration-700" style="width:${pct}%"></div></div>`;

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
          <p class="mt-6 text-[10px] uppercase tracking-[0.2em] text-cream/30">Confidential · Nothing is stored in this prototype</p>
        </div>`;
    } else {
      const r = QUIZ_RESULTS[answers[0] ?? 3];
      html = `
        <div class="quiz-inner">
          ${progressBar(100)}
          <p class="eyebrow mt-7 !text-[10px]">Your recommended pathway</p>
          <h3 class="mt-3 font-serif text-2xl leading-snug text-cream">${r.title}</h3>
          <p class="mt-4 text-sm leading-relaxed text-cream/60">${r.body}</p>
          <ul class="mt-6 space-y-3">
            ${r.items
              .map(
                (item) =>
                  `<li class="hairline flex items-center gap-3 px-4 py-3 text-sm text-cream/80"><span class="h-1 w-1 shrink-0 rounded-full bg-gold"></span>${item}</li>`
              )
              .join('')}
          </ul>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="${r.href}" class="btn btn-gold flex-1">Book a Consultation</a>
            <button type="button" class="quiz-restart btn btn-ghost flex-1">Start Again</button>
          </div>
          <p class="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-cream/30">Simulated recommendation — prototype only</p>
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
    root.querySelector('.quiz-restart')?.addEventListener('click', () => {
      step = 0;
      answers.length = 0;
      render(1);
    });

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
   Discreet AI Concierge — scripted prototype
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
  'Thank you — in the live version I will answer that directly, triage your concern and offer appointment times, all under clinical supervision. For this prototype, may I suggest one of the questions below, or a call on +44 (0)20 3006 8459?';

let conciergeStarted = false;

function addMessage(text, who) {
  const div = document.createElement('div');
  div.className = `chat-msg from-${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function aiReply(text) {
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
      aiReply(item.reply);
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
      aiReply(
        'Good evening. I am the O Concept™ concierge — fully confidential and clinically supervised. How may I help you today?'
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
    aiReply(CONCIERGE_FALLBACK);
  });
}
