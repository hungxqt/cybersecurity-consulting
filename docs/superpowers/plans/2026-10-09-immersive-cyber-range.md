# Immersive Cyber Range Implementation Plan

**Goal:** Implement all eight requested immersive experiences as bilingual child pages of Experience while preserving existing labs and the removal of Text view blocks.

**Architecture:** A typed catalog routes eight new pages through an Astro range shell. Independent state models power network defenses, DDoS queues, command execution, ransomware, packets, access decisions, replay and cloud reachability. A lazily loaded Three.js renderer supplies true 3D scenes with orbiting, picking, traffic particles and an accessible SVG fallback. A local command interpreter connects terminal actions to the same environment model used by the network and DDoS pages.

**Tech Stack:** Astro, TypeScript, Three.js, existing CSS tokens, Vitest and Playwright. Terminal commands are predefined application actions implemented with safe DOM operations.

## Constraints

- All eight ideas: digital twin, DDoS defense, response terminal, ransomware race, packet workbench, zero trust, SOC replay, cloud blast radius.
- English and Vietnamese; all prior routes remain available.
- No Text view blocks or tables. Canvas has an accessible name; SVG and live findings carry descriptive alternatives.
- Fictional browser-only exercises: no shell execution, attack traffic, scans, sockets, API calls or credentials.
- Explicit play/pause, deterministic replay, reset, timer cleanup, reduced motion, mobile layouts and strict existing CSP.
- Load 3D only on immersive pages, cap pixels and particles, dispose GPU resources on navigation, support WebGL failure.

## Implementation tasks

- [x] Add `src/lib/rangeCatalog.ts` with eight bilingual entries and `src/lib/rangeCopy.ts` for controls and outcome explanations. Extend Experience indexing and localized static paths.
- [x] Add `src/lib/rangeModels.ts`, `src/lib/rangeTerminal.ts`, and focused unit tests covering admission/queue tradeoffs, terminal allowlists, containment spread, ACL decisions, packet rules and directed blast radius.
- [x] Create `src/components/range/CyberRange.astro` with mode-specific controls, findings, metrics, terminal and visualization surfaces. Add responsive styles in `src/styles/range.css`.
- [x] Create `src/scripts/rangeScene.ts` for 3D, orbit controls, picking, packets, resize, resource cleanup and fallback. Connect mode logic and timers in `src/scripts/cyberRange.ts`; lazy-load from existing lab initialization.
- [x] Add Chromium tests for each outcome in both languages, terminal history/completion, linked environment changes, 3D picking/camera/fallback, pause/reset/navigation, accessibility, mobile overflow, reduced motion and CSP. Capture screenshots for visual review.
- [x] Run lint, type checks, unit tests, build, range and existing-lab browser tests, production copy/link gate. Update README and mark verified results here.

## Verified result

All eight immersive exercises are implemented in English and Vietnamese alongside the original six labs. The index contains 14 entries and the build emits 28 localized lab routes. Every Text view block remains removed. The user's additional Threat Hunt request is implemented: compact counter by default, full label and progress on hover or keyboard focus, and a detail panel opened by clicking.

Validation: lint passes; Astro check reports zero errors and warnings with one existing schema deprecation hint; 430 unit tests pass with one existing skip; the static build succeeds with 93 pages. All 38 focused Chromium tests pass, covering the new and original labs, engagement, accessibility, production CSP, bilingual copy and internal links. Real WebGL rendering, camera controls, context-loss fallback and forced initialization failure were exercised. Desktop screenshots of all eight new scenes and the mobile terminal were reviewed. The camera change handler was corrected to avoid recursively updating OrbitControls, and projected labels now avoid overlap.

The in-app browser remains unavailable because of its application configuration; isolated Playwright Chromium provided browser verification. No deployment was requested or performed.
