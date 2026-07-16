/**
 * "In His Words" — YouTube video testimonials.
 *
 * TO GO LIVE: replace each `id` below with the real YouTube video ID
 * (the 11-character code after `watch?v=` in the video URL) and adjust
 * titles/quotes to match. Nothing else needs to change — thumbnails,
 * facades and embeds are all derived from the ID.
 */

export interface VideoTestimonial {
  /** YouTube video ID — REPLACE_WITH_VIDEO_ID until real IDs are supplied */
  id: string;
  title: string;
  quote: string;
  attribution: string;
}

export const videos: VideoTestimonial[] = [
  {
    id: 'REPLACE_WITH_VIDEO_ID_1',
    title: 'Dr Wakil on The O Concept™ — treating cause, not symptom',
    quote: 'He explained in ten minutes what no one had explained in ten years. For the first time, it felt like a plan — not a prescription.',
    attribution: 'Patient testimonial · For Him',
  },
  {
    id: 'REPLACE_WITH_VIDEO_ID_2',
    title: 'As seen on Channel 4 — sexual health, without the whisper',
    quote: 'The discretion is total, but it’s the expertise that stays with you. You are quite clearly in the hands of the person who wrote the field.',
    attribution: 'Patient testimonial · For Her',
  },
  {
    id: 'REPLACE_WITH_VIDEO_ID_3',
    title: 'Inside 77 Harley Street — the diagnostics-first consultation',
    quote: 'Every question I was too embarrassed to ask, he answered before I asked it. I left with data, a protocol and my confidence back.',
    attribution: 'Patient testimonial · Longevity',
  },
  {
    id: 'REPLACE_WITH_VIDEO_ID_4',
    title: 'Andropause, explained — why men over 40 feel the change too',
    quote: 'I thought it was just age. It was hormones — measurable, treatable. Six months on, I have my energy, my drive and my temper back.',
    attribution: 'Patient testimonial · Andropause programme',
  },
];
