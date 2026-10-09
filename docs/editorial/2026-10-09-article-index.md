# Cybersecurity articles added on 9 October 2026

Twelve original articles were added in English and Vietnamese. The existing three articles remain, giving each language fifteen published entries. At the user's request, the new articles use editorial publication dates matching their primary source dates, ranging from 11 August to 8 October 2026. These dates determine the blog order and Article metadata; the files were created on 9 October 2026.

Blog listings, article bylines and related articles display full localized calendar dates. English and Vietnamese versions share the same date. Two articles dated 29 September cover research released on the same day.

Blog listings show six articles per page, with three pages per language for the current inventory. The first page remains `/en/blog/` or `/vi/blog/`; subsequent pages use `/blog/page/2/` and `/blog/page/3/` under the language prefix. Pagination uses regular links and keeps the current page when switching languages.

Pagination links target `#articles`, landing at the start of the article section below the sticky header. Blog hash navigation jumps immediately rather than scrolling from the page top. This works with Astro page transitions and with JavaScript disabled.

Previous, Next and numbered pagination controls appear above the article list, directly below its article-count summary.

Research was checked on 9 October 2026. Source publications span 11 August–8 October 2026. Vendor observations are attributed to the vendor and are not presented as measurements of all businesses. Each article separates the reported finding from HungTran's editorial assessment and recommendations.

## Articles and primary sources

| Topic | English article | Vietnamese article | Source date | Primary source |
| --- | --- | --- | --- | --- |
| Post-quantum certificate readiness | [English](../../src/content/posts/en/post-quantum-certificates-readiness.mdx) | [Tiếng Việt](../../src/content/posts/vi/post-quantum-certificates-readiness.mdx) | 8 Oct 2026 | [Microsoft research](https://www.microsoft.com/en-us/security/blog/2026/10/08/post-quantum-authentication-why-organizations-should-start-testing-certificate-ecosystems-now/) |
| AI vulnerability research and verified fixes | [English](../../src/content/posts/en/ai-vulnerability-research-validated-fixes.mdx) | [Tiếng Việt](../../src/content/posts/vi/ai-vulnerability-research-validated-fixes.mdx) | 7 Oct 2026 | [Microsoft FORGE](https://www.microsoft.com/en-us/security/blog/2026/10/07/3-lessons-from-frontier-ai-vulnerability-research/) |
| Connected SOC investigations | [English](../../src/content/posts/en/digital-defense-2026-connected-signals.mdx) | [Tiếng Việt](../../src/content/posts/vi/digital-defense-2026-connected-signals.mdx) | 1 Oct 2026 | [Microsoft Digital Defense Report overview](https://www.microsoft.com/en-us/security/blog/2026/10/01/insights-from-the-2026-microsoft-digital-defense-report/) |
| Zimbra exploitation and incident scoping | [English](../../src/content/posts/en/zimbra-command-injection-mail-server-response.mdx) | [Tiếng Việt](../../src/content/posts/vi/zimbra-command-injection-mail-server-response.mdx) | 30 Sep 2026 | [Microsoft threat research](https://www.microsoft.com/en-us/security/blog/2026/09/30/unauthenticated-command-injection-on-internet-facing-mail-servers-tracking-cve-2026-73570/) |
| Phishing through remote-management software | [English](../../src/content/posts/en/phishing-remote-management-persistent-access.mdx) | [Tiếng Việt](../../src/content/posts/vi/phishing-remote-management-persistent-access.mdx) | 29 Sep 2026 | [Microsoft campaign research](https://www.microsoft.com/en-us/security/blog/2026/09/29/phishing-abuses-rmm-tools-persistent-access/) |
| Star Blizzard and RedFlick | [English](../../src/content/posts/en/star-blizzard-redflick-phishing-defense.mdx) | [Tiếng Việt](../../src/content/posts/vi/star-blizzard-redflick-phishing-defense.mdx) | 29 Sep 2026 | [Microsoft threat intelligence](https://www.microsoft.com/en-us/security/blog/2026/09/29/star-blizzard-refines-phishing-and-malware-delivery-with-the-redflick-technique/) |
| AI-assisted attacks and response speed | [English](../../src/content/posts/en/agentic-ai-attacks-response-window.mdx) | [Tiếng Việt](../../src/content/posts/vi/agentic-ai-attacks-response-window.mdx) | 8 Sep 2026 | [Google Threat Intelligence Group](https://cloud.google.com/blog/topics/threat-intelligence/from-prompting-to-autonomy-the-evolution-of-adversarial-ai) |
| Independent validation of AI code review | [English](../../src/content/posts/en/ai-code-security-review-independent-validation.mdx) | [Tiếng Việt](../../src/content/posts/vi/ai-code-security-review-independent-validation.mdx) | 19 Sep 2026 | [Google engineering](https://cloud.google.com/blog/topics/systems/using-ai-agents-to-secure-google-infrastructure/) |
| Supplier dependencies and resilience | [English](../../src/content/posts/en/enisa-2026-dependency-risk-resilience.mdx) | [Tiếng Việt](../../src/content/posts/vi/enisa-2026-dependency-risk-resilience.mdx) | 22 Sep 2026 | [ENISA Threat Landscape 2026](https://www.enisa.europa.eu/publications/enisa-threat-landscape-2026) |
| Tokens and session revocation | [English](../../src/content/posts/en/nist-token-security-session-response.mdx) | [Tiếng Việt](../../src/content/posts/vi/nist-token-security-session-response.mdx) | 15 Sep 2026 | [NIST announcement](https://www.nist.gov/news-events/news/2026/09/nist-finalizes-guidelines-protecting-online-identity-and-access-tokens) |
| Cyber decoys and response ownership | [English](../../src/content/posts/en/cyber-decoys-detection-response.mdx) | [Tiếng Việt](../../src/content/posts/vi/cyber-decoys-detection-response.mdx) | 16 Sep 2026 | [CISA official bulletin](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/42aff90) |
| DDoS, DNS and service continuity | [English](../../src/content/posts/en/ddos-2026-dns-service-continuity.mdx) | [Tiếng Việt](../../src/content/posts/vi/ddos-2026-dns-service-continuity.mdx) | 11 Aug 2026 | [Cloudflare H1 report](https://blog.cloudflare.com/ddos-threat-report-2026-h1/) |

## Verification

- Production build completed with no Vietnamese placeholders.
- 417 unit tests passed; one pre-existing test skipped.
- 45 focused browser tests passed, covering all thirty article pages, both blog listings, source links, metadata, language-switch destinations, accessibility and the site-wide internal-link/content gate.
- After assigning individual publication dates, 37 content browser tests passed again, including chronological listing order and exact publication dates in both languages and Article metadata.
- ESLint and Astro checks passed with no errors or warnings; Astro retained one existing deprecation hint.
