import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import {
  caseSchema,
  certificationSchema,
  postSchema,
  serviceSchema,
  teamSchema,
} from './content/schemas';

// Entry ids look like "en/slug" / "vi/slug" (folder per language).
const md = (dir: string) => glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${dir}` });

export const collections = {
  posts: defineCollection({ loader: md('posts'), schema: postSchema }),
  cases: defineCollection({ loader: md('cases'), schema: caseSchema }),
  services: defineCollection({
    loader: file('./src/content/data/services.json'),
    schema: serviceSchema,
  }),
  certifications: defineCollection({
    loader: file('./src/content/data/certifications.json'),
    schema: certificationSchema,
  }),
  team: defineCollection({
    loader: file('./src/content/data/team.json'),
    schema: teamSchema,
  }),
};
