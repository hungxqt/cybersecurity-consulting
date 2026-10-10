# HungTran website

Bilingual (English / Vietnamese) marketing site for HungTran: security consulting, compliance audit and SOC. Static Astro build, deployed to Cloudflare Pages.

One brand, three coordinated design languages on a shared token system:

- **Cyber Intelligence Nexus** (dark, home and brand surfaces): an explorable attack-path graph of a reference environment with a service lens, a keyboard-operable detail panel and a table alternative.
- **Security Architecture Atlas** (light, Solutions, Blog and Careers): an exploded reference-architecture diagram built from CSS 3D planes, the implementation method, deliverables and technical documentation.
- **Breach to Resilience** (Experience): two interactive response playbooks (a situation board, a clock, a decision you commit to). Verified client references appear on the same page only when one exists.

Signature features: the Nexus graph, the Atlas exploded architecture, the two Breach to Resilience playbooks, a maturity quiz, a compliance matrix, a "Phish or Not?" game, a glossary and a site-wide **Threat Hunt**. Nothing is sent anywhere except the contact form.

The Experience page indexes 14 bilingual interactive security labs at `/{en,vi}/experience/labs/<slug>/`. The original six cover attack defense, SOC investigation, architecture building, incident timelines, traffic anomalies and packet journeys. Eight immersive exercises add a 3D network digital twin, DDoS defense, a response terminal, ransomware containment and recovery, packet inspection, zero-trust checkpoints, SOC replay and cloud permission blast radius. Terminal commands update the same models as the controls. All systems and traffic are fictional browser simulations; no shell execution, scans or attack requests occur. Controls support keyboards, diagrams carry accessible descriptions, playback stops on navigation, and mobile layouts adapt to narrow screens. Three.js loads only on the 3D pages, with an SVG fallback when WebGL is unavailable. Text view blocks are removed.

After `npm run build`, run `npx playwright test --config playwright.range.config.ts tests/e2e/cyber-range.spec.ts tests/e2e/labs.spec.ts tests/e2e/engagement.spec.ts tests/e2e/production-gate.spec.ts --workers=2` to check the labs against an isolated static preview on port 4322. This avoids reusing a development server on 4321. The range configuration enables software WebGL in Chromium so the tests exercise actual 3D rendering as well as initialization and context-loss fallbacks. The suite covers both languages, accessibility, production CSP, outcome changes, resets, mobile layout and screenshot artifacts in `test-results/`. Traffic animation starts disabled; explicitly checking Animate traffic enables it even with reduced-motion settings. Reduced motion still suppresses automatic playback effects. The floating Threat Hunt control stays compact, expands on hover or keyboard focus, and opens its detail panel on click.

Certifications, team members, partners, result metrics and real client testimonials require evidence before publication (see "Replace before going live"). The homepage replaces its journey showcase with a **Client signals** section: three authored review perspectives, translated into English and Vietnamese. The review copy was written for the design and is not verified client feedback; it carries no ratings or verified-client badges. The section uses CSS 3D glass panels with distinct scroll speeds for the foreground, backing plates and network background. Scroll parallax works on desktop and touch devices; mouse tilt is enabled separately on large screens. Mobile shows all reviews in a readable stack, and reduced motion disables the moving effects. "Share your experience" opens the existing contact page.

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
| `npm test` | Vitest unit tests (scoring, i18n, Vietnamese fallback, content schemas, palette contrast, token sync and the legacy-style ban, Lighthouse config) |
| `npm run test:e2e` | Playwright + axe (builds and serves the site itself; free port 4321 first). `tests/e2e/production-gate.spec.ts` crawls the sitemap in both languages and fails on sample/demo wording, `[VI]`, the old domain, dev-only owner slots and broken internal links or anchors |
| `npm run lint` / `npm run check` | ESLint / `astro check` (TypeScript) |
| `npm run lhci` | Lighthouse CI, mobile preset, against the preview build (set `CHROME_PATH` to a Chromium) |
| `npm run lhci:desktop` | The same gates with the desktop preset (`lighthouserc.desktop.json`) |
| `npm run og` | Regenerate `public/og/*.png` from `hero.title.dim` / `hero.title.strong` |
| `npm run vi:sync` | Add missing keys to `src/i18n/vi.json` as `[VI] ...` placeholders; refresh stale placeholders; drop removed keys |
| `npm run vi:content` | Create or regenerate `[VI]` placeholder MDX from the English entry |
| `npm run vi:report` | List remaining `[VI]` placeholders |

First time with Playwright: `npx playwright install chromium`.

Performance gates (LHCI `assertMatrix`, mobile and desktop, six URLs): LCP 2500 ms, CLS 0.1, TBT 200 ms, performance 0.9, accessibility 1, font bytes capped (110 KiB EN, 210 KiB VI). `tests/e2e/perf.spec.ts` adds gzip budgets, a font request audit, a layout-shift test and an interaction-latency proxy under a 4x CPU throttle.

## Navigation performance

Moving between pages is a client-side view transition (Astro `ClientRouter`). Two things keep it fast:

- **One shared stylesheet.** `vite.build.cssCodeSplit: false` in `astro.config.mjs` emits a single `/_astro/style.<hash>.css` (about 105.6 KB raw, 16.6 KB gzip) that every page links, so a client-side navigation downloads no CSS. Trade-off: the first page load carries the CSS of the whole site (about +6.5 KB gzip on the home page compared with the per-page files), accepted because it is small, cached for every later page, and the Lighthouse gates still pass. It stays an external file (the CSP allows no inline styles).
- **Smart prefetch.** `src/lib/prefetchPolicy.ts` holds the pure rules, `src/scripts/prefetch.ts` the runtime, and Astro's built-in prefetch is switched off (`prefetch: false`) so a page is never fetched twice.
  - Hover or keyboard focus starts a fetch of the target HTML after 65 ms, touch and `pointerdown` start it immediately. Leaving the link first cancels it.
  - About 3 s after a page has loaded, up to 3 likely next pages (the "Where to next" targets plus the contact page) are fetched, one at a time, once each. At most 2 page requests are in flight.
  - Fetched HTML is kept in memory for 90 s (24 pages). The `astro:before-preparation` hook hands it to the router, so hover-then-click requests the page once; a click while the fetch is still running waits for that same request. Any miss or error falls back to Astro's normal loader. Scripts a prefetched page needs are hinted with `modulepreload`.
  - Network-aware: nothing is fetched with Save-Data, `prefers-reduced-data`, `2g` or `slow-2g`, or in a hidden tab. `3g` allows hover, focus and touch but no idle prefetch; idle prefetch needs `4g` or an unknown connection.
  - Only same-origin pages under `/en/` and `/vi/` are eligible. Files, `mailto:`/`tel:`, external links, `target="_blank"`, downloads, legacy redirect pages and links to the current page are skipped. Add `data-no-prefetch` to opt a link out; `data-astro-reload` (the language switch) skips both prefetch and client routing.
- **Transition.** The cross-fade lasts 120 ms and is removed under `prefers-reduced-motion: reduce`.

Apart from the contact form submission, the only requests the site makes after load are these same-origin page and asset prefetches (`connect-src 'self'` covers them; nothing leaves the origin).

Measure it (build first with `npm run build`):

| Command                                          | What it does                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/css-report.mjs`                    | Stylesheets per built page, raw and gzip size, pages with 0, 1 or more sheets                                                                                       |
| `node scripts/measure-nav.mjs --label <name>`    | Cold, hover, idle and touch navigation timings and request counts on emulated Slow 4G (`--runs`, `--cpu`, `--url`); writes `.agents/tasks/navspeed/nav-<name>.json` |
| `npx playwright test tests/e2e/prefetch.spec.ts` | Behaviour of the prefetch rules in a real browser                                                                                                                   |

## Replace before going live

1. **Domain**: the build defaults to `https://hungtran.id.vn`; set `SITE_URL` (repository variable) only to build for another host. Keep `public/.well-known/security.txt` (`Canonical`, `Contact`, and the `Expires` date, which must be renewed within a year) in step.
2. **Contact form**: create a form at [formspree.io](https://formspree.io), then set `PUBLIC_FORMSPREE_ID` (Cloudflare Pages / GitHub secret). Until then the form shows a "not configured" message with the fallback email.
3. **Emails**: `src/lib/site.ts` (`CONTACT_EMAIL`, `SECURITY_EMAIL`). The vulnerability disclosure policy at `/security/` (`src/pages/[lang]/security.astro`, keys `sec.*`) makes commitments (acknowledging reports, good-faith legal wording, no bounty program) and names no response time on purpose: confirm you can honour them, and add a timeframe only once you can meet it, and bump `SECURITY_POLICY_UPDATED` when you change it.
4. **Team**: add people to `src/content/data/team.json` (`publish: true`). The About page, in `astro dev`, shows a dashed box where they will appear; in production it renders nothing until a published entry exists.
5. **Certifications**: every entry in `src/content/data/certifications.json` has `publish: false`. Set `publish: true` **and** an `evidenceUrl` only for credentials you really hold. The schema rejects a published entry without evidence.
6. **Case references**: there are none. To add one for an approved real engagement, create `src/content/cases/en/<slug>.mdx` with `verified: true` (client permission and evidence), then run `node scripts/sync-vi-content.mjs`. Only a verified case may carry `metrics`. With none, `/experience/` shows no reference block.
7. **Careers**: `/careers/` says there are no open roles and links to the contact form (`?topic=careers`). To list real roles, add a jobs collection back deliberately.
8. **Contact promises**: the contact copy no longer promises a response time (`contact.lede`, `contact.ok.body`; the hours row and its `contact.side.hoursValue` key were removed) and the location reads "Vietnam". Once you can honour a confirmed response time, restore it in `contact.lede` and `contact.ok.body` (via a keys file and `node scripts/add-keys.mjs`) and re-add the hours row to the Direct list in `src/pages/[lang]/contact.astro`.
9. **Threat Hunt reward** (`hunt.complete.*` keys) is flagged as a commercial offer (a free walkthrough). Honour it or remove it.

## Vietnamese translation

English is the source of truth. The Vietnamese dictionary and articles are fully translated. New keys created by the sync scripts start as `[VI] ...` placeholders and must be translated before release.

- Add or change English strings in a JSON file and run `node scripts/add-keys.mjs <file.json>`. It merges into `src/i18n/en.json` and runs `sync-vi.mjs`.
- To delete keys, remove them from `en.json`, then run `node scripts/sync-vi.mjs` (it prunes `vi.json` and refreshes `[VI]` placeholders whose English changed).
- Content: edit only the English MDX in `src/content/{posts,cases}/en/`, then run `node scripts/sync-vi-content.mjs`. It regenerates Vietnamese files that still carry the `[VI]` marker and deletes marker-carrying orphans. A file you translated (no marker) is never overwritten.
- To translate, replace the `[VI] ` text in `src/i18n/vi.json` or the Vietnamese MDX.
- `npm run build` runs the strict translation check and fails if any `[VI]` entries remain. Unit tests also check dictionary completeness and interpolation tokens. `npm run vi:report` lists outstanding entries during editing.
- Run `npm run og` after translating so the Vietnamese share image uses real text.

The runtime keeps English fallback for missing content during editing, but the release checks prevent untranslated dictionary entries or articles from shipping. Language switching preserves the current page, and `/vi/` renders Vietnamese text, metadata and article bodies.

## Deploy (Cloudflare Pages)

Easiest: connect the repository in the Cloudflare dashboard (build command `npm run build`, output `dist`, Node 22) and set `SITE_URL` and `PUBLIC_FORMSPREE_ID` as environment variables. Cloudflare reads `public/_headers` (CSP, HSTS and others) and `public/_redirects` (`/` to `/en/` and the legacy `/services/` and `/case-studies/` redirects).

GitHub Actions is temporarily disabled. The entire CI and deployment workflow is commented out in `.github/workflows/ci.yml.disabled`; restoration instructions are at the top of that file. When restored as `.github/workflows/ci.yml`, it runs lint, types, unit tests, Playwright + axe, Lighthouse (mobile and desktop) and the `[VI]` report, then deploys `main` with Wrangler. It requires:

- Secrets: `CLOUDFLARE_API_TOKEN` (Pages edit permission), `CLOUDFLARE_ACCOUNT_ID`, `PUBLIC_FORMSPREE_ID`
- Variables: `SITE_URL`, `CLOUDFLARE_PAGES_PROJECT`

Consider pinning the actions in the workflow to commit SHAs.

## Security notes

- Strict CSP with no `unsafe-inline` for scripts or styles (only `style-src-attr` for a few inline style attributes). The build never inlines scripts or styles (`astro.config.mjs`), and `tests/e2e/security.spec.ts` replays the site under the production headers and fails on any violation.
- If you add a third-party script, font, image host or API, extend the CSP in `public/_headers` deliberately.
- The journeys are static playbooks. Apart from the contact form submission (Formspree), the site only makes same-origin requests for its own pages and assets (navigation prefetch, see Navigation performance).

## Accessibility and motion

Targets WCAG 2.2 AA: keyboard operation for the graph, the Atlas diagram and the journeys; text alternatives (tables) for every diagram; severity shown as text plus shape. Every effect respects `prefers-reduced-motion`.

## Structure

```
src/lib/          Pure, tested logic: quizScore, compliance, phishGame, glossary, hunt, contactForm, i18n, interpolate, jsonld,
                  palette, contrast (colour tokens and WCAG ratios), nexus (graph data), atlas (architecture data), journeys, nav, nextStep, content (incl. resolveForLang),
                  legacyRoutes, sitemapFilter, prefetchPolicy (navigation prefetch rules)
src/scripts/      Client modules shared by every page (prefetch.ts)
src/components/   Astro components (UI renders what lib computes)
src/content/      MDX collections (posts, verified cases) and JSON data (certifications, team, services, frameworks)
src/i18n/         en.json (source) and vi.json
tests/unit/       Vitest      tests/e2e/   Playwright + axe
```

There is no `src/islands`; the home graph is inline SVG plus HTML buttons, and GSAP loads only on the journey pages.

## Design tokens

Live in `src/styles/tokens.css`; the hex values are mirrored in `src/lib/palette.ts` and checked by tests (`tokens-sync`, palette contrast). Contrast ratios are checked by `tests/unit/contrast.test.ts`.

- **Nexus (dark)**: Carbon `#0D0F11`, Graphite `#16191D`, Slate `#1E2228`, Wire `#2C323A` / Wire Strong `#68737F`, Ash `#98A2AC`, Frost `#E8ECEF`.
- **Atlas (light)**: Drafting `#F2F4F5`, Sheet `#FFFFFF`, Grid `#CBD3DA`, Rule `#6E7C89`, Graphite 600 `#4A5662`, Ink `#0F1A24`.
- **Cyanotype accent** (the single brand accent): `#86B8E8` (300) and `#0F4C81` (700) on Nexus, `#2F6FAE` (500) and `#DCE7F2` (50) on Atlas.
- **Flare threat colour** (errors, attacker and severity only): `#FF6A3D` (400), `#2A1610` (950) on Nexus; `#B8381A` (700), `#FBEAE5` (50) on Atlas. Severity is always text plus shape, never colour alone.
- **Type**: Be Vietnam Pro (display 300, body 400, strong 600) and JetBrains Mono (labels, data), self-hosted via Fontsource with metric-matched fallbacks. Fluid scale, 8 px spacing rhythm, 2 px radius on buttons, inputs and tags only; surfaces are square.
- Banned by tests: radial gradients, blur, glow, pill radius and the legacy purple/cyan palette.

## Routes and redirects

Pages: `/{en,vi}/` (Nexus home), `solutions/` (+ `consulting`, `audit`, `soc`), `experience/` (+ `journeys/{vendor-account,before-launch}`; `scenarios/<slug>` exists only when a verified case does), `blog`, `careers`, `resources`, `about`, `contact`, `security`.

Legacy URLs redirect permanently (`public/_redirects` for Cloudflare, meta-refresh pages in the build for other hosts):

- `/{en,vi}/services/…` to `/{en,vi}/solutions/…`
- `/{en,vi}/case-studies/` to `/{en,vi}/experience/`, including the three old case slugs
- `/` to `/en/`
