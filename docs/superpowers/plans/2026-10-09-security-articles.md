# Cybersecurity articles implementation plan

**Goal:** Add 12 researched cybersecurity articles in English and Vietnamese to the existing blog.

**Architecture:** Use paired MDX files in the existing posts collection. Keep routes, schema and article layout unchanged. Link primary sources beside factual claims and distinguish source findings from editorial recommendations.

**Tech stack:** Astro content collections, MDX, Vitest and Playwright.

## Constraints

- Verify source publication and event dates; do not invent current events or future findings.
- Write original summaries and analysis, with no copied article bodies.
- Translate all 12 articles and preserve matching slugs, dates and tags.
- Preserve existing uncommitted Vietnamese fixes.
- Do not publish externally or commit and push without a new request.

## Tasks

- [x] Research current advisories, threat research and security guidance using primary sources; record dates and supported findings.
- [x] Create 12 English and 12 Vietnamese MDX files with titles, descriptions, publication dates, bylines, tags and service associations.
- [x] Update the blog listing browser assertion to check the actual content inventory rather than three fixed entries.
- [x] Validate schema, translation completeness, builds, article rendering, language switching and accessibility; inspect the expanded blog listing.

Execute inline in this session. Content additions require no new runtime dependencies or infrastructure.

Results and source inventory: [article index](../../editorial/2026-10-09-article-index.md). Production build, lint, Astro checks, 417 unit tests and 45 focused browser tests passed.
