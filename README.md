# HungTran website

Bilingual (English / Vietnamese) marketing site for HungTran: security consulting, compliance audit and SOC. Static Astro build, deployed to Cloudflare Pages.

One brand, three coordinated design languages on a shared token system:

- **Cyber Intelligence Nexus** (dark, home and brand surfaces): an interactive attack-path graph with a service lens, simulated ambient events and a keyboard-operable detail panel.
- **Security Architecture Atlas** (light, Solutions, Insights and Careers): an exploded reference-architecture diagram built from CSS 3D planes, the implementation method, deliverables and technical documentation.
- **Breach to Resilience** (Experience): two interactive journeys (a situation board, a clock, a decision you commit to), plus a library of clearly labelled illustrative scenarios.

Signature features: the Nexus graph, the Atlas exploded architecture, the two Breach to Resilience journeys, a simulated **attack-surface scan**, a maturity quiz, a compliance matrix, a SOC dashboard (with a pause control), a threat feed, a "Phish or Not?" game, a glossary and a site-wide **Threat Hunt**. All threat data is simulated in the browser; nothing is sent anywhere except the contact form.

Nothing unverified is shown: no certifications, team members, partners, result metrics or testimonials render until you publish them with evidence (see "Replace before going live").

## Run it

Requires Node 22+.

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # static site in dist/
npm run preview        # serve dist/
```

| Command | Purpose |
| --- | --- |
| `npm test` | Vitest unit tests (simulation, scoring, i18n, content schemas, palette contrast, token sync and the legacy-style ban, Lighthouse config) |
| `npm run test:e2e` | Playwright + axe (builds and serves the site itself; free port 4321 first) |
| `npm run lint` / `npm run check` | ESLint / `astro check` (TypeScript) |
| `npm run lhci` | Lighthouse CI, mobile preset, against the preview build (set `CHROME_PATH` to a Chromium) |
| `npm run lhci:desktop` | The same gates with the desktop preset (`lighthouserc.desktop.json`) |
| `npm run og` | Regenerate `public/og/*.png` from `hero.title.dim` / `hero.title.strong` |
| `npm run vi:sync` | Add missing keys to `src/i18n/vi.json` as `[VI] ...` placeholders; refresh stale placeholders; drop removed keys |
| `npm run vi:content` | Create or regenerate `[VI]` placeholder MDX from the English entry |
| `npm run vi:report` | List remaining `[VI]` placeholders |

First time with Playwright: `npx playwright install chromium`.

Performance gates (LHCI `assertMatrix`, mobile and desktop, six URLs): LCP 2500 ms, CLS 0.1, TBT 200 ms, performance 0.9, accessibility 1, font bytes capped (110 KiB EN, 210 KiB VI). `tests/e2e/perf.spec.ts` adds gzip budgets, a font request audit, a layout-shift test and an interaction-latency proxy under a 4x CPU throttle.

## Replace before going live

1. **Domain**: set `SITE_URL` (repository variable) and update `public/.well-known/security.txt` (`Canonical`, `Contact`, and the `Expires` date, which must be renewed within a year).
2. **Contact form**: create a form at [formspree.io](https://formspree.io), then set `PUBLIC_FORMSPREE_ID` (Cloudflare Pages / GitHub secret). Until then the form shows a "not configured" message with the fallback email.
3. **Emails**: `src/lib/site.ts` (`CONTACT_EMAIL`, `SECURITY_EMAIL`).
4. **Team**: add people to `src/content/data/team.json` (`publish: true`). The About page, in `astro dev`, shows a dashed box where they will appear; in production it renders nothing until a published entry exists.
5. **Certifications**: every entry in `src/content/data/certifications.json` has `publish: false`. Set `publish: true` **and** an `evidenceUrl` only for credentials you really hold. The schema rejects a published entry without evidence.
6. **Case references**: the three cases are illustrative scenarios. For an approved real engagement set `illustrative: false` and `verified: true`; only then may it carry `metrics`.
7. **Careers**: `jobsAreSamples` in `src/lib/site.ts` shows a "sample roles" notice. Set it to `false` once roles, locations and terms are real.
8. **Contact promises**: the contact copy no longer promises a response time (`contact.lede`, `contact.ok.body`; the hours row and its `contact.side.hoursValue` key were removed) and the location reads "Vietnam". Once you can honour a confirmed response time, restore it in `contact.lede` and `contact.ok.body` (via a keys file and `node scripts/add-keys.mjs`) and re-add the hours row to the Direct list in `src/pages/[lang]/contact.astro`.
9. **Threat Hunt reward** (`hunt.complete.*` keys) is flagged as a commercial offer (a free walkthrough). Honour it or remove it.

## Vietnamese translation

English is the source of truth. Every Vietnamese string and MDX entry starts as a `[VI] ...` placeholder with the same keys.

- Add or change English strings in a JSON file and run `node scripts/add-keys.mjs <file.json>`. It merges into `src/i18n/en.json` and runs `sync-vi.mjs`.
- To delete keys, remove them from `en.json`, then run `node scripts/sync-vi.mjs` (it prunes `vi.json` and refreshes `[VI]` placeholders whose English changed).
- Content: edit only the English MDX in `src/content/{posts,cases,jobs}/en/`, then run `node scripts/sync-vi-content.mjs`. It regenerates Vietnamese files that still carry the `[VI]` marker and deletes marker-carrying orphans. A file you translated (no marker) is never overwritten.
- To translate, replace the `[VI] ` text in `src/i18n/vi.json` or the Vietnamese MDX.
- CI prints the remaining count in the job summary. Switch `vi-placeholders` to `--strict` to block releases until it is zero.
- Run `npm run og` after translating so the Vietnamese share image uses real text.

Missing or blank Vietnamese values fall back to English at runtime.

## Deploy (Cloudflare Pages)

Easiest: connect the repository in the Cloudflare dashboard (build command `npm run build`, output `dist`, Node 22) and set `SITE_URL` and `PUBLIC_FORMSPREE_ID` as environment variables. Cloudflare reads `public/_headers` (CSP, HSTS and others) and `public/_redirects` (`/` to `/en/` and the legacy `/services/` and `/case-studies/` redirects).

Or use the GitHub Actions workflow in `.github/workflows/ci.yml`, which runs lint, types, unit tests, Playwright + axe, Lighthouse (mobile and desktop) and the `[VI]` report, then deploys `main` with Wrangler. Add:

- Secrets: `CLOUDFLARE_API_TOKEN` (Pages edit permission), `CLOUDFLARE_ACCOUNT_ID`, `PUBLIC_FORMSPREE_ID`
- Variables: `SITE_URL`, `CLOUDFLARE_PAGES_PROJECT`

Consider pinning the actions in the workflow to commit SHAs.

## Security notes

- Strict CSP with no `unsafe-inline` for scripts or styles (only `style-src-attr` for a few inline style attributes). The build never inlines scripts or styles (`astro.config.mjs`), and `tests/e2e/security.spec.ts` replays the site under the production headers and fails on any violation.
- If you add a third-party script, font, image host or API, extend the CSP in `public/_headers` deliberately.
- The scan, threat feed, SOC dashboard, graph events and journeys are simulations. The scan makes no network requests (asserted in tests).

## Accessibility and motion

Targets WCAG 2.2 AA: keyboard operation for the graph, the Atlas diagram and the journeys; text alternatives (tables) for every diagram; severity shown as text plus shape; a pause control for auto-updating content. Every effect respects `prefers-reduced-motion`.

## Structure

```
src/lib/          Pure, tested logic: threatSim, scanSim, quizScore, compliance, socDash, feed, phishGame, glossary, hunt, contactForm, i18n, interpolate, jsonld,
                  palette, contrast (colour tokens and WCAG ratios), nexus (graph data), atlas (architecture data), journeys, nav, nextStep, content,
                  legacyRoutes, sitemapFilter
src/components/   Astro components (UI renders what lib computes)
src/content/      MDX collections (posts, cases, jobs) and JSON data (certifications, team, services, frameworks, threat feed)
src/i18n/         en.json (source) and vi.json
tests/unit/       Vitest      tests/e2e/   Playwright + axe
```

There is no `src/islands`; the home graph is inline SVG plus HTML buttons, and GSAP loads only on the journey pages.

## Design tokens

Live in `src/styles/tokens.css`; the hex values are mirrored in `src/lib/palette.ts` and checked by tests (`tokens-sync`, palette contrast). See `/en/design/` for the specimen page (contrast ratios are computed at build time).

- **Nexus (dark)**: Carbon `#0D0F11`, Graphite `#16191D`, Slate `#1E2228`, Wire `#2C323A` / Wire Strong `#68737F`, Ash `#98A2AC`, Frost `#E8ECEF`.
- **Atlas (light)**: Drafting `#F2F4F5`, Sheet `#FFFFFF`, Grid `#CBD3DA`, Rule `#6E7C89`, Graphite 600 `#4A5662`, Ink `#0F1A24`.
- **Cyanotype accent** (the single brand accent): `#86B8E8` (300) and `#0F4C81` (700) on Nexus, `#2F6FAE` (500) and `#DCE7F2` (50) on Atlas.
- **Flare threat colour** (errors, attacker and severity only): `#FF6A3D` (400), `#2A1610` (950) on Nexus; `#B8381A` (700), `#FBEAE5` (50) on Atlas. Severity is always text plus shape, never colour alone.
- **Type**: Be Vietnam Pro (display 300, body 400, strong 600) and JetBrains Mono (labels, data), self-hosted via Fontsource with metric-matched fallbacks. Fluid scale, 8 px spacing rhythm, 2 px radius on buttons, inputs and tags only; surfaces are square.
- Banned by tests: radial gradients, blur, glow, pill radius and the legacy purple/cyan palette.

## Routes and redirects

Pages: `/{en,vi}/` (Nexus home), `solutions/` (+ `consulting`, `audit`, `soc`), `experience/` (+ `journeys/{vendor-account,before-launch}`, `scenarios/<slug>`), `blog`, `careers`, `resources`, `about`, `contact`, `design`.

Legacy URLs redirect permanently (`public/_redirects` for Cloudflare, meta-refresh pages in the build for other hosts):

- `/{en,vi}/services/…` to `/{en,vi}/solutions/…`
- `/{en,vi}/case-studies/` to `/{en,vi}/experience/`; the three old case slugs go to `/{en,vi}/experience/scenarios/<slug>/`
- `/` to `/en/`
