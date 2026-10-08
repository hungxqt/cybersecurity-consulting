/** schema.org JSON-LD builders. Pure functions returning plain objects. */
import type { Lang } from './i18n';

type Json = Record<string, unknown>;

export function organization(opts: {
  name: string;
  url: string;
  logo: string;
  description: string;
  email: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    url: opts.url,
    logo: opts.logo,
    description: opts.description,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: opts.email,
        availableLanguage: ['en', 'vi'],
      },
    ],
  };
}

export function article(opts: {
  headline: string;
  description: string;
  datePublished: Date;
  author: string;
  url: string;
  lang: Lang;
  publisher: string;
  image: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    datePublished: opts.datePublished.toISOString(),
    author: { '@type': 'Organization', name: opts.author },
    publisher: { '@type': 'Organization', name: opts.publisher },
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
    inLanguage: opts.lang,
    image: opts.image,
  };
}

const EMPLOYMENT: Record<string, string> = {
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
};

export function jobPosting(opts: {
  title: string;
  description: string;
  datePosted: Date;
  type: string;
  location: string;
  organization: string;
  url: string;
  lang: Lang;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opts.title,
    description: opts.description,
    datePosted: opts.datePosted.toISOString().slice(0, 10),
    employmentType: EMPLOYMENT[opts.type] ?? 'OTHER',
    hiringOrganization: { '@type': 'Organization', name: opts.organization },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: opts.location, addressCountry: 'VN' },
    },
    url: opts.url,
    inLanguage: opts.lang,
  };
}

/** Serialise for embedding in a <script> tag: "<" is escaped so "</script>" can never appear. */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
