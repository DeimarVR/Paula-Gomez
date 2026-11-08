import { z } from 'zod';

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(2),
  city: z.string().trim().max(60).optional().nullable(),
  quote: z.string().trim().min(10).max(600),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  published: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
