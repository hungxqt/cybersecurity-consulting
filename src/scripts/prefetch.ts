/**
 * Smart page prefetch for the view-transition navigation (see src/lib/prefetchPolicy.ts for the
 * rules). Replaces Astro's built-in prefetch (disabled with `prefetch: false`):
 *  - hover / keyboard focus (after a short intent delay) and touch / pointerdown (immediately) fetch
 *    the target HTML;
 *  - a few likely next pages are fetched when the page has been idle for a while;
 *  - the router reuses the fetched HTML (in flight or finished) instead of requesting it again, and
 *    falls back to Astro's own loader on any miss or error;
 *  - nothing is fetched on slow connections, with data saver on, or while the tab is hidden.
 * Same-origin HTML and the assets it references only. No UI, no focus or layout changes.
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import {
  HOVER_DELAY_MS,
  IDLE_START_DELAY_MS,
  MAX_IN_FLIGHT,
  PageCache,
  assetsToHint,
  eligibility,
  extractAssets,
  idleTargets,
  langOf,
  mayPrefetch,
  normalizePageUrl,
  type NetworkState,
  type PrefetchKind,
} from '../lib/prefetchPolicy';

interface Task {
  url: string;
  kind: PrefetchKind;
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function readNetwork(): NetworkState {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  let reducedData = false;
  try {
    reducedData = window.matchMedia('(prefers-reduced-data: reduce)').matches;
  } catch {
    // Older engines reject unknown media features: treat as "no preference".
  }
  return {
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType,
    reducedData,
    visibility: document.visibilityState,
  };
}

function init(): void {
  const cache = new PageCache();
  /** Pages already fetched or scheduled in this session (input of the idle de-duplication). */
  const requestedPages = new Set<string>();
  const requestedAssets = new Set<string>();
  const idleScheduledFor = new Set<string>();
  const queue: Task[] = [];
  const controllers = new Map<AbortController, PrefetchKind>();
  const timers = new Map<Element, number>();
  let inFlight = 0;
  let idleInFlight = false;

  async function fetchPage(url: string, signal: AbortSignal, kind: PrefetchKind): Promise<string> {
    const res = await fetch(url, {
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'follow',
      priority: kind === 'idle' ? 'low' : 'high',
      signal,
    });
    // Redirects are left to Astro's loader (it rewrites the target URL); only plain HTML is cached.
    if (!res.ok || res.redirected) throw new Error(`prefetch ${String(res.status)}`);
    if (!(res.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html'))
      throw new Error('prefetch: not html');
    return res.text();
  }

  function knownAssetUrls(): Set<string> {
    const known = new Set(requestedAssets);
    for (const el of document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="stylesheet"], link[rel~="modulepreload"], link[rel~="preload"], link[rel~="prefetch"]',
    ))
      known.add(el.href);
    for (const el of document.querySelectorAll<HTMLScriptElement>('script[src]')) known.add(el.src);
    return known;
  }

  /** Warm the browser cache with the assets the prefetched page needs and this page does not have. */
  function hintAssets(html: string, pageUrl: string): void {
    const known = knownAssetUrls();
    for (const hint of assetsToHint(extractAssets(html, pageUrl), known)) {
      const link = document.createElement('link');
      if (hint.as === 'script') {
        link.rel = 'modulepreload';
      } else {
        link.rel = 'prefetch';
        link.as = hint.as;
        if (hint.as === 'font') {
          link.type = 'font/woff2';
          link.crossOrigin = 'anonymous';
        }
      }
      link.href = hint.url;
      requestedAssets.add(hint.url);
      document.head.append(link);
    }
  }

  function start(task: Task): void {
    const controller = new AbortController();
    controllers.set(controller, task.kind);
    inFlight++;
    if (task.kind === 'idle') idleInFlight = true;
    requestedPages.add(task.url);

    // Stored synchronously so that a click while the request is in flight awaits this same promise.
    const promise = fetchPage(task.url, controller.signal, task.kind);
    cache.set(task.url, promise);
    promise
      .then(
        (html) => {
          try {
            hintAssets(html, task.url);
          } catch {
            // Hints are an optimisation only.
          }
        },
        () => {
          if (cache.get(task.url) === promise) cache.delete(task.url);
          requestedPages.delete(task.url);
        },
      )
      .finally(() => {
        controllers.delete(controller);
        inFlight--;
        if (task.kind === 'idle') idleInFlight = false;
        pump();
      });
  }

  function pump(): void {
    while (inFlight < MAX_IN_FLIGHT) {
      const task = queue[0];
      if (task === undefined) return;
      // Intent tasks sit in front of idle tasks; idle tasks run one at a time so intent always has a slot.
      if (task.kind === 'idle' && idleInFlight) return;
      queue.shift();
      if (!mayPrefetch(readNetwork(), task.kind)) continue;
      if (cache.has(task.url)) continue;
      start(task);
    }
  }

  function enqueue(url: string, kind: PrefetchKind): void {
    if (cache.has(url)) return;
    const queuedAt = queue.findIndex((t) => t.url === url);
    if (queuedAt !== -1) {
      const queued = queue[queuedAt];
      if (kind !== 'intent' || queued?.kind !== 'idle') return;
      queue.splice(queuedAt, 1);
    }
    if (kind === 'intent') queue.unshift({ url, kind });
    else queue.push({ url, kind });
    pump();
  }

  // ---- Intent: hover, focus, touch ------------------------------------------------------------

  function anchorOf(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) return null;
    const a = target.closest('a[href]');
    return a instanceof HTMLAnchorElement ? a : null;
  }

  function prefetchAnchor(a: HTMLAnchorElement): void {
    const verdict = eligibility(
      {
        href: a.getAttribute('href') ?? '',
        target: a.getAttribute('target'),
        hasDownload: a.hasAttribute('download'),
        reload: 'astroReload' in a.dataset,
        noPrefetch: 'noPrefetch' in a.dataset,
        rel: a.getAttribute('rel'),
      },
      { origin: location.origin, currentUrl: location.href },
    );
    if (!verdict.ok) return;
    if (!mayPrefetch(readNetwork(), 'intent')) return;
    enqueue(verdict.url, 'intent');
  }

  function cancelTimer(a: Element): void {
    const id = timers.get(a);
    if (id === undefined) return;
    window.clearTimeout(id);
    timers.delete(a);
  }

  function schedule(a: HTMLAnchorElement): void {
    if (timers.has(a)) return;
    timers.set(
      a,
      window.setTimeout(() => {
        timers.delete(a);
        prefetchAnchor(a);
      }, HOVER_DELAY_MS),
    );
  }

  function focusVisible(el: Element): boolean {
    try {
      return el.matches(':focus-visible');
    } catch {
      return true;
    }
  }

  const passive = { passive: true } as const;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return;
      const a = anchorOf(e.target);
      if (a) schedule(a);
    },
    passive,
  );
  document.addEventListener(
    'pointerout',
    (e) => {
      const a = anchorOf(e.target);
      if (!a) return;
      if (e.relatedTarget instanceof Node && a.contains(e.relatedTarget)) return;
      cancelTimer(a);
    },
    passive,
  );
  document.addEventListener(
    'focusin',
    (e) => {
      const a = anchorOf(e.target);
      if (a && focusVisible(a)) schedule(a);
    },
    passive,
  );
  document.addEventListener(
    'focusout',
    (e) => {
      const a = anchorOf(e.target);
      if (a) cancelTimer(a);
    },
    passive,
  );
  const immediate = (e: Event): void => {
    const a = anchorOf(e.target);
    if (!a) return;
    cancelTimer(a);
    prefetchAnchor(a);
  };
  document.addEventListener('pointerdown', immediate, passive);
  document.addEventListener('touchstart', immediate, passive);
  document.addEventListener(
    'click',
    (e) => {
      const a = anchorOf(e.target);
      if (a) cancelTimer(a);
    },
    passive,
  );

  // ---- Idle: likely next pages ----------------------------------------------------------------

  function scheduleIdle(): void {
    const path = location.pathname;
    if (idleScheduledFor.has(path)) return;
    idleScheduledFor.add(path);
    const run = (): void => {
      if (location.pathname !== path) return;
      if (!mayPrefetch(readNetwork(), 'idle')) return;
      const targets = idleTargets({
        currentPath: path,
        lang: langOf(document.documentElement.lang),
        alreadyRequested: requestedPages,
        origin: location.origin,
      });
      for (const url of targets) enqueue(url, 'idle');
    };
    window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function')
        window.requestIdleCallback(run, { timeout: 2000 });
      else window.setTimeout(run, 200);
    }, IDLE_START_DELAY_MS);
  }
  document.addEventListener('astro:page-load', scheduleIdle);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    for (const [controller, kind] of controllers) if (kind === 'idle') controller.abort();
    for (const id of timers.values()) window.clearTimeout(id);
    timers.clear();
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]?.kind === 'idle') queue.splice(i, 1);
  });

  // ---- Navigation: reuse the prefetched HTML --------------------------------------------------

  /** Mirror of the router's stylesheet preload: wait for the new page's CSS before swapping. */
  async function preloadMissingStylesheets(doc: Document, signal: AbortSignal): Promise<void> {
    const present = new Set(
      Array.from(document.querySelectorAll('link[rel~="stylesheet"]'), (l) =>
        l.getAttribute('href'),
      ),
    );
    const pending: Promise<void>[] = [];
    for (const el of doc.querySelectorAll('head link[rel~="stylesheet"]')) {
      const href = el.getAttribute('href');
      if (href === null || present.has(href)) continue;
      present.add(href);
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.setAttribute('href', href);
      pending.push(
        new Promise<void>((resolve) => {
          link.addEventListener('load', () => resolve());
          link.addEventListener('error', () => resolve());
          document.head.append(link);
        }),
      );
    }
    if (pending.length > 0 && !signal.aborted) await Promise.all(pending);
  }

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as TransitionBeforePreparationEvent;
    if (ev.formData) return;
    const key = normalizePageUrl(ev.to.href, location.href);
    if (key === null) return;
    const hit = cache.get(key);
    if (hit === undefined) return;
    const original = ev.loader;
    ev.loader = async () => {
      try {
        const doc = new DOMParser().parseFromString(await hit, 'text/html');
        doc.querySelectorAll('noscript').forEach((n) => n.remove());
        if (!doc.querySelector('[name="astro-view-transitions-enabled"]')) return original();
        ev.newDocument = doc;
        await preloadMissingStylesheets(doc, ev.signal);
      } catch {
        cache.delete(key);
        return original();
      }
    };
  });
}

const w = window as unknown as { __htPrefetch?: boolean };
if (!w.__htPrefetch && !import.meta.env.DEV) {
  w.__htPrefetch = true;
  init();
}
