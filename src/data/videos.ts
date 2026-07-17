/**
 * "In His Words" — real YouTube patient testimonials.
 * Facades load the thumbnail instantly; the iframe mounts on click.
 */

export interface VideoTestimonial {
  /** YouTube video ID */
  id: string;
  title: string;
  quote: string;
  attribution: string;
}

export const videos: VideoTestimonial[] = [
  {
    id: 'xNpoiTqJYBc',
    title: 'The O Concept™ Patient Testimonial — Erectile Dysfunction',
    quote: 'I visited my GP numerous times and couldn’t find a solution. Dr Wakil’s protocol changed that.',
    attribution: 'Mr Rahman, patient',
  },
  {
    id: '3rR17uynpWk',
    title: 'Mike, 57 — O Concept™ Testimonial',
    quote: 'I tried numerous treatments and nothing worked. The results here have been remarkable.',
    attribution: 'Mike, 57',
  },
  {
    id: 'qseKRDLVe2k',
    title: 'Russell, 46 — Peyronie’s Disease Success Story',
    quote: 'After years of unsuccessful attempts elsewhere, this treatment changed my life.',
    attribution: 'Russell, 46',
  },
  {
    id: 'UbYr2kYUwsA',
    title: 'Mark — “Dr Wakil Changed My Life”',
    quote: 'Dr Wakil changed my life.',
    attribution: 'Mark, patient',
  },
];

/** Practitioner/delegate testimonial — used on the /training page */
export const trainingVideo: VideoTestimonial = {
  id: 'e-LfkkhUyS8',
  title: 'Delegate testimonial — O-Shot® and P-Shot® training course',
  quote: 'Training with the creator of the protocol is a different experience entirely — precise, generous and clinically rigorous.',
  attribution: 'Course delegate · The O Concept™ Training',
};
