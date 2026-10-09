# Experience Labs Implementation Plan

**Goal:** Add an Experience index and six working, bilingual interactive visualization pages requested in the conversation.

**Architecture:** Static Astro routes share a lab shell, SVG diagram renderer, and scoped styles. Pure TypeScript models drive browser controls; each lab has its own component and initializer. All data is fictional educational data, with no external requests or storage.

**Tech Stack:** Existing Astro, TypeScript, CSS tokens, Vitest, Playwright and axe. No new dependencies.

## Constraints

- Preserve existing journeys and verified references.
- English and Vietnamese routes and copy; keep language switching on the current lab.
- Keyboard controls, text alternatives, responsive layouts, reduced motion and strict CSP.
- No live threat claims, security guarantees, credentials, scanning, or backend.

## Tasks

- [x] Create `src/lib/labs.ts` catalog and bilingual copy; `src/lib/labModels.ts` deterministic attack, architecture, traffic and packet models. Validate defense ordering, component dependencies and threshold detection in `tests/unit/labModels.test.ts`.
- [x] Add `src/components/ExperienceLabs.astro` index and integrate into `src/pages/[lang]/experience/index.astro`; generate twelve locale routes with `src/pages/[lang]/experience/labs/[lab].astro`.
- [x] Implement `src/components/labs/{AttackLab,SocLab,ArchitectureLab,TimelineLab,TrafficLab,PacketLab}.astro`, shared shell styles and `src/scripts/labs.ts`. Controls must update diagrams and explanatory text, reset correctly and initialize after Astro navigation. Playback must stop on navigation.
- [x] Add `tests/e2e/labs.spec.ts`: exercise each lab's changed behavior in both languages, index links, client navigation, mobile overflow, accessibility and production CSP. Use exact teaching-data wording compatible with the site's production copy gate.
- [x] Run `npm run check`, `npm run lint`, `npm test`, `npm run build`, focused Playwright checks and production gate. Inspect desktop/mobile screenshots, correct failures, then document final verified behavior in README.

## Final result

Implemented all six labs in both languages. At the user's request, removed every Text view block and the traffic table; accessible descriptions are attached directly to SVGs. Mobile network diagrams stack vertically. Validation: Astro check and lint pass, 422 unit tests pass (one existing skip), build generates twelve lab routes, and 17 focused Chromium/production tests pass. Desktop and mobile screenshots were inspected. The in-app browser could not start because of its application configuration; Chromium supplied browser evidence instead.
