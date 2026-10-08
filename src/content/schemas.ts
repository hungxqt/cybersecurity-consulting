import { z } from 'astro/zod';

/** Schemas live apart from content.config.ts so unit tests can validate fixtures without Astro. */

export const SERVICE_IDS = ['consulting', 'audit', 'soc'] as const;
export const serviceId = z.enum(SERVICE_IDS);

export const postSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(220),
  date: z.coerce.date(),
  author: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  service: serviceId.optional(),
  draft: z.boolean().default(false),
});

export const caseSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).max(220),
    date: z.coerce.date(),
    sector: z.string().min(1),
    services: z.array(serviceId).min(1),
    /** Results are only allowed on a verified case (see superRefine below). */
    metrics: z
      .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
      .min(2)
      .max(4)
      .optional(),
    /** Set to true only with the client's permission and evidence to publish the case. */
    verified: z.boolean().default(false),
    draft: z.boolean().default(false),
  })
  .superRefine((c, ctx) => {
    if (c.metrics && c.verified !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['metrics'],
        message: 'metrics require a verified case',
      });
    }
  });
export const serviceSchema = z.object({
  id: serviceId,
  order: z.number().int().positive(),
  nameKey: z.string().min(1),
  summaryKey: z.string().min(1),
});

export const certificationSchema = z
  .object({
    id: z.string().min(1),
    nameKey: z.string().min(1),
    kind: z.enum(['company', 'credential']),
    issuer: z.string().min(1),
    /** Show on the site only after the certificate is verified; requires evidenceUrl. */
    publish: z.boolean().default(false),
    evidenceUrl: z.string().url().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.publish && !c.evidenceUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidenceUrl'],
        message: 'a published certification requires an evidenceUrl',
      });
    }
  });

export const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Dictionary key for the role title. */
  roleKey: z.string().min(1),
  disciplines: z.array(z.string().min(1)),
  /** Ids from certifications.json; only published ones are ever rendered. */
  credentials: z.array(z.string().min(1)),
  publish: z.boolean().default(false),
});

export type Post = z.infer<typeof postSchema>;
export type CaseStudy = z.infer<typeof caseSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type TeamMember = z.infer<typeof teamSchema>;
